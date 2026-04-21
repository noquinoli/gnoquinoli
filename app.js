const STORAGE_KEY = "salesLandingDataV1";
const CATALOG_FILE = "catalogo.json";

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

if (!isAdminView && managerEl) {
  managerEl.remove();
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
    contact: {
      whatsapp: raw.contact?.whatsapp || "",
      footerMessage: raw.contact?.footerMessage || "",
    },
    catalogs: [],
    activeCatalogId: "",
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
    ? product.image.split(",").map(s => s.trim()).filter(Boolean)
    : [];

  const imageMarkup = images.length === 0
    ? '<div class="media-placeholder">Sin imagen</div>'
    : images.length === 1
      ? `<img class="product-image" src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}" loading="lazy" />`
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
  const isUnavailable = status === "vendido" || status === "agotado";

  const PILL_CONFIG = {
    activo:  { text: "Oferta activa", css: "pill" },
    vendido: { text: "Vendido",       css: "pill pill--sold" },
    agotado: { text: "Agotado",       css: "pill pill--out" },
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
    <article class="product-card${isUnavailable ? " product-card--sold" : ""}" data-product-index="${index}">
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
        `<option value="${index}">${index + 1}. ${escapeHtml(product.name)}</option>`
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

function fillFormWithProduct(product) {
  document.getElementById("name").value = product.name || "";
  document.getElementById("price").value = Number(product.price) || 0;
  document.getElementById("oldPrice").value =
    typeof product.oldPrice === "number" ? product.oldPrice : "";
  document.getElementById("details").value = Array.isArray(product.details)
    ? product.details.join("\n")
    : "";
  document.getElementById("image").value = product.image || "";
  document.getElementById("ctaText").value = product.ctaText || "";
  document.getElementById("defaultAction").value = normalizeAction(product.defaultAction);
  document.getElementById("productStatus").value = product.productStatus || (product.soldOut ? "vendido" : "activo");
}

function render() {
  const activeCatalog = getActiveCatalog();
  document.title = `Ofertas Activas | ${state.brand}`;
  heroTextEl.textContent = state.heroText || "";
  footerTextEl.textContent = state.contact?.footerMessage || "";

  mainCtaEl.href = "#productos";
  waFloatEl.href = `https://wa.me/${state.contact.whatsapp}`;

  renderCatalogTabs();
  productsGridEl.innerHTML = activeCatalog.products
    .map((product, index) => createProductCard(product, index))
    .join("");

  if (isAdminView) {
    renderCatalogSelect();
    renderAdminProductTools();
    const jsonInputEl = document.getElementById("jsonInput");
    if (jsonInputEl) {
      jsonInputEl.value = JSON.stringify(state, null, 2);
    }
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
      const token = localStorage.getItem("githubToken");
      if (!token) { publishStatus.textContent = "Guardá el token primero."; return; }

      publishStatus.textContent = "Publicando...";
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(state, null, 2))));
const apiUrl = "https://api.github.com/repos/noquinoli/gnoquinoli/contents/catalogo.json";

      try {
        const getRes = await fetch(apiUrl, {
          headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" }
        });
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
          publishStatus.textContent = "¡Listo! El sitio se actualiza en ~1 minuto.";
        } else {
          const err = await putRes.json();
          publishStatus.textContent = `Error: ${err.message}`;
        }
      } catch (e) {
        publishStatus.textContent = `Error de red: ${e.message}`;
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
  if (isAdminView) {
    bindAdminEvents();
  }
  render();
}

init();
