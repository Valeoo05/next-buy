# NexBuy Importaciones — carpeta para compartir y editar

> **¿Querés publicarla en Netlify?** Seguí los pasos de `SUBIR-A-NETLIFY.md`.

Esta es una copia del código de la versión 15 publicada de NexBuy, con sus imágenes, catálogo inicial y archivos de construcción. Incluye un comando de vista previa para trabajar en una computadora. No incluye contraseñas de producción ni datos privados de clientes.

## Abrir la página actual

- Web: https://nexbuy-importaciones.juanperal05.chatgpt.site
- Stock: https://nexbuy-importaciones.juanperal05.chatgpt.site/stock
- Gestión de productos con el acceso privado del propietario: https://nexbuy-importaciones.juanperal05.chatgpt.site/admin/stock

También podés abrir `ABRIR-WEB.html` para acceder a esos enlaces. Esa página de enlaces no es un editor.

## Ver y modificar una copia en tu computadora

1. Descomprimí el ZIP. Abrí la carpeta `NexBuy-Importaciones` en un editor, por ejemplo VS Code.
2. Instalá **Node.js 24 LTS**, que incluye npm, si todavía no lo tenés: https://nodejs.org/
3. Abrí una terminal dentro de esa carpeta y ejecutá:

   ```sh
   npm run preview:local
   ```

4. Abrí **http://127.0.0.1:3000** en tu navegador. No necesitás instalar dependencias para esta vista previa.
5. Editá los archivos, guardalos, detené el servidor con **Ctrl+C** y volvé a ejecutar el comando para ver los cambios.

El panel local está en **http://127.0.0.1:3000/admin/stock**. La terminal muestra el usuario `admin-local` y una contraseña aleatoria para cada inicio. Estas credenciales funcionan solamente en tu computadora.

La vista previa usa una base local independiente y simula el envío de solicitudes, incluidos los adjuntos: **no manda correos ni modifica la web real**. Tiene un aviso visible para distinguirla de producción. Los enlaces de WhatsApp conservan los contactos del negocio; si hacés clic y enviás un mensaje desde WhatsApp, ese mensaje sí será real.

Las pruebas y ediciones del panel local se guardan en `.local-preview/`. Para empezar otra vez con el catálogo inicial, detené el servidor y borrá solamente esa carpeta. No la agregues a una entrega ni la publiques.

## Dónde hacer cambios

| Parte de la página | Archivos principales |
| --- | --- |
| Portada y contenido principal | `public/index.html` |
| Aspecto Seda | `public/seda.css`, `public/seda-runtime.css`, `public/readability.css` |
| Formulario, pasos y borradores | `public/app.js`, `public/attachments.js` |
| Registro y envío por correo | `public/email-delivery.js`, `worker/index.mjs` |
| Stock, categorías, búsqueda y galería | `public/stock.html`, `public/stock.js` |
| Panel privado de stock | `public/admin-stock.html`, `public/admin-stock.js` |
| Panel privado de solicitudes | `public/admin.html`, `public/admin.js` |
| Imágenes, tipografías y favicon | `public/assets/`, `public/og.png` |
| Catálogo inicial de perfumes | `worker/catalog-import.json` |
| Servidor, seguridad y API | `worker/index.mjs` |
| Esquema y migraciones | `db/schema.ts`, `drizzle/` |

El stock real se administra desde `/admin/stock`. El catálogo JSON sirve para importar productos nuevos que no existan todavía; editarlo no sobrescribe precios ni productos ya guardados. Las migraciones aplicadas no se reescriben: un cambio de esquema requiere una migración nueva.

Se mantienen los contactos actuales: **5492995657073 para stock** y **5492996550378 para compra mayorista y proveedores**.

## Comprobar los cambios

Para las comprobaciones completas, instalá las dependencias y ejecutá:

```sh
npm ci
npm run check
npm run build
npm run verify
```

Las verificaciones usan bases de prueba aisladas y no envían correos reales. `scripts/verify-images.mjs` es una comprobación adicional que usa Sharp y no está incluida en las dependencias mínimas de este proyecto.

## Modificar la web publicada

**Compartir esta carpeta no concede acceso de edición al proyecto alojado.** Los cambios locales tampoco se sincronizan automáticamente. Para diseño y código, tu amigo puede devolverte la carpeta modificada para que el propietario revise y publique los cambios en el mismo proyecto.

La herramienta de alojamiento admite editores del mismo espacio de trabajo. Un invitado externo con permiso de visitante puede ver el sitio, pero ese permiso no le permite editarlo ni publicarlo. Si se quiere dar acceso de editor, primero hay que comprobar que la cuenta de tu amigo pueda añadirse como editor en ese espacio. No compartas tu cuenta de ChatGPT ni tus contraseñas.

Si tu amigo solo necesita cargar productos, fotos o precios, puede utilizar el panel `/admin/stock` con un acceso de administración autorizado; no necesita modificar el código. Esta carpeta no contiene ese acceso de producción ni crea uno nuevo.

El archivo `.openai/hosting.json` identifica el proyecto existente. Debe conservarse si los cambios se van a publicar en NexBuy. La carpeta `cloudflare/` contiene una alternativa de publicación preparada anteriormente; no se necesita para la vista previa ni sustituye el servidor y la base reales.

## Contenido y alcance de la entrega

- Código e imágenes de la versión publicada, incluyendo los 15 perfumes.
- Configuración y migraciones necesarias para construir el proyecto.
- Guía y vista previa local añadidas solo a esta entrega.
- Sin historial Git, sesiones, credenciales de producción, dependencias descargadas ni exportación de solicitudes de clientes.

La base de producción y las imágenes que se hayan subido al panel después del catálogo inicial viven en el alojamiento, no en esta copia de código. La vista previa muestra el catálogo inicial incluido y los productos que crees localmente.
