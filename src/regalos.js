import { validateBackup, webUrl } from './datos-regalos.js';

/* Estilo nuevo desactivado temporalmente.
const appearanceKey = 'mi-lista-de-regalos-estilo';
const appearanceSwitch = document.querySelector('#appearance-switch');
const appearanceLabel = appearanceSwitch.querySelector('.appearance-label');

function applyAppearance(isNew) {
  document.documentElement.toggleAttribute('data-new-appearance', isNew);
  appearanceSwitch.setAttribute('aria-checked', String(isNew));
  appearanceLabel.textContent = isNew ? 'Nueva' : 'Actual';
}

try {
  applyAppearance(localStorage.getItem(appearanceKey) === 'nueva');
} catch {
  // The switch still works when browser storage is unavailable.
}

appearanceSwitch.addEventListener('click', () => {
  const isNew = appearanceSwitch.getAttribute('aria-checked') === 'false';
  applyAppearance(isNew);
  try {
    localStorage.setItem(appearanceKey, isNew ? 'nueva' : 'actual');
  } catch {
    // Keep the chosen appearance for the current page.
  }
});
*/

const themeKey = 'mi-lista-de-regalos-ocasion';
const themePicker = document.querySelector('#theme-picker');
let birthdayTheme = false;
const bannerKey = () => 'mi-lista-de-regalos-descripcion' + (birthdayTheme ? '-cumpleanos' : '');
const bannerDescription = document.querySelector('#banner-description');
const defaultBannerDescription = bannerDescription.textContent;
const bannerForm = document.querySelector('#banner-form');
const bannerText = document.querySelector('#banner-text');
const bannerStatus = document.querySelector('#banner-status');
const form = document.querySelector('#gift-form');
const { name: nameField, link, price, description } = form.elements;
const list = document.querySelector('#gifts');
const giftSort = document.querySelector('#gift-sort');
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
let savedGifts = [];
let revision = null;
let writable = false;
let saving = false;

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
  return structuredClone(savedGifts);
}

const importFile = document.querySelector('#import-file');
const importButton = document.querySelector('#import-list');
const exportButton = document.querySelector('#export-list');
const transferStatus = document.querySelector('#transfer-status');

