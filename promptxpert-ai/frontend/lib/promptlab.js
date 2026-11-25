export const PROMPT_TEMPLATES = [
  {
    id: "research",
    name: "Researcher",
    icon: "⌕",
    brief: "Compare the leading approaches to renewable energy storage for cities.",
    role: "A rigorous energy-policy research analyst",
    context: "The audience is a city sustainability team evaluating practical, low-emission infrastructure.",
    constraints: "Use credible, recent evidence. Separate established findings from estimates. State assumptions and cite sources when available.",
    format: "Structured report",
    example: "",
  },
  {
    id: "writer",
    name: "Copywriter",
    icon: "✳",
    brief: "Write a launch email for our new reusable water bottle.",
    role: "A senior brand copywriter",
    context: "The product is a durable, lightweight reusable bottle for commuters who want to reduce single-use plastic.",
    constraints: "Keep claims factual, avoid guilt-based language, and use a warm, concise voice.",
    format: "Email",
    example: "",
  },
  {
    id: "tutor",
    name: "Tutor",
    icon: "◎",
    brief: "Explain how gradient descent works to a beginner.",
    role: "A patient, encouraging computer-science tutor",
    context: "The learner is new to machine learning and understands basic algebra.",
    constraints: "Use plain language, introduce one idea at a time, and check understanding before adding complexity.",
    format: "Step-by-step guide",
    example: "Explain each step with a small everyday analogy, then show a simple numerical example.",
  },
  {
    id: "developer",
    name: "Developer",
    icon: "{ }",
    brief: "Help me add input validation to a signup form.",
    role: "A senior, security-conscious full-stack engineer",
    context: "The change should fit an existing application, preserve its conventions, and be straightforward to test.",
    constraints: "Ask for the framework if it is unclear. Handle invalid input explicitly. Avoid unrelated refactors and explain important trade-offs.",
    format: "Implementation plan",
    example: "",
  },
  {
    id: "product",
    name: "Product lead",
    icon: "↗",
    brief: "Create a launch plan for a simple team task manager.",
    role: "A practical product strategist",
    context: "A small team is preparing to launch a lightweight task manager for growing remote teams.",
    constraints: "Prioritize a small number of measurable actions. State dependencies, risks, owners, and assumptions.",
    format: "Action plan",
    example: "",
  },
  {
    id: "analyst",
    name: "Data analyst",
    icon: "▥",
    brief: "Find the main reasons customer support requests increased last month.",
    role: "A careful customer-insights analyst",
    context: "Support request volume has increased, and the team needs a grounded explanation before changing staffing or product plans.",
    constraints: "Do not infer causation from correlation. Identify missing data, compare relevant time periods, and flag uncertainty.",
    format: "Structured report",
    example: "",
  },
];

export const MODEL_TARGETS = [
  ["universal", "Universal", "Clear, model-agnostic instructions"],
  ["chatgpt", "ChatGPT", "Explicit task and output steps"],
  ["claude", "Claude", "Context-rich, nuanced instructions"],
  ["gemini", "Gemini", "Goal-first, structured response"],
];

export const OUTPUT_FORMATS = [
  "Structured report", "Bullet points", "Step-by-step guide", "Action plan", "Email",
  "Markdown table", "JSON object", "Short answer",
];

const clean = (value) => String(value || "").trim();

export function buildProfessionalPrompt({
  brief, role, context, objective, constraints, format, example, audience, tone, target,
}) {
  const task = clean(brief);
  if (!task) return "";

  const safeRole = clean(role) || "A capable expert in the subject area";
  const targetStyle = {
    chatgpt: "Work through the requirements in order. Make the final answer easy to scan.",
    claude: "Use the provided context carefully. Preserve nuance and distinguish facts from assumptions.",
    gemini: "Address the goal directly, organize the response into clear sections, and keep it actionable.",
  }[target] || "Follow the requirements precisely and keep the response relevant to the request.";
  const rules = clean(constraints) || "Preserve the request's intent. Do not invent facts. If essential information is missing, state the assumption or ask a concise clarifying question.";
  const exampleText = clean(example) || "No example was supplied. Do not invent source material; include an illustrative example only when it would make the answer clearer.";

  return [
    `## Role\nYou are ${safeRole}.`,
    `## Context\n${clean(context) || "Use the request below as the source of truth. Do not assume unstated background facts."}`,
    `## Objective\n${clean(objective) || task}`,
    `## Request\n${task}`,
    `## Audience and tone\n${[clean(audience) && `Audience: ${clean(audience)}`, clean(tone) && `Tone: ${clean(tone)}`].filter(Boolean).join("\n") || "Choose a clear, appropriate tone for the intended audience."}`,
    `## Constraints\n${rules}`,
    `## Output format\n${clean(format) || "A clear, structured response"}${clean(format) === "JSON object" ? "\nReturn valid JSON only. Do not wrap it in Markdown fences." : ""}`,
    `## Example\n${exampleText}`,
    `## Quality check\n${targetStyle} Before responding, verify that the result fulfils the objective, follows every constraint, and uses the requested format.`,
  ].join("\n\n");
}

