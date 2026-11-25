"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowDownToLine, BookOpen, Check, ChevronDown, Clock3, Copy, FileJson,
  Lightbulb, Loader2, RotateCcw, Sparkles, Target, Wand2,
} from "lucide-react";
import Footer from "@/components/Footer";
import { api } from "@/lib/api";
import { analyzePromptQuality, buildProfessionalPrompt, MODEL_TARGETS, OUTPUT_FORMATS, PROMPT_TEMPLATES } from "@/lib/promptlab";
import { download } from "@/lib/util";

const STORAGE_KEY = "px_prompt_lab_v1";
const EMPTY_FORM = {
  brief: "", role: "", context: "", objective: "", constraints: "", format: "Structured report",
  example: "", audience: "", tone: "",
};
const ease = [0.2, 0.8, 0.2, 1];

function MetricRing({ score }) {
  const circumference = 2 * Math.PI * 32;
  const color = score >= 80 ? "#3DDDB4" : score >= 55 ? "#FFC65C" : "#FF5A8F";
  return (
    <div className="relative grid h-24 w-24 shrink-0 place-items-center">
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" role="img" aria-label={`Prompt quality ${score} out of 100`}>
        <circle cx="40" cy="40" r="32" fill="none" stroke="#242A40" strokeWidth="7" />
        <motion.circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference * (1 - score / 100) }} transition={{ duration: 0.8, ease }} />
      </svg>
      <span className="font-display text-2xl font-semibold tabular-nums">{score}</span>
    </div>
  );
}

function Field({ label, hint, value, onChange, placeholder, rows = 3 }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3 text-sm font-medium">
        {label}<span className="text-[11px] font-normal text-dim">{hint}</span>
      </span>
      {rows === 1 ? (
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="field mt-2 !py-2.5 text-sm" />
      ) : (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="field mt-2 resize-y text-sm leading-relaxed" />
      )}
    </label>
  );
}

