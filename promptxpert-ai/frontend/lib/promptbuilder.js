/* Prompt Studio engine: turns AI-detected chips into prompts for different generators. Pure functions, no network. */
export const CATS = [
  ["subject", "Subject"], ["secondary_objects", "Details"], ["environment", "Setting"], ["composition", "Composition"],
  ["camera_perspective", "Camera angle"], ["lighting", "Lighting"], ["color_palette", "Colour"], ["mood", "Mood"],
  ["visual_style", "Style"], ["texture_detail", "Texture"], ["keywords", "Keywords"], ["camera_exif", "Photo settings"],
];
export const TARGETS = [
  ["plain", "Universal", "Comma-separated tags that work almost anywhere"],
  ["midjourney", "Midjourney", "Adds --ar, --style raw, --stylize and --no"],
  ["stable-diffusion", "Stable Diffusion", "Weighted terms plus a negative prompt"],
  ["flux", "Flux", "Flowing natural-language description"],
  ["dalle3", "DALL·E 3", "Descriptive paragraph for ChatGPT"],
];
export const REIMAGINE = {
  anime: ["Anime", "anime key visual, cel shading, vibrant colours"],
  oil: ["Oil painting", "oil painting, visible brushstrokes, rich impasto texture"],
  render3d: ["3D render", "3D render, global illumination, subsurface scattering"],
  watercolor: ["Watercolour", "watercolour painting, soft bleeding edges, paper texture"],
  cyberpunk: ["Cyberpunk", "cyberpunk, neon lighting, rain-soaked streets, high contrast"],
  studio: ["Studio photo", "studio photograph, softbox lighting, seamless backdrop, 85mm"],
  pixel: ["Pixel art", "pixel art, 16-bit, limited palette"],
  noir: ["Film noir", "film noir, black and white, hard shadows, film grain"],
};
export const DETAIL = ["Short", "Medium", "Long"];
export const DEFAULT_NEGATIVE = "blurry, low quality, watermark, text, extra fingers, distorted anatomy, jpeg artifacts";
const ALWAYS = new Set(["keywords", "camera_exif"]);
const STYLE = {
  concise: { cats: ["subject", "environment", "lighting", "visual_style"], pre: "", post: "" },
  detailed: { cats: null, pre: "", post: "" },
  cinematic: { cats: ["subject", "secondary_objects", "environment", "camera_perspective", "lighting", "color_palette", "mood"], pre: "Cinematic still of ", post: "shallow depth of field, anamorphic lens, film grain" },
  illustrative: { cats: ["subject", "secondary_objects", "environment", "composition", "color_palette", "mood", "visual_style"], pre: "Digital illustration of ", post: "clean linework, painterly shading" },
};
const BOOST = "highly detailed, sharp focus, intricate textures, professional lighting";

let counter = 0;
const nid = () => `c${++counter}`;

export function chipsFromResult(res) {
  const a = res.prompt.attributes, chips = [];
  const push = (cat, text, on = true) => { text = String(text || "").trim(); if (text) chips.push({ id: nid(), cat, text, on, w: 1 }); };
  push("subject", a.subject);
  (a.secondary_objects || []).forEach((t) => push("secondary_objects", t));
  push("environment", a.environment); push("composition", a.composition); push("camera_perspective", a.camera_perspective);
  push("lighting", a.lighting);
  (a.color_palette || []).forEach((t) => push("color_palette", t));
  push("mood", a.mood); push("visual_style", a.visual_style); push("texture_detail", a.texture_detail);
  (a.keywords || []).forEach((t) => push("keywords", t, false));
  (res.camera || []).forEach((t) => push("camera_exif", t, false));
  if (a.lens_and_focus) push("camera_exif", a.lens_and_focus, false);
  return chips;
}

