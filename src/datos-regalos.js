export function webUrl(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Enlace no válido');
  return url.href;
}

export function validateBackup(backup) {
  if (backup?.version !== 1 || !Array.isArray(backup.gifts) ||
      !(backup.banner === null || typeof backup.banner === 'string' && backup.banner.length <= 180)) {
    throw new Error('Copia inválida');
  }
  const ids = new Set();
  const gifts = backup.gifts.map(gift => {
    if (!gift || typeof gift.id !== 'string' || !gift.id || ids.has(gift.id) ||
        typeof gift.name !== 'string' || !gift.name.trim() || gift.name.length > 100 ||
        typeof gift.description !== 'string' || gift.description.length > 300 ||
        typeof gift.link !== 'string' || !Number.isSafeInteger(gift.cents) || gift.cents < 0) {
      throw new Error('Regalo inválido');
    }
    ids.add(gift.id);
    const image = gift.image ?? '';
    if (typeof image !== 'string') throw new Error('Imagen inválida');
    return {
      id: gift.id,
      name: gift.name,
      description: gift.description,
      link: webUrl(gift.link),
      cents: gift.cents,
      image: !image || /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image) ? image : webUrl(image),
      favorite: gift.favorite === true
    };
  });
  return { gifts, banner: backup.banner };
}
