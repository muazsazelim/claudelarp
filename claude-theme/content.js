const BG_ID = "cx-bg";
const STYLE_ID = "cx-style";
const CUSTOM_FAMILY = "cx-custom-font";

// Uploaded font: registered through the FontFace API from raw bytes, so the
// page's CSP (which blocks web fonts) never sees a font request.
let loadedFontData = null;
let loadedFace = null;

async function syncFontFile(dataUrl) {
  dataUrl = dataUrl || "";
  if (dataUrl === loadedFontData) return; // unchanged (e.g. slider moved)
  loadedFontData = dataUrl;

  if (loadedFace) {
    document.fonts.delete(loadedFace);
    loadedFace = null;
  }
  if (!dataUrl) return;

  try {
    const bin = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const face = new FontFace(CUSTOM_FAMILY, bytes.buffer);
    await face.load();
    if (loadedFontData !== dataUrl) return; // replaced while loading
    document.fonts.add(face);
    loadedFace = face;
  } catch (err) {
    console.warn("[Claude Theme] Could not load font file:", err);
  }
}

// The image overlay sits above the page, so a plain overlay would hide text and
// borders at high opacity. Blending keeps the foreground intact instead:
//   light page -> "multiply": dark text/borders stay dark, light background shows the image
//   dark page  -> "screen":   light text/borders stay light, dark background shows the image
function isDarkPage() {
  const root = document.documentElement;
  const mode = root.getAttribute("data-mode") || root.getAttribute("data-theme");
  if (mode === "dark") return true;
  if (mode === "light") return false;
  if (root.classList.contains("dark")) return true;
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue;
    const m = getComputedStyle(el).backgroundColor.match(
      /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?/
    );
    if (!m) continue;
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : +m[4];
    if (a < 0.5) continue; // transparent, look at the parent
    return 0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3] < 128;
  }
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

// claude.ai colors everything through CSS variables, so one preset color is
// expanded into a whole palette by overriding them. The variable names below were
// read from the live page: the current layout uses `--cds-*` (real colors, alpha
// baked in); a few older parts still use bare-HSL `--bg-*` / `--text-*` / `--border-*`.
// The page background (--cds-page-bg, --cds-surface-0/1) is deliberately left alone,
// so a background image stays natural.
function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

function paletteCss(hex, dark) {
  const c = hexToHsl(hex);
  if (!c) return "";
  const f = (x) => (+x).toFixed(1);
  const clamp = (l) => Math.min(100, Math.max(0, l));
  // hsl() color in the picked hue, optional alpha %.
  const H = (s, l, a) => `hsl(${f(c.h)} ${f(Math.min(s, 100))}% ${f(clamp(l))}%${a === undefined ? "" : ` / ${a}%`})`;
  // Bare triplet for the legacy variables.
  const T = (s, l) => `${f(c.h)} ${f(Math.min(s, 100))}% ${f(clamp(l))}%`;
  const tint = Math.min(c.s, dark ? 40 : 80); // surfaces: pastel (light) / deep (dark)
  const ink = Math.min(c.s, 85);              // text + borders: keep the hue strongly
  const v = [];
  const set = (names, value) => names.forEach((n) => v.push(`--${n}: ${value}`));

  // Accent: buttons, highlights, brand logo, links.
  const accent = H(c.s, c.l);
  const accentHover = H(c.s, c.l + (dark ? 6 : -6));
  set(["cds-fill-brand", "cds-fill-accent"], accent);
  set(["cds-fill-brand-hover", "cds-fill-accent-hover"], accentHover);
  // Pastel accents are light, so text on top of them (button labels) must be dark.
  if (c.l > 60) set(["cds-on-brand", "cds-on-accent"], H(ink, 15));
  // The sparkle logo and other "Claude orange" bits use the clay variables.
  set(["cds-clay", "cds-clay-emphasized"], accent);
  set(["cds-hsl-clay", "cds-hsl-clay-emphasized", "_brand-clay", "_brand-clay-emphasized"],
      T(c.s, c.l));
  set(["cds-text-accent"], H(c.s, dark ? Math.max(c.l, 70) : Math.min(c.l, 40)));
  set(["accent-brand", "brand-000", "brand-100", "brand-200", "accent-main-000",
       "accent-main-100", "accent-main-200", "accent-000", "accent-100", "accent-200"],
      T(c.s, c.l));

  // Selected / hover / control fills are translucent washes of the accent.
  set(["cds-fill-secondary", "cds-fill-ghost-selected"], H(c.s, c.l, 30));
  set(["cds-fill-secondary-hover", "cds-fizzy-lake-color-selected-hover"], H(c.s, c.l, 40));
  set(["cds-fill-ghost-hover", "cds-fill-button-ghost-hover", "cds-fill-button-layer",
       "cds-fill-secondary-layer", "cds-fill-control"], H(c.s, c.l, 18));
  set(["cds-fill-control-hover"], H(c.s, c.l, 28));
  set(["cds-fill-card", "cds-fill-card-hover", "cds-fill-field"], H(c.s, c.l, 10));

  // Raised surfaces: cards, input box, popups. (Sidebar is scoped separately below.)
  const raised = H(tint, dark ? 17 : 96);
  set(["cds-surface-2", "cds-surface-3", "cds-surface-panel", "cds-fizzy-lake-color-card-hover"], raised);
  set(["cds-surface-popover"], H(tint, dark ? 21 : 98));

  // Borders and rings.
  const bc = (a) => H(ink, dark ? 62 : 55, a);
  v.push(`--cds-border: ${bc(22)}`, `--cds-border-line-muted: ${bc(35)}`,
         `--cds-border-line: ${bc(45)}`, `--cds-border-strong: ${bc(60)}`,
         `--cds-border-stronger: ${bc(80)}`, `--cds-ring-color: ${bc(25)}`,
         `--cds-fill-field-ring: ${bc(25)}`, `--cds-fizzy-lake-color-composer-ring: ${bc(35)}`,
         `--cds-fizzy-lake-color-badge-line: ${bc(50)}`);
  set(["border-100", "border-200", "border-300", "border-400"], T(ink, dark ? 35 : 70));

  // Text, tinted with the hue.
  const primary = H(dark ? Math.min(c.s, 60) : ink, dark ? 92 : 22);
  const secondary = H(ink, dark ? 78 : 34);
  const muted = H(ink, dark ? 62 : 46);
  set(["cds-text-primary", "cds-fizzy-lake-color-control-ink", "control-ink"], primary);
  set(["cds-text-secondary", "cds-text-stays-secondary", "cds-fizzy-lake-color-secondary",
       "cds-fizzy-lake-color-plain-secondary", "cds-fizzy-lake-color-plain-muted"], secondary);
  set(["cds-text-muted", "cds-fizzy-lake-color-placeholder", "cds-fizzy-lake-color-solid-muted"], muted);
  set(["cds-text-disabled"], H(ink, dark ? 62 : 46, 55));
  [0, 1, 2, 3, 4, 5].forEach((i) =>
    v.push(`--text-${i}00: ${T(ink, [dark ? 92 : 22, dark ? 92 : 22, dark ? 78 : 32, dark ? 78 : 32, dark ? 64 : 44, dark ? 64 : 44][i])}`)
  );
  [1, 2, 3, 4, 5].forEach((i) =>
    v.push(`--bg-${i}00: ${T(tint, (dark ? [10, 8, 6, 5, 5] : [95, 92, 88, 85, 85])[i - 1])}`)
  );

  // Variables can be redefined on inner elements (the input box redefines
  // --cds-surface-3), which beats :root inheritance, so set them on every element.
  // !important outranks the site's normal rules.
  const body = v.join(" !important; ");

  // Sidebar: a stronger shade than the cards. Scoped rule is more specific than
  // `body *`, so it wins on the sidebar and everything inside it.
  const side = H(tint, dark ? 13 : 88);
  const sidebar = ["cds-surface-2", "cds-surface-3", "cds-surface-panel", "cds-fizzy-lake-color-sidebar"]
    .map((n) => `--${n}: ${side}`).join(" !important; ");

  return `:root:root:root:root:root, body, body * { ${body} !important; }\n` +
         `aside.dframe-sidebar, aside.dframe-sidebar * { ${sidebar} !important; }\n`;
}