export function build({ chips, style = "detailed", detail = 1, target = "plain", ar = "3:2", reimagine = null, negative = "" }) {
  const cfg = STYLE[style] || STYLE.detailed;
  const order = Object.fromEntries(CATS.map(([k], i) => [k, i]));
  let on = chips.filter((c) => c.on && (!cfg.cats || cfg.cats.includes(c.cat) || ALWAYS.has(c.cat)))
    .sort((a, b) => order[a.cat] - order[b.cat]);
  if (detail === 0) on = on.slice(0, 6);
  const neg = (negative || DEFAULT_NEGATIVE).trim();
  const fx = reimagine && REIMAGINE[reimagine] ? REIMAGINE[reimagine] : null;

  if (target === "flux" || target === "dalle3") {
    const g = (cat) => on.filter((c) => c.cat === cat).map((c) => c.text).join(", ");
    const parts = [
      g("subject") + (g("secondary_objects") ? ` with ${g("secondary_objects")}` : ""),
      g("environment") && `The scene is set in ${g("environment")}`,
      (g("composition") || g("camera_perspective")) && `The composition is ${[g("composition"), g("camera_perspective")].filter(Boolean).join(", ")}`,
      g("lighting") && `The lighting is ${g("lighting")}`,
      (g("color_palette") || g("mood")) && `The palette is ${g("color_palette") || "balanced"}${g("mood") ? ` with a ${g("mood")} mood` : ""}`,
      (g("visual_style") || g("texture_detail")) && `Style: ${[g("visual_style"), g("texture_detail")].filter(Boolean).join(", ")}`,
      g("keywords") && `Key concepts: ${g("keywords")}`,
      g("camera_exif") && `Photographed as: ${g("camera_exif")}`,
      fx && `Rendered as ${fx[0].toLowerCase()}: ${fx[1]}`,
      detail === 2 && "Highly detailed with sharp focus and intricate textures",
    ].filter(Boolean).map((s) => s.replace(/[ .,]+$/, ""));
    return parts.join(". ") + "." + (target === "dalle3" ? " No text or watermarks." : "");
  }

  const term = (c) => (target === "stable-diffusion" && Math.abs(c.w - 1) > 0.01 ? `(${c.text}:${c.w.toFixed(1)})` : c.text);
  const terms = on.map(term);
  if (cfg.pre && on[0]?.cat === "subject") terms[0] = cfg.pre + terms[0];
  const tail = [fx && fx[1], cfg.post, detail === 2 && BOOST].filter(Boolean);
  let text = [...terms, ...tail].join(", ");
  if (target === "midjourney") {
    text += ` --ar ${ar} --style raw --stylize 250`;
    const no = neg.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6).join(", ");
    if (no) text += ` --no ${no}`;
  } else if (target === "stable-diffusion") text += `\nNegative prompt: ${neg}`;
  return text;
}

const LIMITS = { "stable-diffusion": [75, "tokens", "SD reads 75 tokens per chunk; longer prompts are split"], midjourney: [60, "words", "Midjourney works best under ~60 words"], flux: [400, "tokens", "Flux handles long prompts well"], dalle3: [4000, "characters", "DALL·E 3 accepts up to 4000 characters"], plain: [150, "tokens", "Most tools handle this comfortably"] };
export function stats(text, target) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const tokens = Math.ceil(words * 1.35);
  const [limit, unit, note] = LIMITS[target] || LIMITS.plain;
  const used = unit === "words" ? words : unit === "characters" ? text.length : tokens;
  return { words, tokens, used, limit, unit, note, over: used > limit, pct: Math.min(100, Math.round((used / limit) * 100)) };
}

const SLOTS = [["subject", "subject"], ["environment", "setting"], ["composition", "composition"], ["lighting", "lighting"], ["color_palette", "colour"], ["mood", "mood"], ["visual_style", "style"], ["camera_perspective|texture_detail|camera_exif", "camera or texture"]];
export function quality(chips) {
  const missing = SLOTS.filter(([cats]) => !chips.some((c) => c.on && cats.split("|").includes(c.cat))).map(([, l]) => l);
  return { score: Math.round(((SLOTS.length - missing.length) / SLOTS.length) * 100), missing };
}

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)));

export function improvementScore(chips, prompt = "") {
  const active = chips.filter((c) => c.on);
  const text = prompt.split(/\nNegative prompt:/i, 1)[0]
    .replace(/\s+--(?:no|ar|style|stylize)\b.*$/i, "")
    .toLowerCase();
  const words = text.match(/[\p{L}\p{N}]+/gu) || [];
  const has = (category, pattern) =>
    active.some((chip) => chip.cat === category) || pattern.test(text);
  const subject = has("subject", /\b(subject|person|people|animal|object|portrait|landscape)\b/);
  const setting = has("environment", /\b(setting|scene|environment|indoors|outdoors|forest|city|beach|mountain)\b/);
  const composition = has("composition", /\b(composition|framing|centered|wide shot|close.?up|foreground|background|rule of thirds)\b/);
  const camera = has("camera_perspective", /\b(camera|eye.?level|low.?angle|high.?angle|overhead|perspective|viewpoint)\b/);
  const lighting = has("lighting", /\b(light|lighting|backlit|backlight|softbox|sunlight|moonlight|shadow|glow|dawn|sunset)\b/);
  const completeness = quality(chips);
  const dimensions = [
    { name: "Detail", score: clampScore(30 + Math.min(words.length, 40) * 1.25 + Math.min(active.length, 8) * 2),
      tip: "Add material, texture, or other visible details." },
    { name: "Clarity", score: clampScore(25 + (subject ? 45 : 0) + (setting ? 20 : 0) + (text.trim() ? 10 : 0)),
      tip: "Name one clear main subject and its setting." },
    { name: "Composition", score: clampScore(30 + (composition ? 40 : 0) + (camera ? 30 : 0)),
      tip: "Describe framing, viewpoint, or camera angle." },
    { name: "Lighting", score: clampScore(25 + (lighting ? 75 : 0)),
      tip: "Specify light direction, softness, or time of day." },
    { name: "Completeness", score: completeness.score,
      tip: completeness.missing.length ? `Cover: ${completeness.missing.join(", ")}.` : "All key visual categories are covered." },
  ];
  return {
    score: Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length),
    dimensions,
  };
}
