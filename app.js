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

  normalized.whatsappGroups = Array.isArray(raw.whatsappGroups)
    ? raw.whatsappGroups.map((g) => ({
        id: g.id || ("grupo-" + Math.random().toString(36).slice(2, 7)),
        name: g.name || "Grupo",
        link: g.link || "",
        days: Array.isArray(g.days) ? g.days : [],
        description: g.description || "",
        accessCode: g.accessCode || "",
      }))
    : [];

  normalized.paymentQrUrl = raw.paymentQrUrl || "";

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
              p.image = ""; // Forzar re-subida con la nueva versiÃƒÆ’Ã‚Â³n
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


const DAYS = ["lunes","martes","miercoles","jueves","viernes","sabado","domingo"];
const DAYS_LABEL = { lunes:"Lunes", martes:"Martes", miercoles:"Miércoles", jueves:"Jueves", viernes:"Viernes", sabado:"Sábado", domingo:"Domingo" };

let _selectedDay = null;
let _selectedGroup = null;
let _orderType = "individual"; // "individual" | "grupal"

// IDs de grupos desbloqueados por código (persisten en localStorage)
const UNLOCKED_KEY = "noquinoliUnlockedGroups";
let _unlockedGroups = new Set(
  JSON.parse(localStorage.getItem(UNLOCKED_KEY) || "[]")
);
function saveUnlocked() {
  localStorage.setItem(UNLOCKED_KEY, JSON.stringify([..._unlockedGroups]));
}
function isGroupUnlocked(g) {
  return !g.accessCode || _unlockedGroups.has(g.id);
}
// ===== CARRITO DE PEDIDO =====
let _cart = [];
let _comprobanteDataUrl = null; // imagen del comprobante seleccionada por el cliente

function _cartId(product) { return product.id || product.name; }

function cartAdd(product) {
  const id = _cartId(product);
  const existing = _cart.find(i => i.id === id);
  if (existing) { existing.qty++; }
  else { _cart.push({ id, name: product.name, price: product.price, qty: 1 }); }
  renderCart();
}

function cartRemove(id) {
  _cart = _cart.filter(i => i.id !== id);
  renderCart();
}

function cartSetQty(id, qty) {
  if (qty < 1) { cartRemove(id); return; }
  const item = _cart.find(i => i.id === id);
  if (item) { item.qty = qty; renderCart(); }
}

function _cartTotalNum() { return _cart.reduce((s, i) => s + i.price * i.qty, 0); }
function _cartCount() { return _cart.reduce((s, i) => s + i.qty, 0); }

function openCartPanel() {
  const panel = document.getElementById("cartPanel");
  const overlay = document.getElementById("cartOverlay");
  const arrow = document.getElementById("cartBarArrow");
  if (panel) { panel.classList.add("cart-panel--open"); }
  if (overlay) { overlay.classList.add("cart-overlay--visible"); }
  if (arrow) arrow.textContent = "\u25BC";
  document.body.classList.add("cart-open");
}

function closeCartPanel() {
  const panel = document.getElementById("cartPanel");
  const overlay = document.getElementById("cartOverlay");
  const arrow = document.getElementById("cartBarArrow");
  if (panel) { panel.classList.remove("cart-panel--open"); }
  if (overlay) { overlay.classList.remove("cart-overlay--visible"); }
  if (arrow) arrow.textContent = "\u25B2";
  document.body.classList.remove("cart-open");
}

function buildCartWAMessage() {
  const note = (document.getElementById("cartNote")?.value || "").trim();
  const lines = _cart.map(i => "\u2022 " + i.qty + "x " + i.name + " \u2014 " + formatMoney(i.price * i.qty));
  const total = formatMoney(_cartTotalNum());
  let msg;
  if (_orderType === "grupal" && _selectedDay) {
    const dayLabel = DAYS_LABEL[_selectedDay] || _selectedDay;
    const groupLabel = _selectedGroup ? (" - " + _selectedGroup.name) : "";
    msg = "Hola! Quiero hacer un pedido grupal \uD83C\uDF5D (" + dayLabel + groupLabel + ")\n\n" + lines.join("\n") + "\n\n*Total: " + total + "*";
  } else {
    msg = "Hola! Quiero hacer un pedido \uD83C\uDF5D\n\n" + lines.join("\n") + "\n\n*Total: " + total + "*";
  }
  if (note) msg += "\n\n\uD83D\uDCDD " + note;
  if (_comprobanteDataUrl) msg += "\n\n\uD83D\uDCB3 Comprobante de pago adjunto en el mensaje.";
  return msg;
}