function apply(s) {
  lastSettings = s;
  // ----- Background image -----
  let bg = document.getElementById(BG_ID);
  if (s.image) {
    if (!bg) {
      bg = document.createElement("div");
      bg.id = BG_ID;
      document.documentElement.appendChild(bg);
    }
    bg.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483647;
      background: url("${s.image}") center / cover no-repeat;
      opacity: ${s.opacity};
      mix-blend-mode: ${isDarkPage() ? "screen" : "multiply"};
    `;
  } else if (bg) {
    bg.remove();
  }

  // ----- Font + text brightness -----
  const SEL = "body, body *:not(pre):not(code):not(pre *):not(code *)";
  syncFontFile(s.fontFile);

  let css = "";
  const families = [];
  if (s.fontFile) families.push(`"${CUSTOM_FAMILY}"`); // uploaded file wins
  if (s.font) families.push(s.font); // typed (installed) font is the fallback
  if (families.length) {
    // With "apply to code" on, code blocks and inline code get the font too.
    const fontSel = s.codeFont ? "body, body *" : SEL;
    css += `${fontSel} { font-family: ${families.join(", ")}, sans-serif !important; }\n`;
  }
  if (s.textBrightness >= 0) {
    // 0 = black, 100 = white
    css += `${SEL} { color: hsl(0, 0%, ${s.textBrightness}%) !important; }\n`;
  }

  if (s.themeColor) css += paletteCss(s.themeColor, isDarkPage());

  let style = document.getElementById(STYLE_ID);
  if (css) {
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.documentElement.appendChild(style);
    }
    style.textContent = css;
  } else if (style) {
    style.remove();
  }
}

// textBrightness: -1 = off (use Claude's own colors), 0-100 = grey from black to white
const DEFAULTS = {
  image: "",
  opacity: 0.15,
  font: "",
  fontFile: "",
  fontFileName: "",
  codeFont: true,
  textBrightness: -1,
  themeColor: "", // "" = off (Claude's own colors), else "#rrggbb"
};

chrome.storage.local.get(DEFAULTS, apply);

chrome.storage.onChanged.addListener(() => {
  chrome.storage.local.get(DEFAULTS, apply);
});

// Re-pick the blend mode when the site switches between light and dark.
let lastSettings = null;
const rethemeSoon = () => lastSettings && apply(lastSettings);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", rethemeSoon);
new MutationObserver(rethemeSoon).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["class", "data-theme", "data-mode", "style"],
});
