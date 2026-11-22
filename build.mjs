import { mkdir, readFile, writeFile } from 'node:fs/promises';

const files = [
  ['/', 'index.html', 'text/html'],
  ['/estilos.css', 'estilos.css', 'text/css'],
  ['/regalos.js', 'regalos.js', 'text/javascript']
];
const assets = await Promise.all(files.map(async ([path, file, type]) => [
  path, { type, body: await readFile(new URL('./dist/' + file, import.meta.url), 'utf8') }
]));
const worker = await readFile(new URL('./worker.mjs', import.meta.url), 'utf8');
const output = new URL('./dist/server/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('index.js', output), 'const assets = new Map(' + JSON.stringify(assets) + ');\n' + worker);
