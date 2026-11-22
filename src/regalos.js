const storageKey = 'mi-lista-de-regalos';
const bannerKey = 'mi-lista-de-regalos-descripcion';
const bannerDescription = document.querySelector('#banner-description');
const defaultBannerDescription = bannerDescription.textContent;
const bannerForm = document.querySelector('#banner-form');
const bannerText = document.querySelector('#banner-text');
const bannerStatus = document.querySelector('#banner-status');
const form = document.querySelector('#gift-form');
const { name: nameField, link, price, description } = form.elements;
const list = document.querySelector('#gifts');
const orderToggle = document.querySelector('#order-toggle');
const status = document.querySelector('#status');
const panel = document.querySelector('#gift-panel');
const toggle = document.querySelector('#form-toggle');
const title = document.querySelector('#form-title');
const save = document.querySelector('#save');
const cancel = document.querySelector('#cancel');
const imageUrl = document.querySelector('#image-url');
const imageFile = document.querySelector('#image-file');
const findImage = document.querySelector('#find-image');
const clearImage = document.querySelector('#clear-image');
const preview = document.querySelector('#image-preview');
const imageStatus = document.querySelector('#image-status');
const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
let editing = null;
let ordering = false;
let draggedGiftId = null;
let selectedImage = '';
let imageRequest = 0;

function showImage(src, message = '') {
  imageRequest++;
  selectedImage = src;
  imageStatus.textContent = message;
  preview.hidden = clearImage.hidden = !src;
  if (src) preview.src = src;
  else preview.removeAttribute('src');
}

async function lookupImage() {
  if (selectedImage) return;
  let url;
  try {
    url = webUrl(link.value);
  } catch {
    imageStatus.textContent = 'Introduce el enlace del producto para buscar su imagen.';
    return;
  }
  const request = ++imageRequest;
  imageStatus.textContent = 'Buscando imagen…';
  try {
    const response = await fetch('/api/imagen?' + new URLSearchParams({ url }));
    const result = await response.json();
    if (!response.ok || !result.image) throw new Error();
    if (request === imageRequest && url === webUrl(link.value)) showImage(webUrl(result.image));
  } catch {
    if (request === imageRequest) imageStatus.textContent = 'No se encontró una imagen. Puedes pegar su enlace directo o subir una foto.';
  }
}

async function uploadImage(file) {
  const request = ++imageRequest;
  imageStatus.textContent = 'Preparando foto…';
  save.disabled = true;
  imageFile.disabled = true;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error();
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    if (request === imageRequest) {
      imageUrl.value = '';
      showImage(canvas.toDataURL('image/webp', 0.8));
    }
  } catch {
    if (request === imageRequest) imageStatus.textContent = 'No se pudo abrir la foto. Prueba con un archivo JPG, PNG o WebP de hasta 20 MB.';
  } finally {
    imageFile.value = '';
    imageFile.disabled = false;
    save.disabled = false;
  }
}

findImage.addEventListener('click', () => {
  if (selectedImage) {
    imageStatus.textContent = 'Quita la imagen actual para buscar otra.';
    return;
  }
  lookupImage();
});
link.addEventListener('input', () => { imageRequest++; });
link.addEventListener('change', () => { if (link.value.trim()) lookupImage(); });
imageUrl.addEventListener('input', () => { imageRequest++; });
imageUrl.addEventListener('change', () => {
  if (!imageUrl.value.trim()) {
    if (selectedImage.startsWith('http')) showImage('');
    return;
  }
  try {
    showImage(webUrl(imageUrl.value));
  } catch {
    imageStatus.textContent = 'Introduce una URL de imagen que empiece por https:// o http://.';
  }
});
imageFile.addEventListener('change', () => {
  if (imageFile.files[0]) uploadImage(imageFile.files[0]);
});
clearImage.addEventListener('click', () => {
  imageUrl.value = '';
  showImage('');
  findImage.focus();
});
preview.addEventListener('error', () => {
  preview.hidden = true;
  imageStatus.textContent = 'No se pudo mostrar la imagen. Prueba con otra URL o sube una foto.';
});

