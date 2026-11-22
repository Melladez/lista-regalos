const shops = [
  'amazon.es', 'amazon.com', 'amzn.eu', 'amzn.to', 'elcorteingles.es', 'fnac.es',
  'mediamarkt.es', 'pccomponentes.com', 'ikea.com', 'decathlon.es', 'zara.com',
  'mango.com', 'nike.com', 'adidas.es', 'sephora.es', 'primor.eu', 'etsy.com',
  'ebay.es', 'es.aliexpress.com', 'aliexpress.com', 'carrefour.es', 'lidl.es',
  'casadellibro.com', 'apple.com', 'lego.com', 'game.es', 'zalando.es'
];

function shopUrl(value, base) {
  const url = new URL(value, base);
  const host = url.hostname.toLowerCase();
  if (!shops.some(shop => host === shop || host === 'www.' + shop)) throw new Error('Tienda incompatible');
  if (!['https:', 'http:'].includes(url.protocol) || url.port || url.username || url.password) {
    throw new Error('Enlace no válido');
  }
  url.protocol = 'https:';
  return url;
}

async function findImage(value) {
  let url = shopUrl(value);
  const signal = AbortSignal.timeout(5500);
  for (let i = 0; i < 4; i++) {
    const response = await fetch(url, { redirect: 'manual', signal, headers: { Accept: 'text/html' } });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) break;
      url = shopUrl(location, url);
      continue;
    }
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
      await response.body?.cancel();
      break;
    }
    const images = new Map();
    const transformed = new HTMLRewriter().on('meta', {
      element(meta) {
        const key = meta.getAttribute('property') ?? meta.getAttribute('name') ?? meta.getAttribute('itemprop');
        const content = meta.getAttribute('content');
        if (content && ['og:image:secure_url', 'og:image', 'twitter:image', 'image'].includes(key) && !images.has(key)) {
          images.set(key, content);
        }
      }
    }).on('link[rel="image_src"]', {
      element(node) {
        if (!images.has('image_src')) images.set('image_src', node.getAttribute('href'));
      }
    }).transform(response);
    const reader = transformed.body.getReader();
    try {
      let bytes = 0;
      while (bytes < 1024 * 1024 && !images.has('og:image:secure_url') && !images.has('og:image')) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        bytes += chunk.byteLength;
      }
    } finally {
      await reader.cancel();
    }
    for (const key of ['og:image:secure_url', 'og:image', 'twitter:image', 'image', 'image_src']) {
      const candidate = images.get(key);
      if (!candidate) continue;
      try {
        const image = new URL(candidate, url);
        if (image.protocol === 'https:' && !image.username && !image.password) return image.href;
      } catch {
        continue;
      }
    }
    break;
  }
  return null;
}

export default {
  async fetch(request) {
    const { pathname, searchParams } = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 });
    if (pathname === '/api/imagen' && request.method === 'GET') {
      const url = searchParams.get('url');
      let image = null;
      try {
        if (url && url.length <= 2048) image = await findImage(url);
      } catch {
        // A blocked or unsupported shop can still use a direct URL or upload.
      }
      return Response.json({ image }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const asset = assets.get(pathname === '/index.html' ? '/' : pathname);
    if (!asset) return new Response('Página no encontrada', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : asset.body, {
      headers: {
        'Content-Type': asset.type + '; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }
};
