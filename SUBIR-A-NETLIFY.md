# Cómo publicar NexBuy en Netlify

## Cómo queda armado

- **Netlify** sirve la web (portada, stock, imágenes, estilos). Es gratis y rápido.
- **El servidor original** (`nexbuy-importaciones.juanperal05.chatgpt.site`) sigue guardando
  la base de datos: productos, precios, fotos subidas desde el panel, solicitudes de clientes y
  la contraseña del administrador.
- Una pequeña función de Netlify (`netlify/edge-functions/nexbuy-proxy.js`) conecta las dos
  cosas. El visitante solo ve la dirección de Netlify y todo funciona igual: formulario,
  stock, `/admin` y `/admin/stock`, con el mismo usuario y contraseña de siempre.

> ⚠️ **No borres ni hagas privado el sitio de ChatGPT.** Si se elimina, la web en Netlify se
> sigue viendo pero el stock, el formulario y el panel dejan de funcionar.

## Publicar (opción recomendada: GitHub + Netlify)

1. Creá una cuenta en https://github.com y un repositorio nuevo (puede ser privado).
2. Subí **todo el contenido de esta carpeta** al repositorio (en GitHub: *Add file → Upload files*,
   arrastrás los archivos y carpetas, y *Commit changes*).
3. Entrá a https://app.netlify.com → **Add new site → Import an existing project → GitHub**
   y elegí el repositorio.
4. Netlify lee solo la configuración de `netlify.toml`. No cambies nada y tocá **Deploy**.
5. En *Site configuration → Change site name* podés elegir el nombre (por ejemplo
   `nexbuy-importaciones.netlify.app`). Después hacé **Deploys → Trigger deploy** para que
   los enlaces para compartir en WhatsApp/redes usen el nombre nuevo.

Cada vez que cambies algo en GitHub, Netlify vuelve a publicar solo.

### Alternativa sin GitHub (desde la terminal)

Con Node.js instalado, dentro de esta carpeta:

```sh
npx netlify-cli login
npx netlify-cli deploy --build --prod
```

La primera vez te pregunta si querés crear un sitio nuevo: decí que sí y elegí el nombre.

> ❌ **No uses "arrastrar y soltar" (Netlify Drop):** ese método no sube la función que conecta
> con el servidor, y el formulario, el stock y el panel no funcionarían.

## Después de publicar, revisá

- [ ] La portada y `/stock` cargan con los 15 perfumes y sus fotos.
- [ ] `/admin` muestra el inicio de sesión y entrás con el usuario y contraseña de siempre.
- [ ] Mandá **una** solicitud de prueba desde el formulario (aclarando que es una prueba).
  FormSubmit puede mandar un mail de activación a juanperal05@gmail.com por ser un dominio
  nuevo: hay que abrirlo y confirmarlo una vez.

## Bueno saber

- Los borradores del formulario que cada cliente tenía guardados en su navegador quedan en la
  dirección vieja (es por dominio).
- Si conectás un dominio propio (ej. `nexbuy.com.ar`) en *Domain management*, hacé un
  *Trigger deploy* después para que los enlaces para compartir lo usen.
- Para probar los cambios antes de subirlos: `npm run build && node scripts/build-netlify.mjs https://prueba.netlify.app && node scripts/verify-netlify.mjs`
  (no manda correos ni toca la web real).