function readGifts() {
  const gifts = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
  if (!Array.isArray(gifts)) throw new Error('Formato de lista incorrecto');
  return gifts;
}

const importFile = document.querySelector('#import-file');
const transferStatus = document.querySelector('#transfer-status');

document.querySelector('#export-list').addEventListener('click', () => {
  try {
    const backup = {
      version: 1,
      gifts: readGifts(),
      banner: localStorage.getItem(bannerKey)
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    const download = document.createElement('a');
    download.href = url;
    download.download = 'mi-lista-de-regalos.json';
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    transferStatus.textContent = 'Copia preparada. Guarda el archivo para importarlo en la otra página.';
  } catch {
    transferStatus.textContent = 'No se pudo exportar la lista.';
  }
});

function parseBackup(text) {
  const backup = JSON.parse(text);
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

document.querySelector('#import-list').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  if (!file) return;
  importFile.value = '';
  let backup;
  try {
    if (file.size > 12 * 1024 * 1024) throw new Error('Copia demasiado grande');
    backup = parseBackup(await file.text());
  } catch {
    transferStatus.textContent = 'El archivo seleccionado no es una copia válida de la lista.';
    return;
  }
  try {
    const current = readGifts();
    const currentIds = new Set(current.map(gift => gift.id));
    const additions = backup.gifts.filter(gift => !currentIds.has(gift.id));
    const restoreBanner = backup.banner !== null && localStorage.getItem(bannerKey) === null;
    if (restoreBanner) localStorage.setItem(bannerKey, backup.banner);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...current, ...additions]));
    } catch (error) {
      if (restoreBanner) localStorage.removeItem(bannerKey);
      throw error;
    }
    if (restoreBanner) {
      updateBanner(backup.banner);
      bannerText.value = backup.banner;
    }
    refresh();
    transferStatus.textContent = additions.length === 1 ? 'Se ha importado 1 regalo.' : `Se han importado ${additions.length} regalos.`;
  } catch {
    transferStatus.textContent = 'No se pudo guardar la copia. Comprueba el espacio disponible en este navegador.';
  }
});

function webUrl(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Enlace no válido');
  return url.href;
}

function element(tag, content, className) {
  const node = document.createElement(tag);
  node.textContent = content;
  if (className) node.className = className;
  return node;
}

function action(text, handler) {
  const button = element('button', text);
  button.type = 'button';
  button.addEventListener('click', handler);
  return button;
}

function moveGift(id, destination, focusControl) {
  try {
    const gifts = readGifts();
    const from = gifts.findIndex(gift => gift.id === id);
    if (from < 0) return;
    const to = destination(gifts, from);
    if (to < 0 || to >= gifts.length || to === from) return;
    const previousPositions = focusControl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? new Map(Array.from(list.children, card => [card.dataset.giftId, card.getBoundingClientRect()]))
      : null;
    const [gift] = gifts.splice(from, 1);
    gifts.splice(to, 0, gift);
    persist(gifts);
    if (previousPositions) animateGiftPositions(previousPositions);
    status.textContent = `${gift.name} ahora está en la posición ${to + 1} de ${gifts.length}.`;
    if (focusControl) {
      const controls = list.children[to].querySelectorAll('.order-step:not(:disabled)');
      const preferred = Array.from(controls).find(button => button.dataset.step === focusControl);
      (preferred ?? controls[0] ?? orderToggle).focus();
    }
  } catch {
    status.textContent = 'No se pudo guardar el orden en este navegador.';
  }
}