exportButton.addEventListener('click', () => {
  try {
    const backup = {
      version: 1,
      gifts: readGifts(),
      banner: writable ? localStorage.getItem(bannerKey()) : null
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

importButton.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  if (!file || !writable) return;
  importFile.value = '';
  let backup;
  try {
    if (file.size > 12 * 1024 * 1024) throw new Error('Copia demasiado grande');
    backup = validateBackup(JSON.parse(await file.text()));
  } catch {
    transferStatus.textContent = 'El archivo seleccionado no es una copia válida de la lista.';
    return;
  }
  try {
    const current = readGifts();
    const currentIds = new Set(current.map(gift => gift.id));
    const additions = backup.gifts.filter(gift => !currentIds.has(gift.id));
    const importedBannerKey = bannerKey();
    const restoreBanner = backup.banner !== null && localStorage.getItem(importedBannerKey) === null;
    if (restoreBanner) localStorage.setItem(importedBannerKey, backup.banner);
    try {
      if (additions.length) await persist([...current, ...additions]);
    } catch (error) {
      if (restoreBanner) localStorage.removeItem(importedBannerKey);
      throw error;
    }
    if (restoreBanner && importedBannerKey === bannerKey()) {
      updateBanner(backup.banner);
      bannerText.value = backup.banner;
    }
    refresh();
    transferStatus.textContent = additions.length === 1 ? 'Se ha importado 1 regalo.' : `Se han importado ${additions.length} regalos.`;
  } catch (error) {
    transferStatus.textContent = error.message;
  }
});

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

async function moveGift(id, destination, focusControl) {
  try {
    const gifts = readGifts();
    const from = gifts.findIndex(gift => gift.id === id);
    if (from < 0) return;
    const to = destination(gifts, from);
    if (to < 0 || to >= gifts.length || to === from) return;
    const previousPositions = focusControl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? captureGiftPositions()
      : null;
    const [gift] = gifts.splice(from, 1);
    gifts.splice(to, 0, gift);
    await persist(gifts);
    if (previousPositions) animateGiftPositions(previousPositions);
    status.textContent = `${gift.name} ahora está en la posición ${to + 1} de ${gifts.length}.`;
    if (focusControl) {
      const controls = list.children[to].querySelectorAll('.order-step:not(:disabled)');
      const preferred = Array.from(controls).find(button => button.dataset.step === focusControl);
      (preferred ?? controls[0] ?? orderToggle).focus();
    }
  } catch (error) {
    status.textContent = error.message;
  }
}

function captureGiftPositions() {
  return new Map(Array.from(list.children, card => [card.dataset.giftId, card.getBoundingClientRect()]));
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

const publicFavoritesKey = 'mi-lista-de-regalos-favoritos-publicos';
let publicFavorites = new Map();

function setGiftFavorite(gifts, index, favorite) {
  const entry = gifts[index];
  entry.favorite = favorite;
  if (favorite && index > 0) {
    gifts.splice(index, 1);
    gifts.unshift(entry);
    return true;
  }
  if (!favorite && gifts.slice(index + 1).some(other => other.favorite)) {
    gifts.sort((a, b) => Number(b.favorite === true) - Number(a.favorite === true));
    return true;
  }
  return false;
}

function loadPublicFavorites() {
  try {
    publicFavorites = new Map(JSON.parse(localStorage.getItem(publicFavoritesKey) ?? '[]'));
  } catch {
    return;
  }
  for (const [id, favorite] of publicFavorites) {
    if (typeof favorite !== 'boolean') continue;
    const index = savedGifts.findIndex(gift => gift.id === id);
    if (index >= 0) setGiftFavorite(savedGifts, index, favorite);
  }
}

function favoriteControl(item, gift) {
  const star = element('span', '', 'favorite-star');
  star.setAttribute('aria-hidden', 'true');
  const button = action('', async () => {
    try {
      const gifts = readGifts();
      const index = gifts.findIndex(other => other.id === gift.id);
      if (index < 0) return;
      const entry = gifts[index];
      const reordered = setGiftFavorite(gifts, index, !entry.favorite);
      if (writable) {
        await persist(gifts, false);
      } else {
        savedGifts = gifts;
        publicFavorites.delete(entry.id);
        publicFavorites.set(entry.id, entry.favorite);
        try {
          localStorage.setItem(publicFavoritesKey, JSON.stringify([...publicFavorites]));
        } catch {
          status.textContent = 'El favorito se mantendrá hasta que cierres o recargues la página.';
        }
      }
      const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let activeStar = star;
      if (!ordering || reordered || !item.isConnected) {
        const previousPositions = animate && (reordered || !ordering)
          ? captureGiftPositions()
          : null;
        const restoreFocus = document.activeElement === button;
        refresh();
        if (previousPositions) animateGiftPositions(previousPositions);
        const activeCard = Array.from(list.children).find(card => card.dataset.giftId === entry.id);
        const activeButton = activeCard?.querySelector('.favorite-button');
        if (restoreFocus) activeButton?.focus({ preventScroll: true });
        activeStar = activeButton?.querySelector('.favorite-star');
      } else {
        update(entry.favorite);
      }
      if (animate && entry.favorite && activeStar) {
        activeStar.animate([
          { transform: 'rotate(0deg) scale(1)' },
          { transform: 'rotate(-25deg) scale(1.2)' },
          { transform: 'rotate(21deg) scale(1.2)' },
          { transform: 'rotate(-12deg) scale(1.08)' },
          { transform: 'rotate(0deg) scale(1)' }
        ], { duration: 420, easing: 'ease-out' });
      }
    } catch (error) {
      status.textContent = error.message;
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

function orderForDisplay(gifts) {
  if (ordering) return gifts;
  const direction = { default: 0, "price-asc": 1, "price-desc": -1 }[giftSort.value] ?? 0;
  return [...gifts].sort((a, b) =>
    Number(b.favorite === true) - Number(a.favorite === true) || direction * (a.cents - b.cents)
  );
}

giftSort.addEventListener('change', () => {
  const previousPositions = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? null
    : captureGiftPositions();
  refresh();
  if (previousPositions) animateGiftPositions(previousPositions);
});

function render(gifts) {
  document.querySelector('#count').textContent = gifts.length === 1 ? '1 regalo' : `${gifts.length} regalos`;
  document.querySelector('#empty').hidden = gifts.length > 0;
  const showOrderControls = ordering && gifts.length > 1;
  list.replaceChildren(...orderForDisplay(gifts).map((gift, index) => {
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
    const product = element('a', gift.name, 'gift-link');
    product.href = webUrl(gift.link);
    product.target = '_blank';
    product.rel = 'noopener noreferrer';
    const heading = element('h3', '');
    heading.append(product);
    details.append(heading);
    if (gift.description) details.append(element('p', gift.description, 'description'));
    main.append(details);
    const footer = element('div', '', 'gift-footer');
    if (ordering) {
      const actions = element('div', '', 'actions');
      actions.append(action('Editar', () => editGift(gift)), action('Eliminar', () => removeGift(gift)));
      footer.append(actions);
    } else {
      const hint = element('span', 'Ver producto', 'gift-link-hint');
      hint.setAttribute('aria-hidden', 'true');
      footer.append(hint);
    }
    footer.append(element('span', euros.format(gift.cents / 100), 'price'), favoriteControl(item, gift));
    item.append(main, footer);
    if (showOrderControls) item.append(orderControls(item, gift, index, gifts.length));
    return item;
  }));
}

document.addEventListener('click', event => {
  const previewed = list.querySelector('.gift.is-touch-preview');
  const product = event.target.closest('.gift-link');
  const isTouch = event.pointerType === 'touch' ||
    (!event.pointerType && event.detail > 0 && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  previewed?.classList.remove('is-touch-preview');
  if (!product || !isTouch) return;
  const card = product.closest('.gift');
  if (card === previewed) return;
  event.preventDefault();
  card.classList.add('is-touch-preview');
});

function updateBanner(text) {
  bannerDescription.textContent = text;
  bannerDescription.hidden = ordering || !text;
}

function themeDescription() {
  return birthdayTheme ? 'Guarda los regalos que te haría ilusión recibir en tu cumpleaños.' : defaultBannerDescription;
}

function applyTheme(theme) {
  birthdayTheme = theme === 'birthday';
  document.documentElement.toggleAttribute('data-birthday-theme', birthdayTheme);
  document.querySelector('#occasion-title').textContent = birthdayTheme ? 'cumpleaños' : 'Navidad';
  themePicker.querySelector(birthdayTheme ? '[value="birthday"]' : '[value="christmas"]').checked = true;
  let description = themeDescription();
  try { description = localStorage.getItem(bannerKey()) ?? description; } catch {}
  updateBanner(description);
  bannerText.value = description;
  bannerStatus.textContent = '';
}

themePicker.addEventListener('change', event => {
  applyTheme(event.target.value);
  try { localStorage.setItem(themeKey, event.target.value); } catch {}
  themePicker.open = false;
  themePicker.querySelector('summary').focus();
});

orderToggle.addEventListener('click', () => {
  ordering = !ordering;
  giftSort.disabled = ordering;
  themePicker.hidden = !ordering;
  if (!ordering) themePicker.open = false;
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
    localStorage.setItem(bannerKey(), text);
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

async function persist(gifts, redraw = true) {
  if (!writable) throw new Error('La lista es de solo lectura.');
  if (saving) throw new Error('Hay un guardado en curso. Vuelve a intentarlo en unos segundos.');
  saving = true;
  try {
    const response = await fetch('/regalos.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': revision },
      body: JSON.stringify({ version: 1, gifts, banner: null })
    }).catch(() => null);
    if (response?.status === 412) throw new Error('La lista cambió. Recarga la página antes de volver a guardar.');
    if (!response?.ok) throw new Error('No se pudo guardar la lista en regalos.json.');
    revision = response.headers.get('ETag');
    savedGifts = gifts;
    if (redraw) render(gifts);
  } finally {
    saving = false;
  }
}

async function removeGift(gift) {
  if (!window.confirm(`¿Eliminar «${gift.name}» de tu lista?`)) return;
  try {
    await persist(readGifts().filter(item => item.id !== gift.id));
    if (editing === gift.id) closeForm();
    status.textContent = 'Regalo eliminado.';
    toggle.focus();
  } catch (error) {
    status.textContent = error.message;
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

form.addEventListener('submit', async event => {
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
  form.inert = true;
  try {
    const gifts = readGifts();
    if (editing && !gifts.some(item => item.id === editing)) {
      closeForm();
      status.textContent = 'El regalo ya se ha eliminado.';
      return;
    }
    await persist(editing ? gifts.map(item => item.id === editing ? { ...item, ...gift } : item) : [gift, ...gifts]);
    status.textContent = editing ? 'Cambios guardados.' : 'Regalo añadido.';
    closeForm();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    form.inert = false;
  }
});

function refresh() {
  render(savedGifts);
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

async function loadGifts() {
  try {
    const response = await fetch('/regalos.json', { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const gifts = await response.json();
    savedGifts = validateBackup({ version: 1, gifts, banner: null }).gifts;
    revision = response.headers.get('ETag');
    writable = Boolean(revision) && response.headers.get('X-Regalos-Editable') === 'true';
    if (!writable) loadPublicFavorites();
    refresh();
    exportButton.disabled = false;
    orderToggle.hidden = toggle.hidden = importButton.hidden = !writable;
    if (writable) {
      try {
        applyTheme(localStorage.getItem(themeKey));
      } catch {
        applyTheme(null);
      }
      window.addEventListener('storage', event => {
        if (event.key === themeKey || event.key === null) applyTheme(event.newValue);
        if (event.key === bannerKey()) updateBanner(event.newValue ?? themeDescription());
      });
    } else {
      document.querySelector('#empty h3').textContent = 'Todavía no hay regalos';
      document.querySelector('#empty p').hidden = true;
    }
  } catch {
    status.textContent = 'No se pudo cargar la lista desde regalos.json.';
  }
}
loadGifts();
startSnowfall();
