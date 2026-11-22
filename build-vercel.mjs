import { copyFile, mkdir } from 'node:fs/promises';

const output = new URL('./public/', import.meta.url);
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'estilos.css', 'regalos.js']) {
  await copyFile(new URL('./src/' + file, import.meta.url), new URL(file, output));
}