function animateGiftPositions(previousPositions) {
  const movements = Array.from(list.children, card => {
    const previous = previousPositions.get(card.dataset.giftId);
    const current = card.getBoundingClientRect();
    return { card, x: previous.left - current.left, y: previous.top - current.top };
  });
  for (const { card, x, y } of movements) {
    if (x || y) {
      card.animate(
        [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }],
        { duration: 260, easing: 'ease-out' }
      );
    }
  }
}

function orderControls(item, gift, index, count) {
  const controls = element('div', '', 'order-controls');
  for (const [label, symbol, step] of [['Mover a la izquierda', '←', -1], ['Mover a la derecha', '→', 1]]) {
    const button = action(symbol, () => moveGift(gift.id, (gifts, from) => from + step, String(step)));
    button.className = 'order-step';
    button.dataset.step = String(step);
    button.disabled = index + step < 0 || index + step >= count;
    button.setAttribute('aria-label', `${label} ${gift.name}`);
    button.title = label;
    controls.append(button);
  }

  const handle = element('span', '⠿', 'drag-handle');
  handle.draggable = true;
  handle.title = 'Arrastrar para mover';
  handle.setAttribute('aria-hidden', 'true');
  handle.addEventListener('dragstart', event => {
    draggedGiftId = gift.id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', gift.id);
    event.dataTransfer.setDragImage(item, 18, 18);
    item.classList.add('dragging');
  });
  handle.addEventListener('dragend', () => {
    draggedGiftId = null;
    item.classList.remove('dragging');
    list.querySelector('[data-drop]')?.removeAttribute('data-drop');
  });
  const dropEdge = event => {
    const bounds = item.getBoundingClientRect();
    const columns = getComputedStyle(list).gridTemplateColumns.trim().split(/\s+/);
    if (columns.length > 1) return event.clientX >= bounds.left + bounds.width / 2 ? 'right' : 'left';
    return event.clientY >= bounds.top + bounds.height / 2 ? 'after' : 'before';
  };
  item.addEventListener('dragover', event => {
    if (draggedGiftId === null || draggedGiftId === gift.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const previous = list.querySelector('[data-drop]');
    if (previous !== item) previous?.removeAttribute('data-drop');
    item.dataset.drop = dropEdge(event);
  });
  item.addEventListener('dragleave', event => {
    if (!item.contains(event.relatedTarget)) item.removeAttribute('data-drop');
  });
  item.addEventListener('drop', event => {
    if (draggedGiftId === null || draggedGiftId === gift.id) return;
    event.preventDefault();
    const id = draggedGiftId;
    const edge = dropEdge(event);
    const after = edge === 'right' || edge === 'after';
    draggedGiftId = null;
    item.removeAttribute('data-drop');
    list.querySelector('.dragging')?.classList.remove('dragging');
    moveGift(id, (gifts, from) => {
      const target = gifts.findIndex(entry => entry.id === gift.id);
      return target < 0 ? -1 : target + Number(after) - Number(from < target);
    });
  });
  controls.append(handle);
  return controls;
}

function favoriteControl(item, gift) {
  const star = element('span', '', 'favorite-star');
  star.setAttribute('aria-hidden', 'true');
  const button = action('', () => {
    try {
      const gifts = readGifts();
      const entry = gifts.find(other => other.id === gift.id);
      if (!entry) return;
      entry.favorite = !entry.favorite;
      localStorage.setItem(storageKey, JSON.stringify(gifts));
      update(entry.favorite);
      if (entry.favorite && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        star.animate([
          { transform: 'rotate(0deg) scale(1)' },
          { transform: 'rotate(-25deg) scale(1.2)' },
          { transform: 'rotate(21deg) scale(1.2)' },
          { transform: 'rotate(-12deg) scale(1.08)' },
          { transform: 'rotate(0deg) scale(1)' }
        ], { duration: 420, easing: 'ease-out' });
      }
    } catch {
      status.textContent = 'No se pudo guardar el favorito en este navegador.';
    }
  });
  button.className = 'favorite-button';
  button.setAttribute('aria-label', `Favorito: ${gift.name}`);
  button.append(star);

  function update(favorite) {
    item.classList.toggle('is-favorite', favorite);
    button.setAttribute('aria-pressed', String(favorite));
    button.title = favorite ? 'Quitar de favoritos' : 'Marcar como favorito';
    star.textContent = favorite ? '★' : '☆';
  }

  update(gift.favorite === true);
  return button;
}

function render(gifts) {
  document.querySelector('#count').textContent = gifts.length === 1 ? '1 regalo' : `${gifts.length} regalos`;
  document.querySelector('#empty').hidden = gifts.length > 0;
  const showOrderControls = ordering && gifts.length > 1;
  list.replaceChildren(...gifts.map((gift, index) => {
    const item = element('li', '', 'gift');
    item.dataset.giftId = gift.id;
    const main = element('div', '', 'gift-main');
    if (gift.image) {
      const image = element('img', '', 'gift-image');
      image.alt = '';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => { image.remove(); });
      image.src = gift.image;
      main.append(image);
    }
    const details = element('div', '', 'gift-details');
    details.append(element('h3', gift.name));
    if (gift.description) details.append(element('p', gift.description, 'description'));
    main.append(details);
    const footer = element('div', '', 'gift-footer');
    const actions = element('div', '', 'actions');
    const product = element('a', 'Ver producto', 'product');
    product.href = webUrl(gift.link);
    product.target = '_blank';
    product.rel = 'noopener noreferrer';
    actions.append(product, action('Editar', () => editGift(gift)), action('Eliminar', () => removeGift(gift)));
    if (!showOrderControls) footer.append(actions);
    footer.append(element('span', euros.format(gift.cents / 100), 'price'), favoriteControl(item, gift));
    item.append(main, footer);
    if (showOrderControls) item.append(orderControls(item, gift, index, gifts.length));
    return item;
  }));
}

