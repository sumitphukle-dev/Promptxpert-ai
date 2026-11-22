export const VERDICT = {
  "likely-ai": ["Leans AI-generated", "text-fake border-fake/40 bg-fake/10", "#FF5A8F"],
  "likely-real": ["Leans real", "text-real border-real/40 bg-real/10", "#3DDDB4"],
  inconclusive: ["Inconclusive", "text-warn border-warn/40 bg-warn/10", "#FFC65C"],
  conflicting: ["Signals conflict", "text-warn border-warn/40 bg-warn/10", "#FFC65C"],
  "not-assessed": ["Not assessed", "text-dim border-line bg-raised", "#98A2C3"],
};
export const PROV = {
  generator_metadata: "Generator metadata found",
  present_unverified: "Credential found, not validated",
  absent: "No credential detected",
  no_metadata: "No metadata or credential detected",
};
export const RISK = { high: "text-fake", medium: "text-warn", low: "text-dim", clean: "text-real" };
export const STYLES = ["concise", "detailed", "cinematic", "illustrative"];
export const FORMATS = [["plain", "Plain text"], ["midjourney", "Midjourney"], ["stable-diffusion", "Stable Diffusion"]];

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
export function download(name, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  URL.revokeObjectURL(url);
}

/** Re-encodes an image through a canvas, which drops EXIF/GPS and bakes in orientation. Runs fully in the browser. */
export async function cleanCopy(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const c = Object.assign(document.createElement("canvas"), { width: bmp.width, height: bmp.height });
  c.getContext("2d").drawImage(bmp, 0, 0);
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise((r) => c.toBlob(r, type, 0.95));
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: `${(file.name || "image").replace(/\.[^.]+$/, "")}-clean.${type === "image/png" ? "png" : "jpg"}` }).click();
  URL.revokeObjectURL(url);
}

export const paletteExports = {
  CSS: (p) => `:root {\n${p.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join("\n")}\n}`,
  Tailwind: (p) => `colors: {\n${p.map((c, i) => `  palette${i + 1}: "${c.hex}",`).join("\n")}\n}`,
  JSON: (p) => JSON.stringify(p.map((c) => c.hex)),
};