function renderCart() {
  const bar = document.getElementById("cartBar");
  const countEl = document.getElementById("cartCount");
  const barTotalEl = document.getElementById("cartBarTotal");
  const totalPanelEl = document.getElementById("cartTotalPanel");
  const itemsEl = document.getElementById("cartItems");
  if (!bar) return;
  const count = _cartCount();
  if (count === 0) {
    bar.classList.remove("cart-bar--visible");
    closeCartPanel();
    return;
  }
  bar.classList.add("cart-bar--visible");
  const total = formatMoney(_cartTotalNum());
  if (countEl) countEl.textContent = count;
  if (barTotalEl) barTotalEl.textContent = total;
  if (totalPanelEl) totalPanelEl.textContent = total;
  if (itemsEl) {
    itemsEl.innerHTML = _cart.map(item =>
      '<div class="cart-item">' +
        '<span class="cart-item__name">' + escapeHtml(item.name) + '</span>' +
        '<div class="cart-item__controls">' +
          '<button type="button" class="cart-qty-btn" data-cart-action="dec" data-cart-id="' + escapeHtml(item.id) + '">\u2212</button>' +
          '<span class="cart-item__qty">' + item.qty + '</span>' +
          '<button type="button" class="cart-qty-btn" data-cart-action="inc" data-cart-id="' + escapeHtml(item.id) + '">+</button>' +
        '</div>' +
        '<span class="cart-item__price">' + formatMoney(item.price * item.qty) + '</span>' +
        '<button type="button" class="cart-item__remove" data-cart-id="' + escapeHtml(item.id) + '" aria-label="Quitar">\u2715</button>' +
      '</div>'
    ).join("");
  }
  updateCartSendBtnState();
}

function updateCartSendBtnState() {
  const btn = document.getElementById("cartSendBtn");
  const txtEl = document.getElementById("cartSendBtnText");
  if (!btn) return;
  const isGroup = _orderType === "grupal" && _selectedGroup;
  if (isGroup) {
    btn.classList.add("cart-send-btn--group");
    if (txtEl) txtEl.textContent = "Enviar pedido al grupo";
  } else {
    btn.classList.remove("cart-send-btn--group");
    if (txtEl) txtEl.textContent = "Enviar pedido por WhatsApp";
  }
}

function validateWhatsAppLink(link) {
  return /^https:\/\/(chat\.whatsapp\.com|wa\.me)\//.test(link.trim());
}

function renderAdminGroupSelect() {
  const sel = document.getElementById("groupSelect");
  if (!sel) return;
  const groups = state.whatsappGroups || [];
  sel.innerHTML = '<option value="">-- Seleccionar grupo --</option>' +
    groups.map((g, i) =>
      '<option value="' + i + '">' + escapeHtml(g.name) + ' (' + (g.days.join(", ") || "sin dias") + ')</option>'
    ).join("");
}

function renderOrderTypeSelector() {
  if (isAdminView) return;
  const el = document.getElementById("orderTypeSelector");
  if (!el) return;
  const groups = state.whatsappGroups || [];
  if (groups.length === 0) { el.style.display = "none"; return; }
  el.style.display = "";
  el.innerHTML =
    '<p class="order-type-label">\u00bfC\u00f3mo quer\u00e9s hacer tu pedido?</p>' +
    '<div class="order-type-btns">' +
      '<button type="button" class="order-type-btn' + (_orderType === "individual" ? " order-type-btn--active" : "") + '" data-order-type="individual">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>' +
        ' Pedido individual' +
      '</button>' +
      '<button type="button" class="order-type-btn' + (_orderType === "grupal" ? " order-type-btn--active" : "") + '" data-order-type="grupal">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.554 4.1 1.523 5.823L.057 23.571a.5.5 0 0 0 .611.612l5.748-1.466A11.944 11.944 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.944 9.944 0 0 1-5.092-1.396l-.363-.215-3.762.96.977-3.753-.235-.373A9.946 9.946 0 0 1 2 12C2 6.477 6.477 2 12 2s10 5.477 10 10-4.477 10-10 10z"/></svg>' +
        ' Pedido grupal por WhatsApp' +
      '</button>' +
    '</div>';
}