function updateBanner(text) {
  bannerDescription.textContent = text;
  bannerDescription.hidden = ordering || !text;
}

orderToggle.addEventListener('click', () => {
  ordering = !ordering;
  orderToggle.setAttribute('aria-pressed', String(ordering));
  bannerForm.hidden = !ordering;
  bannerText.value = bannerDescription.textContent;
  bannerStatus.textContent = '';
  updateBanner(bannerDescription.textContent);
  refresh();
  status.textContent = ordering && list.children.length > 1 ? 'Usa las flechas para mover los regalos a la izquierda o a la derecha, o arrastra el tirador.' : '';
});

bannerForm.addEventListener('submit', event => {
  event.preventDefault();
  const text = bannerText.value.trim();
  try {
    localStorage.setItem(bannerKey, text);
    updateBanner(text);
    bannerText.value = text;
    bannerStatus.textContent = 'Descripción guardada.';
  } catch {
    bannerStatus.textContent = 'No se pudo guardar la descripción en este navegador.';
  }
});
bannerText.addEventListener('input', () => { bannerStatus.textContent = ''; });

function resetForm() {
  editing = null;
  form.reset();
  showImage('');
  for (const field of [nameField, link, price]) field.setCustomValidity('');
  title.textContent = 'Añadir regalo';
  save.textContent = 'Guardar regalo';
  cancel.hidden = true;
}

function editGift(gift) {
  resetForm();
  editing = gift.id;
  nameField.value = gift.name;
  link.value = gift.link;
  price.value = (gift.cents / 100).toFixed(2).replace('.', ',');
  description.value = gift.description;
  showImage(gift.image ?? '');
  title.textContent = 'Editar regalo';
  save.textContent = 'Guardar cambios';
  cancel.hidden = false;
  setFormOpen(true);
  nameField.focus();
}

function setFormOpen(open) {
  toggle.setAttribute('aria-expanded', String(open));
  panel.inert = !open;
  panel.parentElement.classList.toggle('form-open', open);
}

