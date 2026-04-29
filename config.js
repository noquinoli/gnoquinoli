/**
 * ╔══════════════════════════════════════════════════════╗
 * ║              CONFIGURACIÓN DEL SITIO                 ║
 * ║  Editá este archivo para adaptar a un nuevo negocio  ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * También editá:
 *   - data.js      → nombre del negocio, menú, contacto, textos
 *   - index.html   → <title> y <meta name="description">
 *   - assets/brand → logo e imágenes de la marca
 */

window.SITE_CONFIG = {

  // ── GitHub Pages ───────────────────────────────────────────────────────────
  // Para publicar el catálogo remotamente desde el panel de admin.
  // Formato: "usuario_github/nombre_repositorio"
  githubRepo: "noquinoli/gnoquinoli",

  // URL base donde está publicada la página (sin barra final)
  // Formato GitHub Pages: "https://usuario.github.io/repositorio"
  githubPageBase: "https://noquinoli.github.io/gnoquinoli",

  // ── Almacenamiento local ───────────────────────────────────────────────────
  // Claves únicas para localStorage / sessionStorage.
  // IMPORTANTE: Cambiá estos valores si corrés dos instancias en el mismo dominio,
  // para que no se mezclen los datos.
  storageKey:     "noquinoliMenuV2",
  imgCacheKey:    "noquinoliImgCache",
  adminAuthKey:   "noquinoliAdminAuth",
  unlockedKey:    "noquinoliUnlockedGroups",

  // ── Logo por defecto ───────────────────────────────────────────────────────
  // Ruta relativa al logo que se muestra si no hay uno subido desde el admin.
  defaultLogo: "assets/brand/logo-noquinoli-sello-trans.webp",

};