function renderWhatsAppGroups() {
  const section = document.getElementById("grupos-whatsapp");
  const daySelector = document.getElementById("daySelector");
  const groupsList = document.getElementById("groupsList");
  if (!section || !daySelector || !groupsList) return;

  if (isAdminView || _orderType !== "grupal") { section.style.display = "none"; return; }
  section.style.display = "";

  // Bloque de ingreso de código — siempre presente en modo grupal
  const codeEntryHtml =
    '<div class="group-code-entry" id="groupCodeEntry">' +
      '<p class="group-code-entry__label">\uD83D\uDD11 \u00bfTen\u00e9s un c\u00f3digo de acceso a un grupo privado?</p>' +
      '<div class="group-code-entry__row">' +
        '<input type="text" id="groupAccessCodeInput" class="group-code-input" placeholder="Ingres\u00e1 el c\u00f3digo" autocomplete="off" />' +
        '<button type="button" class="group-code-submit" id="groupAccessCodeBtn">Ingresar</button>' +
      '</div>' +
      '<span id="groupAccessCodeMsg" class="group-code-error" style="display:none;"></span>' +
    '</div>';

  const groups = state.whatsappGroups || [];
  if (groups.length === 0) {
    daySelector.innerHTML = "";
    groupsList.innerHTML = codeEntryHtml + '<p class="groups-empty">No hay grupos configurados a\u00fan. El administrador puede agregarlos desde el panel de administraci\u00f3n.</p>';
    bindCodeEntryHandler(groups);
    return;
  }

  const activeDays = DAYS.filter((d) => groups.some((g) => g.days.includes(d)));
  if (!_selectedDay || !activeDays.includes(_selectedDay)) {
    // Seleccionar el día actual si tiene grupos; si no, el más próximo disponible
    const todayIdx = new Date().getDay(); // 0=dom,1=lun,...,6=sab
    const jsToKey = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"];
    const todayKey = jsToKey[todayIdx];
    if (activeDays.includes(todayKey)) {
      _selectedDay = todayKey;
    } else {
      // Buscar el próximo día de la semana con grupos
      let found = null;
      for (let i = 1; i <= 7; i++) {
        const key = jsToKey[(todayIdx + i) % 7];
        if (activeDays.includes(key)) { found = key; break; }
      }
      _selectedDay = found || null;
    }
  }

  daySelector.innerHTML = activeDays.map((d) =>
    '<button type="button" class="day-btn' + (_selectedDay === d ? " day-btn--active" : "") + '" data-day="' + d + '">' + (DAYS_LABEL[d] || d) + '</button>'
  ).join("");

  daySelector.querySelectorAll(".day-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      _selectedDay = btn.dataset.day;
      if (_selectedGroup && !_selectedGroup.days.includes(_selectedDay)) {
        _selectedGroup = null;
      }
      renderWhatsAppGroups();
    });
  });

  const filtered = _selectedDay ? groups.filter((g) => g.days.includes(_selectedDay)) : [];
  // Solo mostrar grupos públicos (sin código) o que el cliente ya desbloqueó
  const visible = filtered.filter((g) => isGroupUnlocked(g));
  const hasHidden = filtered.some((g) => !isGroupUnlocked(g));

  if (visible.length === 0) {
    groupsList.innerHTML = codeEntryHtml +
      '<p class="groups-empty">No hay grupos visibles para este d\u00eda.' +
      (hasHidden ? ' Si ten\u00e9s un c\u00f3digo, ingres\u00e1lo arriba.' : '') + '</p>';
  } else {
    groupsList.innerHTML = codeEntryHtml + visible.map((g) => {
      const isSelected = _selectedGroup && _selectedGroup.id === g.id;
      const isPrivate = !!g.accessCode;
      return '<div class="group-card' + (isSelected ? ' group-card--selected' : '') + '" data-group-id="' + escapeHtml(g.id) + '">' +
        '<div class="group-card__info">' +
          '<strong class="group-card__name">' + escapeHtml(g.name) + '</strong>' +
          (g.description ? '<p class="group-card__desc">' + escapeHtml(g.description) + '</p>' : '') +
        '</div>' +
        '<div class="group-card__actions">' +
          '<button type="button" class="group-select-btn' + (isSelected ? ' group-select-btn--active' : '') + '" data-select-group="' + escapeHtml(g.id) + '">' +
            (isSelected ? '\u2713 Seleccionado' : 'Seleccionar para mi pedido') +
          '</button>' +
          '<a href="' + escapeHtml(g.link) + '" target="_blank" rel="noopener noreferrer" class="join-btn join-btn--sm">Unirme al grupo</a>' +
          (isPrivate
            ? '<button type="button" class="group-leave-btn" data-leave-group="' + escapeHtml(g.id) + '">\uD83D\uDEAA Salir del grupo</button>'
            : '') +
        '</div>' +
      '</div>';
    }).join("");
  }

  bindCodeEntryHandler(groups);

  // Handler: seleccionar grupo para el pedido
  groupsList.querySelectorAll("[data-select-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const gid = btn.dataset.selectGroup;
      _selectedGroup = (_selectedGroup && _selectedGroup.id === gid)
        ? null
        : (groups.find((g) => g.id === gid) || null);
      renderWhatsAppGroups();
    });
  });

  // Handler: salir del grupo (lo bloquea nuevamente y lo oculta)
  groupsList.querySelectorAll("[data-leave-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const gid = btn.dataset.leaveGroup;
      _unlockedGroups.delete(gid);
      saveUnlocked();
      if (_selectedGroup && _selectedGroup.id === gid) _selectedGroup = null;
      renderWhatsAppGroups();
    });
  });

  // Footer: solicitar nuevo grupo
  const footer = document.getElementById("groupsFooter");
  if (footer) {
    footer.innerHTML = '<button type="button" class="group-new-btn" id="requestNewGroupBtn">\uD83D\uDCE5 Solicitar nuevo grupo</button>';
    const newGroupBtn = footer.querySelector("#requestNewGroupBtn");
    if (newGroupBtn) {
      newGroupBtn.addEventListener("click", () => {
        const dayLabel = _selectedDay ? (DAYS_LABEL[_selectedDay] || _selectedDay) : "pr\u00f3ximo";
        const msg = encodeURIComponent("Hola! Me gustar\u00eda que creen un nuevo grupo de pedido para el d\u00eda " + dayLabel + ". \u00bfEs posible?");
        window.open("https://wa.me/" + state.contact.whatsapp + "?text=" + msg, "_blank", "noopener,noreferrer");
      });
    }
  }

  updateCartSendBtnState();
}

