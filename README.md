# Mi lista de Navidad

La interfaz usa HTML, CSS y JavaScript. El navegador guarda la lista de regalos, su orden, los favoritos y la descripción del banner. La búsqueda de imágenes usa la función `/api/imagen`.

## Compilar

Usa Node.js 24 y ejecuta desde este directorio:

```sh
npm ci
npm run build
```

La interfaz se edita en `src/`. La compilación de Vercel genera `public/`. Para Sites, `node build.mjs` genera `dist/server/index.js`. Ambas salidas se regeneran a partir del código versionado. El despliegue no requiere variables de entorno.

## Publicar en Vercel

1. Sube el repositorio de este directorio (`lista-regalos`) a GitHub. Este directorio tiene su propio historial Git.
2. Importa el repositorio en Vercel. Usa la raíz del repositorio como **Root Directory**.
3. Despliega el proyecto. `vercel.json` configura el preset **Other**, el comando `npm run build` y la salida `public`. Vercel detecta `api/imagen.js` como función de Node.js.

Cada dominio tiene su propio almacenamiento en el navegador. Los regalos guardados en el dominio de Sites seguirán allí y el dominio de Vercel empezará con una lista vacía.
