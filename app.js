const STORAGE_KEY = "noquinoliMenuV2";
const CATALOG_FILE = "catalogo.json";
const IMG_CACHE_KEY = "noquinoliImgCache";

// Cache imagen: publicUrl -> dataUrl. Se persiste en sessionStorage para sobrevivir recargas.
const imageCache = {};
try {
  const saved = sessionStorage.getItem(IMG_CACHE_KEY);
  if (saved) Object.assign(imageCache, JSON.parse(saved));
} catch (_) {}

function saveImageCache() {
  try {
    sessionStorage.setItem(IMG_CACHE_KEY, JSON.stringify(imageCache));
  } catch (_) {
    // sessionStorage lleno: limpiar entradas mas antiguas
    const keys = Object.keys(imageCache);
    if (keys.length > 0) {
      delete imageCache[keys[0]];
      try { sessionStorage.setItem(IMG_CACHE_KEY, JSON.stringify(imageCache)); } catch (_2) {}
    }
  }
}

const defaultData = window.SALES_DATA;

const ACTION_OPTIONS = [
  { key: "consultar", label: "Consultar" },
  { key: "reservar", label: "Reservar" },
  { key: "quiero", label: "Ofertar" },
  { key: "comprar", label: "Comprar" },
];

const heroTextEl = document.getElementById("heroText");
const updatedAtEl = document.getElementById("updatedAt");
const catalogTabsEl = document.getElementById("catalogTabs");
const productsGridEl = document.getElementById("productsGrid");
const mainCtaEl = document.getElementById("mainCta");
const footerTextEl = document.getElementById("footerText");
const waFloatEl = document.getElementById("waFloat");
const managerEl = document.getElementById("gestor");
const isAdminView = new URLSearchParams(window.location.search).get("admin") === "1";

const ADMIN_PASSWORD = "1114";
const ADMIN_AUTH_KEY = "noquinoliAdminAuth";

function isAdminAuthenticated() {
  return sessionStorage.getItem(ADMIN_AUTH_KEY) === "ok";
}

if (!isAdminView) {
  if (managerEl) managerEl.remove();
} else if (!isAdminAuthenticated()) {
  if (managerEl) managerEl.style.display = "none";
  const gateEl = document.getElementById("adminGate");
  if (gateEl) gateEl.style.display = "flex";
  document.getElementById("adminGateForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("adminGateInput")?.value ?? "";
    if (input === ADMIN_PASSWORD) {
      sessionStorage.setItem(ADMIN_AUTH_KEY, "ok");
      if (gateEl) gateEl.style.display = "none";
      if (managerEl) managerEl.style.display = "";
      bindAdminEvents();
      render();
    } else {
      const errEl = document.getElementById("adminGateError");
      if (errEl) errEl.style.display = "block";
      document.getElementById("adminGateInput").value = "";
      document.getElementById("adminGateInput").focus();
    }
  });
}

let state = normalizeData(structuredClone(defaultData));

function createCurrencyFormatters(currencyConfig = {}) {
  const locale = currencyConfig.locale || "es-AR";
  const code = currencyConfig.code || "ARS";
  const decimals = Number.isInteger(currencyConfig.decimals)
    ? currencyConfig.decimals
    : 0;

  return {
    currencyFormatter: new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    }),
    numberFormatter: new Intl.NumberFormat(locale, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    }),
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function normalizeAction(action) {
  const safeAction = typeof action === "string" ? action.toLowerCase() : "";
  return ACTION_OPTIONS.some((item) => item.key === safeAction)
    ? safeAction
    : "consultar";
}

function getActionLabel(action) {
  const match = ACTION_OPTIONS.find((item) => item.key === action);
  return match ? match.label : "Consultar";
}

function normalizeCatalog(catalog, fallbackId, fallbackName) {
  const id = slugify(catalog?.id || fallbackId || "catalogo") || "catalogo";
  const name = String(catalog?.name || fallbackName || "Catalogo").trim();
  const products = Array.isArray(catalog?.products) ? catalog.products : [];

  return {
    id,
    name,
    products,
  };
}