function closeForm() {
  resetForm();
  toggle.focus();
  setFormOpen(false);
}

function persist(gifts) {
  localStorage.setItem(storageKey, JSON.stringify(gifts));
  render(gifts);
}

function removeGift(gift) {
  if (!window.confirm(`¿Eliminar «${gift.name}» de tu lista?`)) return;
  try {
    persist(readGifts().filter(item => item.id !== gift.id));
    if (editing === gift.id) closeForm();
    status.textContent = 'Regalo eliminado.';
    toggle.focus();
  } catch {
    status.textContent = 'No se pudo eliminar el regalo.';
  }
}

for (const field of [nameField, link, price]) {
  field.addEventListener('input', () => field.setCustomValidity(''));
}

cancel.addEventListener('click', closeForm);
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') === 'false';
  setFormOpen(open);
  if (open) nameField.focus({ preventScroll: true });
});

form.addEventListener('submit', event => {
  event.preventDefault();
  if (save.disabled) return;
  const name = nameField.value.trim();
  if (!name) {
    nameField.setCustomValidity('Escribe el nombre del regalo.');
    nameField.reportValidity();
    return;
  }
  let url;
  try {
    url = webUrl(link.value);
  } catch {
    link.setCustomValidity('Introduce un enlace que empiece por https:// o http://.');
    link.reportValidity();
    return;
  }
  const amount = price.value.trim();
  if (!/^\d{1,9}(?:[,.]\d{1,2})?$/.test(amount)) {
    price.setCustomValidity('Introduce un precio en euros con hasta dos decimales.');
    price.reportValidity();
    return;
  }
  const cents = Math.round(Number(amount.replace(',', '.')) * 100);
  let image = selectedImage;
  if (imageUrl.value.trim()) {
    try {
      image = webUrl(imageUrl.value.trim());
    } catch {
      imageStatus.textContent = 'Introduce una URL de imagen que empiece por https:// o http://.';
      imageUrl.focus();
      return;
    }
  }
  const gift = {
    id: editing ?? crypto.randomUUID(),
    name,
    link: url,
    cents,
    description: description.value.trim(),
    image
  };
  try {
    const gifts = readGifts();
    if (editing && !gifts.some(item => item.id === editing)) {
      closeForm();
      status.textContent = 'El regalo ya se ha eliminado.';
      return;
    }
    persist(editing ? gifts.map(item => item.id === editing ? { ...item, ...gift } : item) : [gift, ...gifts]);
    status.textContent = editing ? 'Cambios guardados.' : 'Regalo añadido.';
    closeForm();
  } catch {
    status.textContent = 'No se pudo guardar el regalo. Si el navegador se ha quedado sin espacio, prueba con un enlace de imagen.';
  }
});

function refresh() {
  try {
    render(readGifts());
  } catch {
    status.textContent = 'No se pudo cargar la lista en este navegador.';
  }
}

function startSnowfall() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const snow = element('div', '', 'snowfall');
  snow.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 34; i++) {
    const flake = element('span', '', 'snowflake');
    const duration = 4 + Math.random() * 5;
    flake.style.setProperty('--flake-left', `${Math.random() * 100}%`);
    flake.style.setProperty('--flake-size', `${2 + Math.random() * 5}px`);
    flake.style.setProperty('--flake-duration', `${duration}s`);
    flake.style.setProperty('--flake-delay', `${-Math.random() * duration}s`);
    flake.style.setProperty('--flake-drift', `${Math.random() * 80 - 40}px`);
    snow.append(flake);
  }
  document.querySelector('.hero').append(snow);
}

window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) refresh();
  if (event.key === bannerKey || event.key === null) updateBanner(event.newValue ?? defaultBannerDescription);
});
try {
  updateBanner(localStorage.getItem(bannerKey) ?? defaultBannerDescription);
} catch {
  updateBanner(defaultBannerDescription);
}
refresh();
startSnowfall();
