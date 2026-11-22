const storageKey = 'mi-lista-de-regalos';
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
  for (const [label, symbol, step] of [['Subir', '↑', -1], ['Bajar', '↓', 1]]) {
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

function render(gifts) {
  document.querySelector('#count').textContent = gifts.length === 1 ? '1 regalo' : `${gifts.length} regalos`;
  document.querySelector('#empty').hidden = gifts.length > 0;
  orderToggle.disabled = gifts.length < 2;
  if (orderToggle.disabled) ordering = false;
  orderToggle.setAttribute('aria-pressed', String(ordering));
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
    if (!ordering) footer.append(actions);
    footer.append(element('span', euros.format(gift.cents / 100), 'price'));
    item.append(main, footer);
    if (ordering) item.append(orderControls(item, gift, index, gifts.length));
    return item;
  }));
}

orderToggle.addEventListener('click', () => {
  ordering = !ordering;
  refresh();
  status.textContent = ordering ? 'Usa los botones para subir o bajar regalos, o arrastra el tirador.' : '';
});

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
    persist(editing ? gifts.map(item => item.id === editing ? gift : item) : [gift, ...gifts]);
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

window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) refresh();
});
refresh();