function normalizeData(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("El JSON debe ser un objeto.");
  }

  const normalized = {
    brand: raw.brand || "Tienda",
    currency: raw.currency || {
      locale: "es-AR",
      code: "ARS",
      decimals: 0,
      symbol: "$",
    },
    heroText: raw.heroText || "",
    tagLine: raw.tagLine || "PASTA ARTESANAL | ENTREGA A DOMICILIO",
    heroTitle: raw.heroTitle || "El sabor de siempre, en tu puerta",
    mainCtaText: raw.mainCtaText || "Ver catalogo",
    sectionTitle: raw.sectionTitle || "Nuestro men\u00fa",
    sectionSubtitle: raw.sectionSubtitle || "Pasta artesanal, salsas caseras y pedidos directos por WhatsApp.",
    contact: {
      whatsapp: raw.contact?.whatsapp || "",
      footerMessage: raw.contact?.footerMessage || "",
    },
    catalogs: [],
    activeCatalogId: "",
    theme: {
      accent:     raw.theme?.accent     || "#dd1c23",
      accentDark: raw.theme?.accentDark || "#b5161d",
      deep:       raw.theme?.deep       || "#154729",
      bg:         raw.theme?.bg         || "#f7ebdc",
      card:       raw.theme?.card       || "#fffdf7",
      ink:        raw.theme?.ink        || "#1f1f1f",
      ok:         raw.theme?.ok         || "#00ce8b",
      fontTitles: raw.theme?.fontTitles || "'Vollkorn', serif",
      fontBody:   raw.theme?.fontBody   || "'Montserrat', sans-serif",
    },
    logoUrl: raw.logoUrl || "",
  };

  if (Array.isArray(raw.catalogs) && raw.catalogs.length > 0) {
    normalized.catalogs = raw.catalogs.map((catalog, index) =>
      normalizeCatalog(catalog, `catalogo-${index + 1}`, `Catalogo ${index + 1}`)
    );
  } else if (Array.isArray(raw.products)) {
    normalized.catalogs = [
      normalizeCatalog(
        {
          id: "general",
          name: "General",
          products: raw.products,
        },
        "general",
        "General"
      ),
    ];
  }

  if (normalized.catalogs.length === 0) {
    normalized.catalogs = [
      {
        id: "general",
        name: "General",
        products: [],
      },
    ];
  }

  const dedup = new Set();
  normalized.catalogs = normalized.catalogs.map((catalog) => {
    let id = catalog.id;
    let suffix = 2;
    while (dedup.has(id)) {
      id = `${catalog.id}-${suffix}`;
      suffix += 1;
    }
    dedup.add(id);
    return {
      ...catalog,
      id,
    };
  });

  const requestedActiveId = raw.activeCatalogId;
  const activeExists = normalized.catalogs.some(
    (catalog) => catalog.id === requestedActiveId
  );
  normalized.activeCatalogId = activeExists
    ? requestedActiveId
    : normalized.catalogs[0].id;

  return normalized;
}

