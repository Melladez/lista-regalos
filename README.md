# Mi lista de Navidad

La interfaz usa HTML, CSS y JavaScript. El archivo `regalos.json` guarda los regalos, su orden y los favoritos. La descripción del banner de edición se guarda en el navegador. La búsqueda de imágenes usa la función `/api/imagen`.

## Editar en local

Con Node.js 24, ejecuta estos comandos desde la raíz del proyecto:

```sh
npm ci
npm run dev
```

Abre [la lista local](http://127.0.0.1:3000). Añade un regalo y recarga la página para comprobar que sigue ahí. Edita o elimina el regalo y vuelve a recargar para comprobar que los cambios se guardaron. Puedes ver el resultado en `regalos.json`.

Si ya tienes regalos guardados en la versión anterior, usa **Exportar lista** allí antes de desplegar esta versión y después **Importar lista** en el servidor local. La importación añade los regalos que faltan y guarda el resultado en `regalos.json`. La opción **Exportar lista** está disponible tanto en local como en la web publicada.

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

Incluye `regalos.json` en el commit junto con los cambios de código. Para publicar, integra los cambios de `develop` en `main` y sube `main` al remoto. Con `main` configurada como rama de producción, Vercel desplegará el commit y servirá una copia de `regalos.json` de solo lectura.
