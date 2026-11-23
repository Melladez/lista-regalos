import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { GET as getImage } from './api/imagen.js';
import { validateBackup } from './src/datos-regalos.js';

const host = '127.0.0.1';
const port = 3000;
const hosts = new Set([`${host}:${port}`, `localhost:${port}`]);
const giftFile = new URL('./regalos.json', import.meta.url);
const assets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/estilos.css', ['estilos.css', 'text/css']],
  ['/regalos.js', ['regalos.js', 'text/javascript']],
  ['/datos-regalos.js', ['datos-regalos.js', 'text/javascript']],
  ['/regalo.svg', ['regalo.svg', 'image/svg+xml']]
]);
let pendingWrite = Promise.resolve();

function revision(body) {
  return '"' + createHash('sha256').update(body).digest('hex') + '"';
}

async function saveGifts(expected, gifts) {
  if (revision(await readFile(giftFile)) !== expected) return null;
  const body = JSON.stringify(gifts, null, 2) + '\n';
  const temp = new URL(`./regalos.json.${randomUUID()}.tmp`, import.meta.url);
  try {
    await writeFile(temp, body, { flag: 'wx', flush: true });
    await rename(temp, giftFile);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
  return revision(body);
}

async function handle(request, response) {
  if (!hosts.has(request.headers.host)) return response.writeHead(403).end();
  const origin = 'http://' + request.headers.host;
  const url = new URL(request.url, origin);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (url.pathname === '/regalos.json' && request.method === 'PUT') {
    if (request.headers.origin !== origin) return response.writeHead(403).end();
    if (request.headers['content-type'] !== 'application/json') return response.writeHead(415).end();
    const expected = request.headers['if-match'];
    if (!expected) return response.writeHead(428).end();

    const chunks = [];
    let size = 0;
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      size += chunk.length;
      if (size > 32 * 1024 * 1024) {
        request.resume();
        return response.writeHead(413).end();
      }
      chunks.push(chunk);
    }
    let gifts;
    try {
      const body = Buffer.concat(chunks).toString('utf8');
      gifts = validateBackup(JSON.parse(body)).gifts;
    } catch {
      return response.writeHead(400).end();
    }

    // Check the revision within the queue, immediately before replacing the file.
    const nextWrite = pendingWrite.then(() => saveGifts(expected, gifts));
    pendingWrite = nextWrite.catch(() => {});
    const etag = await nextWrite;
    return etag ? response.writeHead(204, { ETag: etag }).end() : response.writeHead(412).end();
  }

  if (!['GET', 'HEAD'].includes(request.method)) return response.writeHead(405).end();
  if (url.pathname === '/regalos.json') {
    const body = await readFile(giftFile);
    return response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      ETag: revision(body),
      'X-Regalos-Editable': 'true'
    }).end(request.method === 'HEAD' ? undefined : body);
  }
  if (url.pathname === '/api/imagen' && request.method === 'GET') {
    const result = await getImage(new Request(origin + url.pathname + url.search));
    return response.writeHead(result.status, Object.fromEntries(result.headers)).end(await result.text());
  }
  const asset = assets.get(url.pathname);
  if (!asset) return response.writeHead(404).end();
  const [file, type] = asset;
  const body = await readFile(new URL('./src/' + file, import.meta.url));
  return response.writeHead(200, { 'Content-Type': type + '; charset=utf-8' })
    .end(request.method === 'HEAD' ? undefined : body);
}

createServer((request, response) => {
  handle(request, response).catch(error => {
    console.error(error);
    response.writeHead(500).end();
  });
}).listen(port, host, () => console.log(`Lista de regalos: http://${host}:${port}`));