const GENERAL_RUBRIC = [
  {
    name: "Clarity",
    pattern: /\b(objective|goal|task|request|deliver|explain|create|compare|analy[sz]e|summari[sz]e|write|build|recommend)\b/i,
    tip: "State the outcome you want using a specific action and a clear success condition.",
  },
  {
    name: "Context",
    pattern: /\b(context|background|audience|user|customer|team|project|product|for whom|currently|because)\b/i,
    tip: "Add who this is for, relevant background, and why the task matters.",
  },
  {
    name: "Constraints",
    pattern: /\b(constraint|must|must not|do not|avoid|limit|within|only|without|assumption|cite|source)\b/i,
    tip: "Specify boundaries, required sources, length limits, or things the response must avoid.",
  },
  {
    name: "Output format",
    pattern: /\b(format|table|json|markdown|bullet|step.by.step|email|report|checklist|template|sections?)\b/i,
    tip: "Name the response format and the sections or fields it should contain.",
  },
  {
    name: "Examples",
    pattern: /\b(example|sample|for instance|such as|e\.g\.|input|ideal output)\b/i,
    tip: "Add a small example of the input and the kind of answer you consider successful.",
  },
];

const VISUAL_RUBRIC = [
  {
    name: "Clarity",
    pattern: /\b(subject\s*:|showing|depicting|featuring|portrait of|photo of|image of|illustration of|a person|a woman|a man|a child|a cat|a dog|a fox|a bird|a tree|a building|a city|a mountain|a product|a car|still life)\b/i,
    tip: "Describe the main subject and what it is doing in direct, unambiguous language.",
  },
  {
    name: "Subject detail",
    pattern: /\b(texture|textured|fabric|fur|feather|skin|pattern|wearing|holding|expression|detailed|intricate|weathered|glossy|matte|freckled|colou?red|color palette|wooden|metallic|glass|leather|silk|cotton|velvet|concrete)\b/i,
    tip: "Add visible traits such as materials, textures, expression, clothing, or colour.",
  },
  {
    name: "Lighting",
    pattern: /\b(light|lighting|shadow|backlit|backlight|softbox|sunlight|moonlight|glow|rim light|dawn|sunset|overcast|dramatic contrast)\b/i,
    tip: "Specify the light source, direction, softness, or time of day.",
  },
  {
    name: "Composition",
    pattern: /\b(composition|framing|centered|centred|wide shot|close.?up|overhead|low.?angle|high.?angle|foreground|rule of thirds|eye.?level|depth of field|perspective)\b/i,
    tip: "Describe framing, camera angle, perspective, or where the subject sits in the frame.",
  },
  {
    name: "Style",
    pattern: /\b(style|photorealistic|photograph|cinematic|editorial|illustration|watercolou?r|oil painting|anime|3d render|pixel art|film noir|film grain|art deco|minimalist)\b/i,
    tip: "Name a medium, visual genre, or reference style to guide the final look.",
  },
];

function scoreDimension(text, rubric, words) {
  const labelPresent = new RegExp(`(?:^|\\n)\\s*(?:##?\\s*)?${rubric.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:\\n]`, "i").test(text);
  const points = labelPresent ? 72 : rubric.pattern.test(text) ? 60 : 15;
  if (points === 15) return points;
  const detail = Math.min(20, Math.floor(words.length / 8) * 4);
  const specificity = Math.min(15, new Set(words.map((word) => word.toLowerCase())).size);
  return Math.min(100, points + detail + specificity);
}

export function analyzePromptQuality(value, mode = "general") {
  const text = clean(value);
  const words = text.match(/[\p{L}\p{N}]+/gu) || [];
  const rubric = mode === "visual" ? VISUAL_RUBRIC : GENERAL_RUBRIC;
  const dimensions = rubric.map((item) => ({
    name: item.name,
    score: scoreDimension(text, item, words),
    tip: item.tip,
  }));
  const score = Math.round(dimensions.reduce((total, item) => total + item.score, 0) / dimensions.length);
  const tips = dimensions.filter((item) => item.score < 70).map((item) => ({ name: item.name, tip: item.tip }));
  return { score, dimensions, tips, words: words.length, characters: text.length };
}