function validateData(data) {
  normalizeData(data);
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function syncStateFromStorage(event) {
  if (event.key !== STORAGE_KEY || !event.newValue) {
    return;
  }

  try {
    const parsed = JSON.parse(event.newValue);
    state = normalizeData(parsed);
    render();
  } catch (error) {
    console.warn("No se pudo sincronizar cambios en vivo:", error);
  }
}

function loadData(baseData) {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return normalizeData(structuredClone(baseData));

  try {
    const parsed = JSON.parse(saved);
    // Limpiar dataUrls enormes que quedaron de versiones anteriores
    if (Array.isArray(parsed.catalogs)) {
      parsed.catalogs.forEach(cat => {
        if (Array.isArray(cat.products)) {
          cat.products.forEach(p => {
            if (typeof p.image === "string" && p.image.startsWith("data:") && p.image.length > 50000) {
              p.image = ""; // Forzar re-subida con la nueva versiÃƒÂ³n
            }
          });
        }
      });
    }
    return normalizeData(parsed);
  } catch (error) {
    console.error("No se pudo cargar el contenido guardado:", error);
    return normalizeData(structuredClone(baseData));
  }
}

async function loadRemoteCatalog() {
  if (window.location.protocol === "file:") {
    return null;
  }

  try {
    const url = `${CATALOG_FILE}?v=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const parsed = await response.json();
    return normalizeData(parsed);
  } catch (error) {
    console.warn("No se pudo cargar catalogo.json, usando fallback:", error);
    return null;
  }
}

function formatMoney(amount) {
  const value = Number(amount);
  const safeAmount = Number.isFinite(value) ? value : 0;
  const { currencyFormatter, numberFormatter } = createCurrencyFormatters(
    state.currency
  );

  if (state.currency?.symbol) {
    return `${state.currency.symbol}${numberFormatter.format(safeAmount)}`;
  }

  return currencyFormatter.format(safeAmount);
}

function getActiveCatalog() {
  return (
    state.catalogs.find((catalog) => catalog.id === state.activeCatalogId) ||
    state.catalogs[0]
  );
}

function setActiveCatalog(catalogId) {
  const exists = state.catalogs.some((catalog) => catalog.id === catalogId);
  if (exists) {
    state.activeCatalogId = catalogId;
  }
}

function buildWhatsAppMessage(product, action) {
  const priceText = formatMoney(product.price);

  switch (action) {
    case "reservar":
      return `Hola! Quiero reservar ${product.name} por ${priceText}.`;
    case "quiero":
      return `Hola! Lo quiero: ${product.name} por ${priceText}.`;
    case "comprar":
      return `Hola! Quiero comprar ${product.name} por ${priceText}.`;
    default:
      return `Hola! Quiero consultar por ${product.name} a ${priceText}.`;
  }
}

function buildWhatsAppLink(product, action) {
  const message = encodeURIComponent(buildWhatsAppMessage(product, action));
  return `https://wa.me/${state.contact.whatsapp}?text=${message}`;
}

function createProductCard(product, index) {
  const details = (Array.isArray(product.details) ? product.details : [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  const images = typeof product.image === "string" && product.image.trim().length > 0
    ? (product.image.startsWith("data:")
        ? [product.image]   // dataUrl directo (legacy o sin token)
        : product.image.split(",").map(s => s.trim()).filter(Boolean).map(u => imageCache[u] || u))
    : [];

  const imageMarkup = images.length === 0
    ? '<div class="media-placeholder">Sin imagen</div>'
    : images.length === 1
      ? `<img class="product-image" src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')" /><div class="media-placeholder" style="display:none">Imagen no disponible aun</div>`
      : `<div class="carousel" data-current="0">
          ${images.map((src, i) => `<img class="product-image carousel-slide${i === 0 ? " active" : ""}" src="${escapeHtml(src)}" alt="${escapeHtml(product.name)} ${i + 1}" loading="lazy" />`).join("")}
          <button class="carousel-btn carousel-prev" type="button" aria-label="Anterior">&#8249;</button>
          <button class="carousel-btn carousel-next" type="button" aria-label="Siguiente">&#8250;</button>
          <div class="carousel-dots">${images.map((_, i) => `<span class="carousel-dot${i === 0 ? " active" : ""}"></span>`).join("")}</div>
        </div>`;

  const defaultAction = normalizeAction(product.defaultAction);

  const actionChecks = ACTION_OPTIONS.map(
    (option) => `
      <label class="action-chip">
        <input
          type="radio"
          class="action-input"
          name="action-${index}"
          value="${option.key}"
          ${option.key === defaultAction ? "checked" : ""}
        />
        <span>${option.label}</span>
      </label>
    `
  ).join("");

  const oldPrice =
    typeof product.oldPrice === "number"
      ? `<p class="old-price">Antes ${formatMoney(product.oldPrice)}</p>`
      : "";

  const status = product.productStatus || (product.soldOut ? "vendido" : "activo");
  const isUnavailable = status === "vendido" || status === "agotado" || status === "oculto";

  const PILL_CONFIG = {
    activo:  { text: "Oferta activa", css: "pill" },
    vendido: { text: "Vendido",       css: "pill pill--sold" },
    agotado: { text: "Agotado",       css: "pill pill--out" },
    oculto:  { text: "Oculto",        css: "pill pill--out" },
  };
  const pillCfg = PILL_CONFIG[status] || PILL_CONFIG.activo;
  const pill = `<p class="${pillCfg.css}">${pillCfg.text}</p>`;

  const ctaMarkup = isUnavailable
    ? `<span class="card-cta card-cta--sold">${pillCfg.text}</span>`
    : `<a
        class="card-cta"
        target="_blank"
        rel="noopener noreferrer"
        href="${buildWhatsAppLink(product, defaultAction)}"
      >
        ${getActionLabel(defaultAction)} por WhatsApp
      </a>`;

  return `
    <article class="product-card${isUnavailable ? " product-card--sold" : ""}${status === "oculto" && isAdminView ? " product-card--hidden" : ""}" data-product-index="${index}">
      <div class="product-media">${imageMarkup}</div>
      ${pill}
      <h3>${escapeHtml(product.name)}</h3>
      ${oldPrice}
      <p class="price">${formatMoney(product.price)}</p>
      <ul>${details}</ul>
      <div class="action-checks${isUnavailable ? " action-checks--disabled" : ""}" aria-label="Tipo de consulta">
        ${actionChecks}
      </div>
      ${ctaMarkup}
    </article>
  `;
}

function renderCatalogTabs() {
  const tabs = state.catalogs
    .map((catalog) => {
      const activeClass =
        catalog.id === state.activeCatalogId ? "catalog-tab active" : "catalog-tab";

      return `
        <button type="button" class="${activeClass}" data-catalog-id="${escapeHtml(
          catalog.id
        )}">
          ${escapeHtml(catalog.name)}
        </button>
      `;
    })
    .join("");

  catalogTabsEl.innerHTML = tabs;
}

function renderCatalogSelect() {
  const catalogSelectEl = document.getElementById("catalogSelect");
  if (!catalogSelectEl) {
    return;
  }

  catalogSelectEl.innerHTML = state.catalogs
    .map(
      (catalog) =>
        `<option value="${escapeHtml(catalog.id)}" ${
          catalog.id === state.activeCatalogId ? "selected" : ""
        }>${escapeHtml(catalog.name)}</option>`
    )
    .join("");
}

function renderAdminProductTools() {
  const editProductSelectEl = document.getElementById("editProductSelect");
  const moveCatalogSelectEl = document.getElementById("moveCatalogSelect");

  if (!editProductSelectEl || !moveCatalogSelectEl) {
    return;
  }

  const activeCatalog = getActiveCatalog();

  editProductSelectEl.innerHTML = activeCatalog.products
    .map(
      (product, index) =>
        `<option value="${index}">${index + 1}. ${escapeHtml(product.name)}${product.productStatus === "oculto" ? " (oculto)" : ""}</option>`
    )
    .join("");

  if (activeCatalog.products.length === 0) {
    editProductSelectEl.innerHTML = '<option value="">Sin productos</option>';
  }

  moveCatalogSelectEl.innerHTML = state.catalogs
    .map(
      (catalog) =>
        `<option value="${escapeHtml(catalog.id)}" ${
          catalog.id === state.activeCatalogId ? "selected" : ""
        }>${escapeHtml(catalog.name)}</option>`
    )
    .join("");
}

function collectProductFromForm() {
  const name = document.getElementById("name").value.trim();
  const price = Number(document.getElementById("price").value);
  const oldPriceValue = document.getElementById("oldPrice").value;
  const detailsRaw = document.getElementById("details").value.trim();
  const image = document.getElementById("image").value.trim();
  const ctaText = document.getElementById("ctaText").value.trim();
  const defaultAction = normalizeAction(document.getElementById("defaultAction").value);
  const productStatus = document.getElementById("productStatus").value || "activo";

  if (!name || !detailsRaw || Number.isNaN(price)) {
    throw new Error("Completa nombre, precio y detalles.");
  }

  const details = detailsRaw
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const product = {
    name,
    price,
    details,
    ctaText: ctaText || "Comprar ahora",
    defaultAction,
    productStatus,
  };

  if (oldPriceValue) {
    product.oldPrice = Number(oldPriceValue);
  }

  if (image) {
    product.image = image;
  }

  return product;
}

function renderImagePreviews(imageValue) {
  const container = document.getElementById("imagePreviews");
  if (!container) return;
  container.innerHTML = "";
  if (!imageValue) return;
  const urls = imageValue.split(",").map(s => s.trim()).filter(Boolean);
  urls.forEach((url) => {
    const img = document.createElement("img");
    img.src = imageCache[url] || url;
    img.alt = "Vista previa";
    img.style.cssText = "max-height:100px;max-width:120px;border-radius:8px;object-fit:cover;border:1px solid var(--line);";
    container.appendChild(img);
  });
}

function fillFormWithProduct(product) {
  document.getElementById("name").value = product.name || "";
  document.getElementById("price").value = Number(product.price) || 0;
  document.getElementById("oldPrice").value =
    typeof product.oldPrice === "number" ? product.oldPrice : "";
  document.getElementById("details").value = Array.isArray(product.details)
    ? product.details.join("\n")
    : "";
  const imgVal = product.image || "";
  document.getElementById("image").value = imgVal;
  // Mostrar previews de todas las imagens del producto
  renderImagePreviews(imgVal);
  document.getElementById("ctaText").value = product.ctaText || "";
  document.getElementById("defaultAction").value = normalizeAction(product.defaultAction);
  document.getElementById("productStatus").value = product.productStatus || (product.soldOut ? "vendido" : "activo");
}

function applyTheme() {
  const t = state.theme;
  const root = document.documentElement;
  root.style.setProperty("--accent", t.accent);
  root.style.setProperty("--accent-dark", t.accentDark);
  root.style.setProperty("--deep", t.deep);
  root.style.setProperty("--bg", t.bg);
  root.style.setProperty("--card", t.card);
  root.style.setProperty("--ink", t.ink);
  root.style.setProperty("--ok", t.ok);
  root.style.setProperty("--font-titles", t.fontTitles);
  root.style.setProperty("--font-body", t.fontBody);
  document.body.style.fontFamily = t.fontBody;
  document.querySelectorAll("h1,h2,h3").forEach(el => el.style.fontFamily = t.fontTitles);
}

function render() {
  applyTheme();
  const activeCatalog = getActiveCatalog();
  document.title = `Menu | ${state.brand}`;

  // Logo
  const logoImgEl = document.querySelector(".brand-logo");
  if (logoImgEl) {
    logoImgEl.src = state.logoUrl || "assets/brand/logo-noquinoli-sello.webp?v=20260422";
  }
  const tagLineEl = document.getElementById("tagLine");
  const heroTitleEl = document.getElementById("heroTitle");
  const sectionTitleEl = document.getElementById("sectionTitle");
  const sectionSubtitleEl = document.getElementById("sectionSubtitle");
  if (tagLineEl) tagLineEl.textContent = state.tagLine || "";
  if (heroTitleEl) heroTitleEl.textContent = state.heroTitle || "";
  if (sectionTitleEl) sectionTitleEl.textContent = state.sectionTitle || "";
  if (sectionSubtitleEl) sectionSubtitleEl.textContent = state.sectionSubtitle || "";
  heroTextEl.textContent = state.heroText || "";
  footerTextEl.textContent = state.contact?.footerMessage || "";
  mainCtaEl.textContent = state.mainCtaText || "Ver catalogo";
  mainCtaEl.href = "#productos";
  waFloatEl.href = `https://wa.me/${state.contact.whatsapp}`;

  renderCatalogTabs();
  productsGridEl.innerHTML = activeCatalog.products
    .filter((product) => isAdminView || product.productStatus !== "oculto")
    .map((product, index) => createProductCard(product, index))
    .join("");

  if (isAdminView) {
    renderCatalogSelect();
    renderAdminProductTools();
    const jsonInputEl = document.getElementById("jsonInput");
    if (jsonInputEl) {
      jsonInputEl.value = JSON.stringify(state, null, 2);
    }
    const colorFields = {
      colorAccent:     state.theme.accent,
      colorAccentDark: state.theme.accentDark,
      colorDeep:       state.theme.deep,
      colorBg:         state.theme.bg,
      colorCard:       state.theme.card,
      colorInk:        state.theme.ink,
      colorOk:         state.theme.ok,
    };
    Object.entries(colorFields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });
    const fontTitlesEl = document.getElementById("fontTitles");
    const fontBodyEl = document.getElementById("fontBody");
    if (fontTitlesEl) fontTitlesEl.value = state.theme.fontTitles;
    if (fontBodyEl) fontBodyEl.value = state.theme.fontBody;
    const logoPreviewAdmin = document.getElementById("logoPreviewAdmin");
    if (logoPreviewAdmin) {
      logoPreviewAdmin.src = state.logoUrl || "assets/brand/logo-noquinoli-sello.webp?v=20260422";
    }
    const textFields = {
      editTagLine:        state.tagLine,
      editHeroTitle:      state.heroTitle,
      editHeroText:       state.heroText,
      editMainCta:        state.mainCtaText,
      editSectionTitle:   state.sectionTitle,
      editSectionSubtitle:state.sectionSubtitle,
      editFooterMessage:  state.contact?.footerMessage,
    };
    Object.entries(textFields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val || "";
    });
  }

  const now = new Date();
  updatedAtEl.textContent = `Catalogo actualizado: ${now.toLocaleDateString("es-AR")} ${now.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function showMessage(text) {
  updatedAtEl.textContent = text;
}

function bindCommonEvents() {
  catalogTabsEl.addEventListener("click", (event) => {
    const button = event.target.closest(".catalog-tab");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const catalogId = button.dataset.catalogId;
    if (!catalogId) {
      return;
    }

    setActiveCatalog(catalogId);
    render();
  });

  productsGridEl.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    if (!input.classList.contains("action-input")) {
      return;
    }

    const card = input.closest(".product-card");
    if (!card) {
      return;
    }

    const cardIndex = Number(card.dataset.productIndex);
    const product = getActiveCatalog().products[cardIndex];
    if (!product) {
      return;
    }

    const action = normalizeAction(input.value);
    const cta = card.querySelector(".card-cta");
    if (!(cta instanceof HTMLAnchorElement)) {
      return;
    }

    cta.href = buildWhatsAppLink(product, action);
    cta.textContent = `${getActionLabel(action)} por WhatsApp`;
  });

  productsGridEl.addEventListener("click", (event) => {
    const btn = event.target.closest(".carousel-btn");
    if (!btn) return;
    const carousel = btn.closest(".carousel");
    if (!carousel) return;
    const slides = carousel.querySelectorAll(".carousel-slide");
    const dots = carousel.querySelectorAll(".carousel-dot");
    let current = Number(carousel.dataset.current) || 0;
    slides[current].classList.remove("active");
    dots[current].classList.remove("active");
    if (btn.classList.contains("carousel-next")) {
      current = (current + 1) % slides.length;
    } else {
      current = (current - 1 + slides.length) % slides.length;
    }
    slides[current].classList.add("active");
    dots[current].classList.add("active");
    carousel.dataset.current = current;
  });
}

function bindAdminEvents() {
  const jsonInputEl = document.getElementById("jsonInput");
  const applyJsonBtn = document.getElementById("applyJsonBtn");
  const downloadJsonBtn = document.getElementById("downloadJsonBtn");
  const importJsonBtn = document.getElementById("importJsonBtn");
  const importJsonFile = document.getElementById("importJsonFile");
  const resetBtn = document.getElementById("resetBtn");
  const githubTokenEl = document.getElementById("githubToken");
  const saveHookBtn = document.getElementById("saveHookBtn");
  const publishBtn = document.getElementById("publishBtn");
  const publishStatus = document.getElementById("publishStatus");
  const addProductForm = document.getElementById("addProductForm");
  const catalogSelectEl = document.getElementById("catalogSelect");
  const newCatalogNameEl = document.getElementById("newCatalogName");
  const createCatalogBtn = document.getElementById("createCatalogBtn");
  const renameCatalogBtn = document.getElementById("renameCatalogBtn");
  const deleteCatalogBtn = document.getElementById("deleteCatalogBtn");
  const editProductSelectEl = document.getElementById("editProductSelect");
  const moveCatalogSelectEl = document.getElementById("moveCatalogSelect");
  const loadProductBtn = document.getElementById("loadProductBtn");
  const saveProductBtn = document.getElementById("saveProductBtn");
  const deleteProductBtn = document.getElementById("deleteProductBtn");
  const moveProductBtn = document.getElementById("moveProductBtn");

  if (
    !jsonInputEl ||
    !applyJsonBtn ||
    !downloadJsonBtn ||
    !importJsonBtn ||
    !importJsonFile ||
    !resetBtn ||
    !addProductForm ||
    !newCatalogNameEl ||
    !createCatalogBtn ||
    !renameCatalogBtn ||
    !deleteCatalogBtn ||
    !editProductSelectEl ||
    !moveCatalogSelectEl ||
    !loadProductBtn ||
    !saveProductBtn ||
    !deleteProductBtn ||
    !moveProductBtn
  ) {
    return;
  }

  // GitHub publish
  const savedToken = localStorage.getItem("githubToken");
  if (savedToken && githubTokenEl) githubTokenEl.value = savedToken;

  if (saveHookBtn) {
    saveHookBtn.addEventListener("click", () => {
      const token = githubTokenEl?.value.trim();
      if (!token) { showMessage("Pega el token primero."); return; }
      localStorage.setItem("githubToken", token);
      showMessage("Token guardado.");
    });
  }

  if (publishBtn) {
    publishBtn.addEventListener("click", async () => {
      const tokenFromField = githubTokenEl?.value.trim();
      if (tokenFromField) localStorage.setItem("githubToken", tokenFromField);
      const token = tokenFromField || localStorage.getItem("githubToken");
      if (!token) { publishStatus.textContent = "Pega el token primero."; return; }

      publishStatus.textContent = "Publicando...";

      const content = btoa(unescape(encodeURIComponent(JSON.stringify(state, null, 2))));
      const apiUrl = "https://api.github.com/repos/noquinoli/gnoquinoli/contents/catalogo.json";

      try {
        const getRes = await fetch(apiUrl, {
          headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" }
        });
        if (!getRes.ok) {
          const errGet = await getRes.json();
          publishStatus.textContent = `Error al leer archivo (${getRes.status}): ${errGet.message}`;
          return;
        }
        const fileData = await getRes.json();
        const sha = fileData.sha;

        const putRes = await fetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ message: "actualizo catalogo desde admin", content, sha })
        });

        if (putRes.ok) {
          publishStatus.textContent = "Listo! El sitio se actualiza en ~1 minuto.";
        } else {
          const err = await putRes.json();
          publishStatus.textContent = `Error: ${err.message}`;
        }
      } catch (e) {
        publishStatus.textContent = `Error de red: ${e.message}`;
      }
    });
  }

  // Upload imagen(es) de producto al repo de GitHub
  const uploadImageBtn = document.getElementById("uploadImageBtn");
  const imageFileInput  = document.getElementById("imageFile");
  const imageUrlInput   = document.getElementById("image");

  // Preview inmediata al seleccionar archivo(s)
  if (imageFileInput) {
    imageFileInput.addEventListener("change", () => {
      const files = Array.from(imageFileInput.files);
      const container = document.getElementById("imagePreviews");
      if (!container) return;
      container.innerHTML = "";
      files.forEach((file) => {
        const blobUrl = URL.createObjectURL(file);
        const img = document.createElement("img");
        img.src = blobUrl;
        img.alt = "Vista previa";
        img.style.cssText = "max-height:100px;max-width:120px;border-radius:8px;object-fit:cover;border:1px solid var(--line);";
        container.appendChild(img);
      });
    });
  }

  // Preview al escribir/pegar URLs en el campo
  if (imageUrlInput) {
    imageUrlInput.addEventListener("input", () => {
      renderImagePreviews(imageUrlInput.value);
    });
  }

  if (uploadImageBtn) {
    uploadImageBtn.addEventListener("click", async () => {
      const statusEl = document.getElementById("uploadImageStatus");
      const files = Array.from(imageFileInput?.files || []);
      if (!files.length) { if (statusEl) statusEl.textContent = "Selecciona una o mas imagenes primero."; return; }

      const token = document.getElementById("githubToken")?.value.trim() || localStorage.getItem("githubToken");
      if (!token) { if (statusEl) statusEl.textContent = "Necesitas guardar el token en panel 8 primero."; return; }

      if (statusEl) statusEl.textContent = `Subiendo ${files.length} foto(s)...`;

      async function uploadOne(file, index) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const dataUrl = e.target.result;
            const base64 = dataUrl.split(",")[1];
            const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const apiUrl = `https://api.github.com/repos/noquinoli/gnoquinoli/contents/assets/imagenes/${fileName}`;
            const publicUrl = `https://noquinoli.github.io/gnoquinoli/assets/imagenes/${fileName}`;
            try {
              let sha;
              const getRes = await fetch(apiUrl, { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" } });
              if (getRes.ok) sha = (await getRes.json()).sha;
              const body = { message: `imagen: ${fileName}`, content: base64 };
              if (sha) body.sha = sha;
              const putRes = await fetch(apiUrl, { method: "PUT", headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
              if (putRes.ok) {
                imageCache[publicUrl] = dataUrl;
                saveImageCache();
                if (statusEl) statusEl.textContent = `(${index + 1}/${files.length}) Subiendo...`;
                resolve({ ok: true, publicUrl });
              } else {
                const err = await putRes.json();
                resolve({ ok: false, error: err.message });
              }
            } catch (err) {
              resolve({ ok: false, error: err.message });
            }
          };
          reader.readAsDataURL(file);
        });
      }

      const results = [];
      for (let i = 0; i < files.length; i++) {
        results.push(await uploadOne(files[i], i));
      }

      const ok = results.filter(r => r.ok);
      const fail = results.filter(r => !r.ok);

      if (ok.length) {
        const existing = imageUrlInput.value.split(",").map(s => s.trim()).filter(Boolean);
        const newUrls = ok.map(r => r.publicUrl);
        const merged = [...new Set([...existing, ...newUrls])];
        imageUrlInput.value = merged.join(", ");
        renderImagePreviews(imageUrlInput.value);
        if (imageFileInput) imageFileInput.value = "";
      }

      if (fail.length === 0) {
        if (statusEl) statusEl.textContent = `\u2713 ${ok.length} foto(s) subida(s). Se veran en la tarjeta al guardar.`;
      } else {
        if (statusEl) statusEl.textContent = `${ok.length} ok, ${fail.length} con error: ${fail[0].error}`;
      }
    });
  }

  applyJsonBtn.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(jsonInputEl.value);
      state = normalizeData(parsed);
      saveData();
      render();
      showMessage("Cambios aplicados correctamente.");
    } catch (error) {
      showMessage(`Error de JSON: ${error.message}`);
    }
  });

  downloadJsonBtn.addEventListener("click", () => {
    const file = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = CATALOG_FILE;
    link.click();
    URL.revokeObjectURL(link.href);

    showMessage("JSON descargado. Usalo como catalogo final para produccion.");
  });

  importJsonBtn.addEventListener("click", () => {
    importJsonFile.click();
  });

  importJsonFile.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      state = normalizeData(parsed);
      saveData();
      render();
      showMessage("Catalogo importado correctamente.");
    } catch (error) {
      showMessage(`No se pudo importar: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  });

  resetBtn.addEventListener("click", () => {
    state = normalizeData(structuredClone(defaultData));
    saveData();
    render();
    showMessage("Se restablecio la version demo.");
  });

  catalogSelectEl.addEventListener("change", () => {
    setActiveCatalog(catalogSelectEl.value);
    saveData();
    render();
  });

  createCatalogBtn.addEventListener("click", () => {
    const newName = newCatalogNameEl.value.trim();
    if (!newName) {
      showMessage("Escribe un nombre para el catalogo.");
      return;
    }

    const baseId = slugify(newName) || "catalogo";
    let nextId = baseId;
    let suffix = 2;
    while (state.catalogs.some((catalog) => catalog.id === nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    state.catalogs.push({
      id: nextId,
      name: newName,
      products: [],
    });

    state.activeCatalogId = nextId;
    newCatalogNameEl.value = "";
    saveData();
    render();
    showMessage(`Catalogo ${newName} creado.`);
  });

  renameCatalogBtn.addEventListener("click", () => {
    const newName = newCatalogNameEl.value.trim();
    if (!newName) {
      showMessage("Escribe el nuevo nombre del catalogo.");
      return;
    }

    const activeCatalog = getActiveCatalog();
    activeCatalog.name = newName;
    newCatalogNameEl.value = "";
    saveData();
    render();
    showMessage("Catalogo renombrado.");
  });

  deleteCatalogBtn.addEventListener("click", () => {
    if (state.catalogs.length <= 1) {
      showMessage("Debe existir al menos un catalogo.");
      return;
    }

    state.catalogs = state.catalogs.filter(
      (catalog) => catalog.id !== state.activeCatalogId
    );
    state.activeCatalogId = state.catalogs[0].id;
    saveData();
    render();
    showMessage("Catalogo eliminado.");
  });

  addProductForm.addEventListener("submit", (event) => {
    event.preventDefault();

    try {
      const newProduct = collectProductFromForm();
      getActiveCatalog().products.unshift(newProduct);
      saveData();
      render();
      event.target.reset();
      showMessage("Producto agregado al catalogo activo.");
    } catch (error) {
      showMessage(error.message);
    }
  });

  loadProductBtn.addEventListener("click", () => {
    const selected = Number(editProductSelectEl.value);
    if (Number.isNaN(selected)) {
      showMessage("No hay producto para cargar.");
      return;
    }

    const product = getActiveCatalog().products[selected];
    if (!product) {
      showMessage("Producto no encontrado.");
      return;
    }

    fillFormWithProduct(product);
    showMessage("Producto cargado en el formulario. Edita y guarda cambios.");
  });

  saveProductBtn.addEventListener("click", () => {
    const selected = Number(editProductSelectEl.value);
    if (Number.isNaN(selected)) {
      showMessage("Selecciona un producto para guardar cambios.");
      return;
    }

    const activeCatalog = getActiveCatalog();
    if (!activeCatalog.products[selected]) {
      showMessage("Producto no encontrado.");
      return;
    }

    try {
      activeCatalog.products[selected] = collectProductFromForm();
      saveData();
      render();
      showMessage("Producto actualizado.");
    } catch (error) {
      showMessage(error.message);
    }
  });

  deleteProductBtn.addEventListener("click", () => {
    const selected = Number(editProductSelectEl.value);
    if (Number.isNaN(selected)) {
      showMessage("Selecciona un producto para eliminar.");
      return;
    }

    const activeCatalog = getActiveCatalog();
    if (!activeCatalog.products[selected]) {
      showMessage("Producto no encontrado.");
      return;
    }

    activeCatalog.products.splice(selected, 1);
    saveData();
    render();
    showMessage("Producto eliminado del catalogo activo.");
  });

  const toggleProductBtn = document.getElementById("toggleProductBtn");
  if (toggleProductBtn) {
    toggleProductBtn.addEventListener("click", () => {
      const selected = Number(editProductSelectEl.value);
      if (Number.isNaN(selected)) { showMessage("Selecciona un producto primero."); return; }
      const activeCatalog = getActiveCatalog();
      const product = activeCatalog.products[selected];
      if (!product) { showMessage("Producto no encontrado."); return; }
      product.hidden = !product.hidden;
      saveData();
      render();
      showMessage(product.hidden ? "Producto ocultado. No se muestra en la pagina." : "Producto visible nuevamente.");
    });
  }


  moveProductBtn.addEventListener("click", () => {
    const selected = Number(editProductSelectEl.value);
    const targetCatalogId = moveCatalogSelectEl.value;

    if (Number.isNaN(selected)) {
      showMessage("Selecciona un producto para mover.");
      return;
    }

    const sourceCatalog = getActiveCatalog();
    const targetCatalog = state.catalogs.find((catalog) => catalog.id === targetCatalogId);

    if (!sourceCatalog.products[selected] || !targetCatalog) {
      showMessage("No se pudo mover el producto.");
      return;
    }

    const [product] = sourceCatalog.products.splice(selected, 1);
    targetCatalog.products.unshift(product);
    saveData();
    render();
    showMessage(`Producto movido a ${targetCatalog.name}.`);
  });

  // Color pickers
  const applyColorsBtn = document.getElementById("applyColorsBtn");
  const resetColorsBtn = document.getElementById("resetColorsBtn");

  if (applyColorsBtn) {
    applyColorsBtn.addEventListener("click", () => {
      state.theme = {
        accent:     document.getElementById("colorAccent")?.value     || state.theme.accent,
        accentDark: document.getElementById("colorAccentDark")?.value || state.theme.accentDark,
        deep:       document.getElementById("colorDeep")?.value       || state.theme.deep,
        bg:         document.getElementById("colorBg")?.value         || state.theme.bg,
        card:       document.getElementById("colorCard")?.value       || state.theme.card,
        ink:        document.getElementById("colorInk")?.value        || state.theme.ink,
        ok:         document.getElementById("colorOk")?.value         || state.theme.ok,
      };
      saveData();
      applyTheme();
      showMessage("Colores aplicados. Publica para que todos los vean.");
    });
  }

  if (resetColorsBtn) {
    resetColorsBtn.addEventListener("click", () => {
      state.theme = {
        ...state.theme,
        accent: "#dd1c23", accentDark: "#b5161d", deep: "#154729",
        bg: "#f7ebdc", card: "#fffdf7", ink: "#1f1f1f", ok: "#00ce8b",
      };
      saveData();
      render();
      showMessage("Colores de marca restaurados.");
    });
  }

  const applyFontsBtn = document.getElementById("applyFontsBtn");
  const resetFontsBtn = document.getElementById("resetFontsBtn");

  if (applyFontsBtn) {
    applyFontsBtn.addEventListener("click", () => {
      const ft = document.getElementById("fontTitles")?.value;
      const fb = document.getElementById("fontBody")?.value;
      if (ft) state.theme.fontTitles = ft;
      if (fb) state.theme.fontBody = fb;
      saveData();
      applyTheme();
      showMessage("Tipografia aplicada. Publica para que todos la vean.");
    });
  }

  if (resetFontsBtn) {
    resetFontsBtn.addEventListener("click", () => {
      state.theme.fontTitles = "'Vollkorn', serif";
      state.theme.fontBody   = "'Montserrat', sans-serif";
      saveData();
      render();
      showMessage("Fuentes de marca restauradas.");
    });
  }

  // Logo editor
  const logoFileInput  = document.getElementById("logoFileInput");
  const logoUrlInput   = document.getElementById("logoUrlInput");
  const applyLogoBtn   = document.getElementById("applyLogoBtn");
  const resetLogoBtn   = document.getElementById("resetLogoBtn");

  if (logoFileInput) {
    logoFileInput.addEventListener("change", () => {
      const file = logoFileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = document.getElementById("logoPreviewAdmin");
        if (preview) preview.src = e.target.result;
        if (logoUrlInput) logoUrlInput.value = "";
      };
      reader.readAsDataURL(file);
    });
  }

  if (applyLogoBtn) {
    applyLogoBtn.addEventListener("click", () => {
      const file = logoFileInput?.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          state.logoUrl = e.target.result;
          saveData();
          render();
          showMessage("Logo actualizado. Publica para que todos lo vean.");
        };
        reader.readAsDataURL(file);
      } else {
        const url = logoUrlInput?.value.trim();
        if (url) {
          state.logoUrl = url;
          saveData();
          render();
          showMessage("Logo actualizado. Publica para que todos lo vean.");
        } else {
          showMessage("Selecciona una imagen o pega una URL primero.");
        }
      }
    });
  }

  if (resetLogoBtn) {
    resetLogoBtn.addEventListener("click", () => {
      state.logoUrl = "";
      if (logoFileInput) logoFileInput.value = "";
      if (logoUrlInput) logoUrlInput.value = "";
      saveData();
      render();
      showMessage("Logo de marca restaurado.");
    });
  }

  // Text editor
  const applyTextsBtn = document.getElementById("applyTextsBtn");
  if (applyTextsBtn) {
    applyTextsBtn.addEventListener("click", () => {
      const val = (id) => document.getElementById(id)?.value.trim() || "";
      state.tagLine        = val("editTagLine")        || state.tagLine;
      state.heroTitle      = val("editHeroTitle")      || state.heroTitle;
      state.heroText       = val("editHeroText");
      state.mainCtaText    = val("editMainCta")        || state.mainCtaText;
      state.sectionTitle   = val("editSectionTitle")   || state.sectionTitle;
      state.sectionSubtitle= val("editSectionSubtitle");
      state.contact.footerMessage = val("editFooterMessage");
      saveData();
      render();
      showMessage("Textos actualizados. Publica para que todos los vean.");
    });
  }
}

async function init() {
  const remoteCatalog = await loadRemoteCatalog();
  if (remoteCatalog) {
    state = remoteCatalog;
    saveData();
  } else {
    state = loadData(defaultData);
  }
  bindCommonEvents();
  window.addEventListener("storage", syncStateFromStorage);
  if (isAdminView && isAdminAuthenticated()) {
    bindAdminEvents();
  }
  render();
}

init();
