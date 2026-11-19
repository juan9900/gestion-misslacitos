# Miss Lacitoss · gestión

App web para el celular, de un solo archivo, para manejar el emprendimiento Miss Lacitoss (accesorios para niñas).

- **Pedidos y ventas**: clienta, productos, abonos, cobros y entregas.
- **Inventario**: precio, costo, piezas hechas o por encargo. El stock se descuenta solo con cada pedido.
- **Clientas**: teléfono, dirección, Instagram y notas, con botón directo a WhatsApp.
- **Dinero**: entró, gasté e invertí, con el corte mensual (WhatsApp o PDF) y lo recuperado de la inversión.
- **Copia de seguridad** en un archivo JSON.

## Cómo funciona

- Todo vive en `index.html`; no hay que compilar nada.
- Los datos se guardan **solo en el teléfono** (`localStorage`, clave `negocio`). Los montos se guardan en centavos.
- Si encuentra datos de la versión anterior, los convierte solos y guarda el original en `negocio_v1_respaldo`.
- `manifest.webmanifest` y `sw.js` permiten instalarla en la pantalla de inicio y abrirla sin internet. Esto necesita HTTPS, por ejemplo GitHub Pages.
- Cuando publiques cambios, sube el número de `VERSION` en `sw.js`.

## Publicar en Netlify

1. En Netlify: **Add new site → Import an existing project → GitHub** y elige este repositorio.
2. No hay que cambiar nada: `netlify.toml` ya indica que no hay build y que se publica la raíz.
3. Cada push a `main` se publica solo.
4. En el teléfono, abre el enlace y toca **Agregar a pantalla de inicio**.

## Privacidad

No subas al repositorio copias de seguridad (`copia-*.json`). Contienen datos de las clientas.