function bindCodeEntryHandler(groups) {
  const codeInput = document.getElementById("groupAccessCodeInput");
  const codeBtn = document.getElementById("groupAccessCodeBtn");
  const codeMsg = document.getElementById("groupAccessCodeMsg");
  if (!codeInput || !codeBtn) return;

  function tryEnterCode() {
    const entered = (codeInput.value || "").trim();
    if (!entered) return;
    const allGroups = groups && groups.length ? groups : (state.whatsappGroups || []);
    const match = allGroups.find((g) => g.accessCode && entered.toLowerCase() === g.accessCode.toLowerCase());
    if (match) {
      _unlockedGroups.add(match.id);
      saveUnlocked();
      codeInput.value = "";
      renderWhatsAppGroups();
    } else {
      if (codeMsg) {
        codeMsg.textContent = "C\u00f3digo incorrecto. Intent\u00e1 de nuevo.";
        codeMsg.style.display = "";
        setTimeout(() => { codeMsg.style.display = "none"; }, 3000);
      }
      codeInput.value = "";
      codeInput.focus();
    }
  }

  codeBtn.addEventListener("click", tryEnterCode);
  codeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") tryEnterCode(); });
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

  const addCartBtn = (!isUnavailable && !isAdminView)
    ? `<button type="button" class="add-to-cart-btn" data-add-to-cart data-product-index="${index}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        Agregar al pedido
      </button>`
    : "";

  return `
    <article class="product-card${isUnavailable ? " product-card--sold" : ""}${status === "oculto" && isAdminView ? " product-card--hidden" : ""}" data-product-index="${index}">
      <div class="product-media">${imageMarkup}</div>
      ${pill}
      <h3>${escapeHtml(product.name)}</h3>
      ${oldPrice}
      <p class="price">${formatMoney(product.price)}</p>
      <ul>${details}</ul>
      ${ctaMarkup}
      ${addCartBtn}
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
  renderOrderTypeSelector();
  renderWhatsAppGroups();
  renderCart();
  const activeCatalog = getActiveCatalog();
  document.title = `Menu | ${state.brand}`;

  // Logo
  const logoImgEl = document.querySelector(".brand-logo");
  if (logoImgEl) {
    logoImgEl.src = state.logoUrl || "assets/brand/logo-noquinoli-sello-trans.webp";
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
    renderAdminGroupSelect();
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
      logoPreviewAdmin.src = state.logoUrl || "assets/brand/logo-noquinoli-sello-trans.webp";
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

  // ===== Cart event handlers =====
  const productsGridEl2 = document.getElementById("productsGrid");
  if (productsGridEl2) {
    productsGridEl2.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-add-to-cart]");
      if (!btn) return;
      const idx = Number(btn.dataset.productIndex);
      const product = getActiveCatalog().products[idx];
      if (product) {
        cartAdd(product);
        // Feedback visual en el boton
        btn.textContent = "Agregado \u2714";
        btn.classList.add("add-to-cart-btn--added");
        setTimeout(() => {
          btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> Agregar al pedido';
          btn.classList.remove("add-to-cart-btn--added");
        }, 1400);
      }
    });
  }

  const cartBarBtn = document.getElementById("cartBarBtn");
  if (cartBarBtn) {
    cartBarBtn.addEventListener("click", () => {
      const panel = document.getElementById("cartPanel");
      if (panel && panel.classList.contains("cart-panel--open")) {
        closeCartPanel();
      } else {
        openCartPanel();
      }
    });
  }

  const cartCloseBtn = document.getElementById("cartCloseBtn");
  if (cartCloseBtn) cartCloseBtn.addEventListener("click", closeCartPanel);

  const cartOverlayEl = document.getElementById("cartOverlay");
  if (cartOverlayEl) cartOverlayEl.addEventListener("click", closeCartPanel);

  const cartPanelEl = document.getElementById("cartPanel");
  if (cartPanelEl) {
    cartPanelEl.addEventListener("click", (e) => {
      const qtyBtn = e.target.closest("[data-cart-action]");
      if (qtyBtn) {
        const id = qtyBtn.dataset.cartId;
        const item = _cart.find(i => i.id === id);
        if (item) {
          cartSetQty(id, qtyBtn.dataset.cartAction === "inc" ? item.qty + 1 : item.qty - 1);
        }
        return;
      }
      const removeBtn = e.target.closest(".cart-item__remove");
      if (removeBtn) {
        cartRemove(removeBtn.dataset.cartId);
        return;
      }
    });
  }

  const cartSendBtn = document.getElementById("cartSendBtn");
  if (cartSendBtn) {
    cartSendBtn.addEventListener("click", () => {
      if (_cart.length === 0) return;
      const msg = buildCartWAMessage();
      if (_orderType === "grupal" && _selectedGroup && _selectedGroup.link) {
        // Copiar mensaje al portapapeles y abrir enlace del grupo
        navigator.clipboard?.writeText(msg).catch(() => {});
        window.open(_selectedGroup.link, "_blank", "noopener,noreferrer");
        const grpToast = document.getElementById("groupSendToast");
        if (grpToast) {
          grpToast.style.display = "flex";
          setTimeout(() => { grpToast.style.display = "none"; }, 9000);
        }
      } else {
        const url = "https://wa.me/" + state.contact.whatsapp + "?text=" + encodeURIComponent(msg);
        window.open(url, "_blank", "noopener,noreferrer");
      }
      // Si hay comprobante, mostrar recordatorio para adjuntarlo manualmente en WA
      if (_comprobanteDataUrl) {
        const toast = document.getElementById("comprobanteToast");
        if (toast) {
          toast.style.display = "flex";
          setTimeout(() => { toast.style.display = "none"; }, 8000);
        }
      }
    });
  }

  // Comprobante: selección y preview
  const comprobanteInput = document.getElementById("comprobanteInput");
  const comprobanteRemove = document.getElementById("comprobanteRemove");
  if (comprobanteInput) {
    comprobanteInput.addEventListener("change", () => {
      const file = comprobanteInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        _comprobanteDataUrl = ev.target.result;
        const img = document.getElementById("comprobanteImg");
        const preview = document.getElementById("comprobantePreview");
        if (img) img.src = _comprobanteDataUrl;
        if (preview) preview.style.display = "";
        if (comprobanteRemove) comprobanteRemove.style.display = "";
      };
      reader.readAsDataURL(file);
    });
  }
  if (comprobanteRemove) {
    comprobanteRemove.addEventListener("click", () => {
      _comprobanteDataUrl = null;
      if (comprobanteInput) { comprobanteInput.value = ""; }
      const img = document.getElementById("comprobanteImg");
      const preview = document.getElementById("comprobantePreview");
      if (img) img.src = "";
      if (preview) preview.style.display = "none";
      comprobanteRemove.style.display = "none";
    });
  }

  // Toast comprobante: botón cerrar
  const toastClose = document.getElementById("comprobanteToastClose");
  if (toastClose) {
    toastClose.addEventListener("click", () => {
      const toast = document.getElementById("comprobanteToast");
      if (toast) toast.style.display = "none";
    });
  }

  // Toast grupo: botón cerrar
  const groupToastClose = document.getElementById("groupSendToastClose");
  if (groupToastClose) {
    groupToastClose.addEventListener("click", () => {
      const toast = document.getElementById("groupSendToast");
      if (toast) toast.style.display = "none";
    });
  }

  const cartClearBtn = document.getElementById("cartClearBtn");
  if (cartClearBtn) {
    cartClearBtn.addEventListener("click", () => {
      _cart = [];
      renderCart();
    });
  }

  // Selector de tipo de pedido
  const orderTypeSelectorEl = document.getElementById("orderTypeSelector");
  if (orderTypeSelectorEl) {
    orderTypeSelectorEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-order-type]");
      if (!btn) return;
      _orderType = btn.dataset.orderType;
      if (_orderType === "individual") _selectedGroup = null;
      renderOrderTypeSelector();
      renderWhatsAppGroups();
    });
  }

  // Bot\u00f3n QR de pago
  const cartQrBtn = document.getElementById("cartQrBtn");
  if (cartQrBtn) {
    cartQrBtn.addEventListener("click", () => {
      if (_cart.length === 0) return;
      const total = formatMoney(_cartTotalNum());
      const img = document.getElementById("qrImage");
      const wrap = document.getElementById("qrImageWrap");
      const lbl = document.getElementById("qrAmountLabel");
      const noConfig = document.getElementById("qrNoConfig");
      const modal = document.getElementById("qrModal");
      if (state.paymentQrUrl) {
        if (img) { img.src = state.paymentQrUrl; img.style.display = ""; }
        if (wrap) wrap.style.display = "";
        if (noConfig) noConfig.style.display = "none";
      } else {
        if (img) img.style.display = "none";
        if (wrap) wrap.style.display = "none";
        if (noConfig) noConfig.style.display = "";
      }
      if (lbl) lbl.textContent = "Total a pagar: " + total;
      if (modal) modal.style.display = "";
    });
  }

  const qrCloseBtn = document.getElementById("qrCloseBtn");
  if (qrCloseBtn) {
    qrCloseBtn.addEventListener("click", () => {
      const modal = document.getElementById("qrModal");
      if (modal) modal.style.display = "none";
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("qrModal");
      if (modal && modal.style.display !== "none") modal.style.display = "none";
    }
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
  const catalogUpBtn = document.getElementById("catalogUpBtn");
  const catalogDownBtn = document.getElementById("catalogDownBtn");
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

  function moveCatalog(dir) {
    const selectedId = catalogSelectEl.value || state.activeCatalogId;
    const idx = state.catalogs.findIndex((c) => c.id === selectedId);
    const targetIdx = idx + dir;
    if (idx < 0 || targetIdx < 0 || targetIdx >= state.catalogs.length) {
      showMessage(dir < 0 ? "Ya es el primero." : "Ya es el ultimo.");
      return;
    }
    const temp = state.catalogs[idx];
    state.catalogs[idx] = state.catalogs[targetIdx];
    state.catalogs[targetIdx] = temp;
    state.activeCatalogId = selectedId;
    saveData();
    render();
    showMessage(dir < 0 ? "Categoria movida hacia arriba." : "Categoria movida hacia abajo.");
  }

  catalogUpBtn?.addEventListener("click", () => moveCatalog(-1));
  catalogDownBtn?.addEventListener("click", () => moveCatalog(1));

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
  // ===== GRUPOS WHATSAPP =====
  function getGroupFormData() {
    const name = (document.getElementById("groupName")?.value || "").trim();
    const link = (document.getElementById("groupLink")?.value || "").trim();
    const desc = (document.getElementById("groupDesc")?.value || "").trim();
    const code = (document.getElementById("groupCode")?.value || "").trim();
    const days = Array.from(
      document.querySelectorAll("#groupDaysCheck input[type=checkbox]:checked")
    ).map((cb) => cb.value);
    return { name, link, desc, code, days };
  }

  function fillGroupForm(g) {
    const el = (id) => document.getElementById(id);
    if (el("groupName")) el("groupName").value = g.name || "";
    if (el("groupLink")) el("groupLink").value = g.link || "";
    if (el("groupDesc")) el("groupDesc").value = g.description || "";
    if (el("groupCode")) el("groupCode").value = g.accessCode || "";
    document.querySelectorAll("#groupDaysCheck input[type=checkbox]").forEach((cb) => {
      cb.checked = g.days?.includes(cb.value) || false;
    });
  }

  function clearGroupForm() {
    fillGroupForm({ name: "", link: "", description: "", days: [] });
    const sel = document.getElementById("groupSelect");
    if (sel) sel.value = "";
  }

  const createGroupBtn = document.getElementById("createGroupBtn");
  const loadGroupBtn   = document.getElementById("loadGroupBtn");
  const saveGroupBtn   = document.getElementById("saveGroupBtn");
  const deleteGroupBtn = document.getElementById("deleteGroupBtn");

  createGroupBtn?.addEventListener("click", () => {
    const { name, link, desc, code, days } = getGroupFormData();
    if (!name) { showMessage("Escribe el nombre del grupo."); return; }
    if (!link) { showMessage("Escribe el enlace de WhatsApp."); return; }
    if (!validateWhatsAppLink(link)) { showMessage("El enlace debe empezar con https://chat.whatsapp.com/ o https://wa.me/"); return; }
    if (days.length === 0) { showMessage("Selecciona al menos un día."); return; }
    if (!state.whatsappGroups) state.whatsappGroups = [];
    state.whatsappGroups.push({
      id: "grupo-" + Math.random().toString(36).slice(2, 7),
      name, link, days, description: desc, accessCode: code,
    });
    saveData();
    render();
    clearGroupForm();
    showMessage(code ? "Grupo privado creado. Publica para que sea visible." : "Grupo público creado. Publica para que sea visible.");
  });

  loadGroupBtn?.addEventListener("click", () => {
    const sel = document.getElementById("groupSelect");
    const idx = Number(sel?.value);
    if (!sel?.value) { showMessage("Selecciona un grupo primero."); return; }
    const g = state.whatsappGroups?.[idx];
    if (!g) { showMessage("Grupo no encontrado."); return; }
    fillGroupForm(g);
  });

  saveGroupBtn?.addEventListener("click", () => {
    const sel = document.getElementById("groupSelect");
    const idx = Number(sel?.value);
    if (!sel?.value) { showMessage("Carga un grupo primero."); return; }
    const { name, link, desc, code, days } = getGroupFormData();
    if (!name) { showMessage("Escribe el nombre."); return; }
    if (!link) { showMessage("Escribe el enlace."); return; }
    if (!validateWhatsAppLink(link)) { showMessage("Enlace de WhatsApp invalido."); return; }
    if (days.length === 0) { showMessage("Selecciona al menos un día."); return; }
    const g = state.whatsappGroups[idx];
    g.name = name; g.link = link; g.description = desc; g.days = days; g.accessCode = code;
    saveData();
    render();
    showMessage("Grupo actualizado. Publica para que sea visible.");
  });

  deleteGroupBtn?.addEventListener("click", () => {
    const sel = document.getElementById("groupSelect");
    const idx = Number(sel?.value);
    if (!sel?.value) { showMessage("Selecciona un grupo primero."); return; }
    state.whatsappGroups.splice(idx, 1);
    saveData();
    render();
    clearGroupForm();
    showMessage("Grupo eliminado.");
  });

  // QR de pago: subir imagen al repositorio (igual que imágenes de productos)
  const paymentQrFile = document.getElementById("paymentQrFile");
  const uploadPaymentQrBtn = document.getElementById("uploadPaymentQrBtn");
  const paymentQrStatus = document.getElementById("paymentQrStatus");

  if (paymentQrFile) {
    paymentQrFile.addEventListener("change", () => {
      const file = paymentQrFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const prev = document.getElementById("paymentQrPreview");
        if (prev) prev.innerHTML = '<img src="' + escapeHtml(ev.target.result) + '" style="max-width:140px;border-radius:8px;" alt="Vista previa QR" />';
      };
      reader.readAsDataURL(file);
    });
  }

  if (uploadPaymentQrBtn) {
    uploadPaymentQrBtn.addEventListener("click", async () => {
      const file = paymentQrFile?.files[0];
      if (!file) { if (paymentQrStatus) paymentQrStatus.textContent = "Seleccion\u00e1 la imagen QR primero."; return; }
      const token = document.getElementById("githubToken")?.value.trim() || localStorage.getItem("githubToken");
      if (!token) { if (paymentQrStatus) paymentQrStatus.textContent = "Necesit\u00e1s guardar el token en panel 8 primero."; return; }
      if (paymentQrStatus) paymentQrStatus.textContent = "Subiendo QR...";
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(",")[1];
        const ext = file.name.split(".").pop().toLowerCase() || "png";
        const fileName = "payment-qr." + ext;
        const apiUrl = "https://api.github.com/repos/noquinoli/gnoquinoli/contents/assets/" + fileName;
        const publicUrl = "https://noquinoli.github.io/gnoquinoli/assets/" + fileName;
        try {
          let sha;
          const getRes = await fetch(apiUrl, { headers: { Authorization: "token " + token, Accept: "application/vnd.github+json" } });
          if (getRes.ok) sha = (await getRes.json()).sha;
          const body = { message: "qr pago: " + fileName, content: base64 };
          if (sha) body.sha = sha;
          const putRes = await fetch(apiUrl, { method: "PUT", headers: { Authorization: "token " + token, Accept: "application/vnd.github+json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
          if (putRes.ok) {
            state.paymentQrUrl = publicUrl;
            saveData();
            const prev = document.getElementById("paymentQrPreview");
            if (prev) prev.innerHTML = '<img src="' + escapeHtml(publicUrl) + '?t=' + Date.now() + '" style="max-width:140px;border-radius:8px;border:2px solid var(--accent);" alt="QR de pago" /><p style="font-size:0.75rem;color:#888;margin:0.3rem 0 0;">\u2713 Subido. Public\u00e1 el cat\u00e1logo para que los clientes lo vean.</p>';
            if (paymentQrStatus) paymentQrStatus.textContent = "";
            if (paymentQrFile) paymentQrFile.value = "";
          } else {
            const err = await putRes.json();
            if (paymentQrStatus) paymentQrStatus.textContent = "Error: " + (err.message || "no se pudo subir");
          }
        } catch (e) {
          if (paymentQrStatus) paymentQrStatus.textContent = "Error de red: " + e.message;
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Mostrar preview del QR si ya está configurado
  const prevEl = document.getElementById("paymentQrPreview");
  if (prevEl && state.paymentQrUrl) {
    prevEl.innerHTML = '<img src="' + escapeHtml(state.paymentQrUrl) + '" style="max-width:140px;border-radius:8px;border:2px solid var(--accent);" alt="QR de pago" /><p style="font-size:0.75rem;color:#888;margin:0.3rem 0 0;">QR configurado.</p>';
  }

}

async function init() {
  // Renderizar de inmediato con datos guardados (localStorage) para evitar pantalla sin estilo
  state = loadData(defaultData);
  bindCommonEvents();
  window.addEventListener("storage", syncStateFromStorage);
  if (isAdminView && isAdminAuthenticated()) {
    bindAdminEvents();
  }
  render();

  // Actualizar silenciosamente con el catÃ¡logo remoto (GitHub)
  const remoteCatalog = await loadRemoteCatalog();
  if (remoteCatalog) {
    // Preservar grupos creados localmente si el remoto aun no tiene ninguno
    const localGroups = state.whatsappGroups || [];
    const remoteGroups = remoteCatalog.whatsappGroups || [];
    if (localGroups.length > 0 && remoteGroups.length === 0) {
      remoteCatalog.whatsappGroups = localGroups;
    }
    // Preservar QR de pago local si el remoto no lo tiene aun
    if (state.paymentQrUrl && !remoteCatalog.paymentQrUrl) {
      remoteCatalog.paymentQrUrl = state.paymentQrUrl;
    }
    state = remoteCatalog;
    saveData();
    render();
  }
}

init();

