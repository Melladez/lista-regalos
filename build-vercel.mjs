import { copyFile, mkdir } from 'node:fs/promises';

const output = new URL('./public/', import.meta.url);
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'estilos.css', 'regalos.js', 'datos-regalos.js', 'regalo.svg']) {
  await copyFile(new URL('./src/' + file, import.meta.url), new URL(file, output));
}
await copyFile(new URL('./regalos.json', import.meta.url), new URL('regalos.json', output));
