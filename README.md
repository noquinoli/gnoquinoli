# Landing de Ventas para Redes Sociales

Esta pagina esta pensada para publicar en Instagram, Facebook, TikTok o anuncios con un enlace directo.

## Como actualizar precios y detalles en 1 minuto

El gestor no se muestra al publico por defecto.

1. Abre la pagina en el navegador.
2. Entra en modo gestion con `?admin=1` al final de la URL.
   - Ejemplo local: `index.html?admin=1`
   - Ejemplo publicado: `https://tu-dominio.com/?admin=1`
3. Ve a la seccion **Gestor Rapido de Contenido**.
4. Crea o selecciona un catalogo (ej: Ropa, Accesorios, Calzado).
5. Puedes usar 2 metodos:
   - Editar el JSON completo y pulsar **Aplicar JSON**.
   - Cargar un producto nuevo con el formulario **Agregar producto** (incluye URL de imagen opcional).
6. Opcional: pulsa **Descargar JSON** para guardar respaldo.

## Datos iniciales

El contenido base vive en `data.js` dentro de `window.SALES_DATA`.

Si quieres dejar valores fijos para todos los navegadores, edita:

- Marca y texto principal: `brand`, `heroText`
- Moneda/simbolo: `currency`
- WhatsApp: `contact.whatsapp` (sin simbolos, ejemplo: 5491112345678)
- Pie de pagina: `contact.footerMessage`
- Catalogos por tipo: `catalogs`
- Catalogo activo inicial: `activeCatalogId`

### Cambiar simbolo de moneda

Edita `currency` en `data.js`:

```js
currency: {
   locale: "es-AR",
   code: "ARS",
   decimals: 0,
   symbol: "$"
}
```

Ejemplos rapidos:

- Dolar: `locale: "en-US"`, `code: "USD"`, `symbol: "$"`
- Euro: `locale: "es-ES"`, `code: "EUR"`, `symbol: "€"`
- Peso chileno: `locale: "es-CL"`, `code: "CLP"`, `symbol: "$"`

Si prefieres que se muestre el simbolo automatico por pais, elimina `symbol` y se usara el formato estandar de `locale` + `code`.

### Estructura recomendada por catalogo

```json
{
   "id": "ropa",
   "name": "Ropa",
   "products": [
      {
         "name": "Nombre",
         "price": 49990,
         "oldPrice": 59990,
         "image": "https://tu-sitio.com/producto.jpg",
         "details": ["Detalle 1", "Detalle 2"],
         "ctaText": "Comprar por WhatsApp",
         "defaultAction": "consultar"
      }
   ]
}
```

Valores permitidos para `defaultAction`:

- `consultar`
- `reservar`
- `quiero`
- `comprar`

### Estructura general (resumen)

```json
{
   "brand": "LE GARAGE",
   "currency": { "locale": "es-BO", "code": "BOB", "decimals": 0, "symbol": "$" },
   "heroText": "...",
   "contact": { "whatsapp": "59178463301", "footerMessage": "..." },
   "activeCatalogId": "ropa",
   "catalogs": []
}
```

## Publicacion recomendada

1. Sube estos archivos a un hosting estatico (Netlify, Vercel, GitHub Pages, etc.).
2. Usa la URL publica en tu bio, historias o anuncios.
3. Cada vez que cambies productos desde el gestor, descarga JSON y guarda copia.
4. Si quieres cambios permanentes globales, actualiza `data.js` con ese JSON y vuelve a publicar.

## Archivos principales

- `index.html`: estructura de la landing.
- `styles.css`: estilo visual responsive.
- `data.js`: datos base editables.
- `app.js`: renderizado y gestor de contenido.
