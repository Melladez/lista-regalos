const storageKey = 'mi-lista-de-regalos';
const form = document.querySelector('#gift-form');
const { name: nameField, link, price, description } = form.elements;
const list = document.querySelector('#gifts');
const status = document.querySelector('#status');
const panel = document.querySelector('#gift-panel');
const toggle = document.querySelector('#form-toggle');
const title = document.querySelector('#form-title');
const save = document.querySelector('#save');
const cancel = document.querySelector('#cancel');
const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
let editing = null;

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

function render(gifts) {
  document.querySelector('#count').textContent = gifts.length === 1 ? '1 regalo' : `${gifts.length} regalos`;
  document.querySelector('#empty').hidden = gifts.length > 0;
  list.replaceChildren(...gifts.map(gift => {
    const item = element('li', '', 'gift');
    const heading = element('div', '', 'gift-title');
    heading.append(element('h3', gift.name), element('span', euros.format(gift.cents / 100), 'price'));
    item.append(heading);
    if (gift.description) item.append(element('p', gift.description, 'description'));
    const actions = element('div', '', 'actions');
    const product = element('a', 'Ver producto', 'product');
    product.href = webUrl(gift.link);
    product.target = '_blank';
    product.rel = 'noopener noreferrer';
    actions.append(product, action('Editar', () => editGift(gift)), action('Eliminar', () => removeGift(gift)));
    item.append(actions);
    return item;
  }));
}

function resetForm() {
  editing = null;
  form.reset();
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
  const gift = {
    id: editing ?? crypto.randomUUID(),
    name,
    link: url,
    cents,
    description: description.value.trim()
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
    status.textContent = 'No se pudo guardar el regalo en este navegador.';
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
