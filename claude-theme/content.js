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