export default function PromptLab() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [template, setTemplate] = useState("");
  const [target, setTarget] = useState("universal");
  const [output, setOutput] = useState("");
  const [reviewText, setReviewText] = useState(null);
  const [reviewMode, setReviewMode] = useState("general");
  const [versions, setVersions] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [saveState, setSaveState] = useState("Loading saved draft…");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft && typeof draft === "object") {
          if (draft.form && typeof draft.form === "object") {
            setForm(Object.fromEntries(Object.keys(EMPTY_FORM).map((key) => [key, typeof draft.form[key] === "string" ? draft.form[key] : EMPTY_FORM[key]])));
          }
          if (typeof draft.template === "string") setTemplate(draft.template);
          if (typeof draft.target === "string" && MODEL_TARGETS.some(([id]) => id === draft.target)) setTarget(draft.target);
          if (typeof draft.output === "string") setOutput(draft.output);
          if (draft.reviewText === null || typeof draft.reviewText === "string") setReviewText(draft.reviewText);
          if (draft.reviewMode === "general" || draft.reviewMode === "visual") setReviewMode(draft.reviewMode);
          if (Array.isArray(draft.versions)) setVersions(draft.versions.filter((item) => item && typeof item.text === "string").slice(0, 8));
          setSaveState("Draft restored from this browser");
        } else {
          setSaveState("Ready");
        }
      } else {
        setSaveState("Ready");
      }
    } catch {
      setSaveState("Local draft storage is unavailable");
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    setSaveState("Saving…");
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, template, target, output, reviewText, reviewMode, versions }));
        setSaveState("Saved in this browser");
      } catch {
        setSaveState("Could not save this draft");
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [storageReady, form, template, target, output, reviewText, reviewMode, versions]);

  const analyzerText = reviewText ?? output ?? form.brief;
  const quality = useMemo(() => analyzePromptQuality(analyzerText, reviewMode), [analyzerText, reviewMode]);
  const currentTarget = MODEL_TARGETS.find(([id]) => id === target);
  const outputWords = output.trim() ? output.trim().split(/\s+/).length : 0;

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const addVersion = (text, label) => {
    if (!text.trim()) return;
    setVersions((current) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, label, date: new Date().toISOString() }, ...current].slice(0, 8));
  };
  const useTemplate = (item) => {
    if (output.trim()) addVersion(output, "Before template");
    setTemplate(item.id);
    setForm({
      ...EMPTY_FORM,
      brief: item.brief,
      role: item.role,
      context: item.context,
      constraints: item.constraints,
      format: item.format,
      example: item.example,
    });
    setOutput("");
    setReviewText(null);
    setError("");
    setNotice(`${item.name} starter loaded. Adjust any field before generating.`);
  };
  const generate = () => {
    if (!form.brief.trim()) {
      setError("Add a one-line instruction first, or choose a starter template.");
      return;
    }
    if (output.trim()) addVersion(output, "Before rebuild");
    const prompt = buildProfessionalPrompt({ ...form, target });
    setOutput(prompt);
    setReviewText(prompt);
    setError("");
    setNotice("Professional prompt created. Edit, analyze, or export it below.");
  };
  const restore = (version) => {
    if (output.trim()) addVersion(output, "Before restore");
    setOutput(version.text);
    setReviewText(version.text);
    setNotice(`Restored ${version.label.toLowerCase()}.`);
    setError("");
  };
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setNotice("Prompt copied to clipboard.");
      setError("");
    } catch {
      setError("Clipboard access was denied. Select the prompt and copy it manually.");
    }
  };
  const downloadPrompt = (asJson = false) => {
    if (asJson) {
      download("promptxpert-prompt.json", JSON.stringify({ prompt: output, target: currentTarget?.[1], output_format: form.format, quality: quality.score }, null, 2), "application/json");
    } else {
      download("promptxpert-prompt.txt", output);
    }
  };
  const rewrite = async (mode, arg = "") => {
    if (!output.trim()) {
      setError("Generate or enter a prompt before using rewrite tools.");
      return;
    }
    if (output.length > 2500) {
      setError("AI rewrite and translation currently support prompts up to 2,500 characters.");
      return;
    }
    setBusy(mode);
    setError("");
    setNotice("");
    try {
      const result = await api.transform(output, mode, arg);
      addVersion(output, mode === "polish" ? "Before AI polish" : `Before translation to ${arg}`);
      setOutput(result.text);
      setReviewText(result.text);
      setNotice(mode === "polish" ? "Prompt polished. Review the changes before using it." : `Prompt translated to ${arg}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy("");
    }
  };
  const clearDraft = () => {
    if (output.trim()) addVersion(output, "Before reset");
    setForm(EMPTY_FORM);
    setTemplate("");
    setTarget("universal");
    setOutput("");
    setReviewText(null);
    setError("");
    setNotice("Form cleared. Earlier prompt versions remain available.");
  };

  return (
    <main>
      <section className="relative mx-auto max-w-7xl px-5 pb-20 pt-28 sm:pt-32">
        <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-80 w-[min(90vw,56rem)] -translate-x-1/2 rounded-full bg-iris/15 blur-[120px]" />
        <motion.header initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-iris/25 bg-iris/10 px-3 py-1 text-xs font-medium text-iris"><Wand2 size={13} /> PROMPT ENGINEERING WORKSPACE</p>
              <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">From one line to<br className="hidden sm:block" /> a prompt with a plan.</h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-dim sm:text-lg">Turn a quick idea into a structured, ready-to-use instruction. Review its quality, refine it for your model, and keep working without losing your draft.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-line bg-panel/80 px-3 py-2 text-xs text-dim" aria-live="polite">
              <span className={`h-2 w-2 rounded-full ${saveState.includes("Could not") || saveState.includes("unavailable") ? "bg-warn" : "bg-real"}`} />
              {saveState}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-dim">
            {[["6", "expert starters"], ["5", "quality signals"], ["20+", "translation options across the studio"]].map(([value, label]) => (
              <span key={label} className="rounded-full border border-line bg-panel/70 px-3 py-1.5"><b className="text-lumen">{value}</b> {label}</span>
            ))}
            <span className="rounded-full border border-line bg-panel/70 px-3 py-1.5">Draft stays on this device</span>
          </div>
        </motion.header>

        <div className="mt-9 grid items-start gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(390px,.95fr)]">
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.55, ease }} className="space-y-5">
            <div className="card p-5 sm:p-7">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div><p className="flex items-center gap-2 font-display text-xl font-semibold"><BookOpen size={19} className="text-iris" />Start with a proven role</p><p className="mt-1 text-sm text-dim">Choose a starter, then make every detail your own.</p></div>
                <button onClick={clearDraft} className="btn btn-ghost !px-3 !py-2 text-xs"><RotateCcw size={14} /> Reset</button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PROMPT_TEMPLATES.map((item) => (
                  <motion.button key={item.id} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => useTemplate(item)} aria-pressed={template === item.id}
                    className={`rounded-xl border p-3 text-left transition-colors ${template === item.id ? "border-iris bg-iris/10" : "border-line bg-ink/35 hover:border-iris/50"}`}>
                    <span className="font-display text-base text-iris">{item.icon}</span><span className="mt-1 block text-sm font-semibold">{item.name}</span>
                  </motion.button>))}
              </div>
            </div>

            <div className="card space-y-5 p-5 sm:p-7">
              <div>
                <p className="flex items-center gap-2 font-display text-xl font-semibold"><Target size={19} className="text-iris" />Build your instruction</p>
                <p className="mt-1 text-sm text-dim">Start with the rough request; optional fields add useful context and control.</p>
              </div>
              <Field label="Your one-line instruction" hint={`${form.brief.length}/500`} value={form.brief} onChange={(value) => updateForm("brief", value.slice(0, 500))} placeholder="e.g. Plan a three-day Kyoto trip for a family on a budget" rows={2} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Role" hint="Who should the AI be?" value={form.role} onChange={(value) => updateForm("role", value)} placeholder="e.g. An experienced travel planner" rows={1} />
                <Field label="Audience" hint="Who is this for?" value={form.audience} onChange={(value) => updateForm("audience", value)} placeholder="e.g. A family travelling with children" rows={1} />
              </div>
              <Field label="Context" hint="Background that changes the answer" value={form.context} onChange={(value) => updateForm("context", value)} placeholder="Share relevant situation, product, or background. No need to repeat the request." rows={2} />
              <Field label="Objective" hint="What does success look like?" value={form.objective} onChange={(value) => updateForm("objective", value)} placeholder="Leave blank to use your one-line instruction as the objective." rows={2} />
              <Field label="Constraints" hint="Boundaries, sources, length, exclusions" value={form.constraints} onChange={(value) => updateForm("constraints", value)} placeholder="e.g. Stay under budget, use current sources, flag unknowns" rows={2} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-medium">Output format</span>
                  <span className="relative mt-2 block"><select value={form.format} onChange={(event) => updateForm("format", event.target.value)} className="field appearance-none !py-2.5 pr-9 text-sm">{OUTPUT_FORMATS.map((format) => <option key={format}>{format}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-dim" /></span>
                </label>
                <Field label="Tone" hint="How should it sound?" value={form.tone} onChange={(value) => updateForm("tone", value)} placeholder="e.g. Friendly, direct, and practical" rows={1} />
              </div>
              <Field label="Example (optional)" hint="A sample input/output or reference" value={form.example} onChange={(value) => updateForm("example", value)} placeholder="Show a small example of the answer you would consider successful." rows={2} />
              <div>
                <p className="mb-2 text-sm font-medium">Tune for a model</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {MODEL_TARGETS.map(([id, name, hint]) => (
                    <button key={id} onClick={() => setTarget(id)} aria-pressed={target === id} title={hint}
                      className={`rounded-xl border px-3 py-2 text-sm transition-all ${target === id ? "border-iris bg-iris/10 text-lumen" : "border-line text-dim hover:border-iris/50 hover:text-lumen"}`}>{name}</button>))}
                </div>
                <p className="mt-2 text-xs text-dim">{currentTarget?.[2]}</p>
              </div>
              <motion.button whileTap={{ scale: 0.99 }} onClick={generate} disabled={!form.brief.trim()} className="btn btn-primary w-full !py-3.5 disabled:cursor-not-allowed">
                <Sparkles size={17} /> Generate professional prompt
              </motion.button>
            </div>

            <AnimatePresence>
              {versions.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="card p-5 sm:p-6">
                  <div className="mb-4 flex items-center justify-between"><div><p className="flex items-center gap-2 font-display text-lg font-semibold"><Clock3 size={17} className="text-iris" />Recent versions</p><p className="mt-1 text-xs text-dim">Previous prompts are saved with this browser draft.</p></div><span className="text-xs text-dim">{versions.length}/8</span></div>
                  <ul className="space-y-2">{versions.slice(0, 4).map((version) => (
                    <li key={version.id} className="flex items-center gap-3 rounded-xl bg-raised/70 p-3">
                      <p className="min-w-0 flex-1 truncate text-xs text-dim"><b className="mr-2 text-iris">{version.label}</b>{version.text.replace(/\s+/g, " ").slice(0, 100)}</p>
                      <button onClick={() => restore(version)} className="btn btn-ghost !px-3 !py-1.5 text-xs">Restore</button>
                    </li>))}</ul>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.6, ease }} className="space-y-5 xl:sticky xl:top-24">
            <div className="card overflow-hidden">
              <div className="border-b border-line p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="flex items-center gap-2 font-display text-xl font-semibold"><Sparkles size={19} className="text-iris" />Your professional prompt</p><p className="mt-1 text-sm text-dim">Edit freely; your draft saves automatically on this device.</p></div>
                  {output && <span className="rounded-full bg-raised px-3 py-1 text-xs text-dim">{outputWords} words</span>}
                </div>
                <textarea value={output} onChange={(event) => { setOutput(event.target.value); setReviewText(event.target.value); }} rows={15} spellCheck={false} aria-label="Generated professional prompt" placeholder="Your structured prompt will appear here. Generate one from your brief, or paste a prompt to review it."
                  className="field mt-5 resize-y font-mono text-xs leading-relaxed sm:text-[13px]" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={copyPrompt} disabled={!output.trim()} className="btn btn-primary !px-4 !py-2 text-sm"><Copy size={15} /> Copy prompt</button>
                  <button onClick={() => downloadPrompt(false)} disabled={!output.trim()} className="btn btn-ghost !px-4 !py-2 text-sm"><ArrowDownToLine size={15} /> .txt</button>
                  <button onClick={() => downloadPrompt(true)} disabled={!output.trim()} className="btn btn-ghost !px-4 !py-2 text-sm"><FileJson size={15} /> Export JSON</button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  <button onClick={() => rewrite("polish")} disabled={!output.trim() || !!busy} className="btn btn-ghost !px-3 !py-2 text-xs">
                    {busy === "polish" ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} AI polish
                  </button>
                  <label className="flex items-center gap-2 text-xs text-dim">
                    <span className="sr-only">Translate prompt</span>
                    <select aria-label="Translate prompt" defaultValue="" disabled={!output.trim() || !!busy} onChange={(event) => { const language = event.target.value; event.target.value = ""; if (language) rewrite("translate", language); }}
                      className="field !w-auto !py-2 text-xs"><option value="" disabled>Translate…</option>{["Hindi", "Marathi", "English", "Bengali", "Gujarati", "Tamil", "Telugu", "Urdu", "Arabic", "French", "German", "Japanese", "Spanish"].map((language) => <option key={language}>{language}</option>)}</select>
                  </label>
                  <span className="ml-auto text-[11px] text-dim">AI tools support up to 2,500 characters</span>
                </div>
              </div>
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="flex items-center gap-2 font-display text-lg font-semibold"><Lightbulb size={18} className="text-warn" />Prompt quality analyzer</p><p className="mt-1 text-xs text-dim">Rubric-based feedback, not an AI verdict.</p></div>
                  <div className="flex rounded-full border border-line bg-ink/50 p-1" role="group" aria-label="Prompt analysis type">
                    {[["general", "General"], ["visual", "Visual"]].map(([id, label]) => (
                      <button key={id} aria-pressed={reviewMode === id} onClick={() => setReviewMode(id)} className={`rounded-full px-3 py-1.5 text-xs transition-colors ${reviewMode === id ? "bg-lumen text-ink" : "text-dim hover:text-lumen"}`}>{label}</button>))}
                  </div>
                </div>
                <label className="mt-4 block"><span className="text-xs font-medium text-dim">Prompt to analyze</span>
                  <textarea value={analyzerText} onChange={(event) => setReviewText(event.target.value)} rows={3} placeholder="Paste any prompt here to check it." aria-label="Prompt text to analyze" className="field mt-2 resize-y text-sm leading-relaxed" />
                </label>
                <div className="mt-5 flex items-center gap-4 rounded-xl border border-line bg-ink/35 p-4">
                  <MetricRing score={quality.score} />
                  <div><p className="font-display text-lg font-semibold">{quality.score}<span className="ml-1 text-sm font-normal text-dim">/ 100</span></p><p className="text-xs leading-relaxed text-dim">{quality.score >= 80 ? "Strong prompt coverage. Fine-tune details to suit your use case." : quality.score >= 55 ? "Good starting point. Add detail in the areas below." : "A few specifics can make this prompt much more useful."}</p><p className="mt-1 text-[11px] text-dim">{quality.words} words · {quality.characters} characters</p></div>
                </div>
                <div className="mt-4 space-y-3">
                  {quality.dimensions.map((item) => (
                    <div key={item.name}>
                      <div className="mb-1 flex items-center justify-between text-xs"><span>{item.name}</span><span className="tabular-nums text-dim">{item.score}</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-raised"><motion.div className={`h-full rounded-full ${item.score >= 70 ? "bg-real" : item.score >= 45 ? "bg-warn" : "bg-iris"}`} animate={{ width: `${item.score}%` }} transition={{ duration: 0.45, ease }} /></div>
                    </div>))}
                </div>
                <AnimatePresence mode="wait">
                  <motion.div key={quality.tips.map((item) => item.name).join("-")} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="mt-4">
                    {quality.tips.length ? (
                      <div className="rounded-xl border border-warn/20 bg-warn/5 p-3.5">
                        <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-warn"><Lightbulb size={14} />Ideas to improve</p>
                        <ul className="space-y-1.5">{quality.tips.slice(0, 3).map((tip) => <li key={tip.name} className="text-xs leading-relaxed text-dim"><b className="text-lumen">{tip.name}:</b> {tip.tip}</li>)}</ul>
                      </div>
                    ) : <p className="flex items-center gap-2 text-xs text-real"><Check size={14} /> Every quality area is well represented.</p>}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="card p-5 sm:p-6">
              <p className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><Check size={17} className="text-real" />What your prompt covers</p>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                {["Role", "Context", "Objective", "Constraints", "Output format", "Example"].map((label) => {
                  const included = output.toLowerCase().includes(`## ${label.toLowerCase()}`);
                  return <span key={label} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${included ? "bg-real/10 text-real" : "bg-raised text-dim"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{label}</span>;
                })}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-dim">An empty optional field is still explained in the generated prompt, so the model knows how to handle missing examples or context.</p>
            </div>
          </motion.section>
        </div>

        <AnimatePresence>
          {(error || notice) && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} role={error ? "alert" : "status"}
              className={`fixed bottom-5 left-1/2 z-40 flex w-[min(92vw,36rem)] -translate-x-1/2 items-start gap-3 rounded-2xl border p-4 text-sm shadow-2xl backdrop-blur-xl ${error ? "border-warn/40 bg-panel/95 text-warn" : "border-real/30 bg-panel/95 text-lumen"}`}>
              {error ? <AlertTriangle size={17} className="mt-0.5 shrink-0" /> : <Check size={17} className="mt-0.5 shrink-0 text-real" />}
              <span className="flex-1">{error || notice}</span>
              <button onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss message" className="text-dim hover:text-lumen">×</button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
      <Footer />
    </main>
  );
}
