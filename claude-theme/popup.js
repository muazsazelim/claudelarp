const $ = (id) => document.getElementById(id);
const DEFAULTS = {
  image: "",
  opacity: 0.15,
  font: "",
  fontFile: "",
  fontFileName: "",
  codeFont: true,
  textBrightness: -1,
};

function showFontFile(name) {
  $("fontFileName").textContent = name ? `Using: ${name}` : "";
}

function showTextBrightness(v) {
  const on = v >= 0;
  $("tbOn").checked = on;
  $("tb").disabled = !on;
  $("tb").value = on ? v : 0;
  $("tbVal").textContent = on ? v : 0;
}

function showPreview(image) {
  const p = $("preview");
  if (image) {
    p.style.backgroundImage = `url("${image}")`;
    p.style.display = "block";
  } else {
    p.style.display = "none";
  }
}

// Load saved settings into the popup
chrome.storage.local.get(DEFAULTS, (s) => {
  $("opacity").value = Math.round(s.opacity * 100);
  $("opVal").textContent = Math.round(s.opacity * 100);
  $("font").value = s.font;
  showTextBrightness(s.textBrightness);
  showFontFile(s.fontFileName);
  $("codeFont").checked = s.codeFont;
  showPreview(s.image);
});

// Apply font to code blocks too
$("codeFont").addEventListener("change", (e) => {
  chrome.storage.local.set({ codeFont: e.target.checked });
});

// Pick a font file
$("fontFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    chrome.storage.local.set({
      fontFile: reader.result,
      fontFileName: file.name,
    });
    showFontFile(file.name);
  };
  reader.readAsDataURL(file);
});

// Remove font file only
$("clearFont").addEventListener("click", () => {
  chrome.storage.local.set({ fontFile: "", fontFileName: "" });
  showFontFile("");
  $("fontFile").value = "";
});

// Text brightness: checkbox toggles it, slider sets it (live)
$("tbOn").addEventListener("change", (e) => {
  const v = e.target.checked ? Number($("tb").value) : -1;
  $("tb").disabled = !e.target.checked;
  chrome.storage.local.set({ textBrightness: v });
});

$("tb").addEventListener("input", (e) => {
  const v = Number(e.target.value);
  $("tbVal").textContent = v;
  chrome.storage.local.set({ textBrightness: v });
});

// Pick an image
$("file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    chrome.storage.local.set({ image: reader.result });
    showPreview(reader.result);
  };
  reader.readAsDataURL(file);
});

// Opacity slider (live)
$("opacity").addEventListener("input", (e) => {
  const v = Number(e.target.value);
  $("opVal").textContent = v;
  chrome.storage.local.set({ opacity: v / 100 });
});

// Font (live, saved as you type)
$("font").addEventListener("input", (e) => {
  const v = e.target.value.trim();
  // wrap names with spaces in quotes
  const safe = v && !v.includes('"') ? `"${v}"` : v;
  chrome.storage.local.set({ font: safe });
});

// Remove image only
$("clearImg").addEventListener("click", () => {
  chrome.storage.local.set({ image: "" });
  showPreview("");
  $("file").value = "";
});

// Reset everything
$("reset").addEventListener("click", () => {
  chrome.storage.local.set(DEFAULTS);
  $("opacity").value = 15;
  $("opVal").textContent = 15;
  $("font").value = "";
  showTextBrightness(-1);
  showFontFile("");
  $("codeFont").checked = true;
  $("fontFile").value = "";
  $("file").value = "";
  showPreview("");
});
