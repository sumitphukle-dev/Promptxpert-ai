"use client";
import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BookmarkCheck, Check, Download, FileJson, Loader2, Minus, Plus, RotateCcw, Scissors, Shuffle, Sparkles, Undo2, Wand2, X, Languages, Expand, Ban } from "lucide-react";
import { api } from "@/lib/api";
import { CATS, DEFAULT_NEGATIVE, DETAIL, REIMAGINE, TARGETS, build, chipsFromResult, quality, stats } from "@/lib/promptbuilder";
import { STYLES, download } from "@/lib/util";
import CopyButton from "./CopyButton";
import PaletteBar from "./PaletteBar";

const LANGS = ["Spanish", "French", "German", "Hindi", "Japanese", "Portuguese"];
const Pill = ({ active, children, ...p }) => (
  <button {...p} className={`rounded-full px-4 py-1.5 text-sm transition-all ${active ? "bg-lumen text-ink shadow-[0_0_24px_-6px_rgba(143,131,255,.8)]" : "border border-line text-dim hover:border-iris/60 hover:text-lumen"} ${p.className || ""}`}>{children}</button>
);
const Section = ({ title, hint, children, right }) => (
  <div className="card p-5 sm:p-6">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-display text-lg font-semibold">{title}</h3>{hint && <p className="mt-0.5 text-sm text-dim">{hint}</p>}</div>{right}</div>
    {children}
  </div>
);

function Ring({ value }) {
  const R = 26, C = 2 * Math.PI * R, col = value >= 80 ? "#3DDDB4" : value >= 50 ? "#FFC65C" : "#FF5A8F";
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" role="img" aria-label={`Prompt completeness ${value} percent`}>
      <circle cx="32" cy="32" r={R} fill="none" stroke="#171B2B" strokeWidth="7" />
      <motion.circle cx="32" cy="32" r={R} fill="none" stroke={col} strokeWidth="7" strokeLinecap="round" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - value / 100) }} transition={{ duration: 0.8 }} />
    </svg>
  );
}

export default function PromptStudio({ res, preview, user }) {
  const attrs = res.prompt.attributes;
  const [chips, setChips] = useState(() => chipsFromResult(res));
  const [style, setStyle] = useState(res.prompt.style || "detailed");
  const [detail, setDetail] = useState(1);
  const [target, setTarget] = useState("plain");
  const [fx, setFx] = useState(null);
  const [negative, setNegative] = useState(attrs.negative_prompt || DEFAULT_NEGATIVE);
  const [manual, setManual] = useState(null);
  const [versions, setVersions] = useState([]);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const [vars, setVars] = useState(null);
  const [saved, setSaved] = useState(false);
  const [newCat, setNewCat] = useState("keywords");
  const [newText, setNewText] = useState("");
  const ar = res.aspect?.ratio || "3:2";

  const built = useMemo(() => build({ chips, style, detail, target, ar, reimagine: fx, negative }), [chips, style, detail, target, ar, fx, negative]);
  const text = manual ?? built;
  const st = stats(text, target);
  const q = quality(chips);
  const textRef = useRef(text); textRef.current = text;

  const snapshot = (label) => setVersions((v) => [{ id: Math.random(), label, text: textRef.current }, ...v].slice(0, 8));
  const touch = () => { if (manual !== null) { snapshot("Manual edit"); setManual(null); } };
  const toggle = (id) => { touch(); setChips((c) => c.map((x) => (x.id === id ? { ...x, on: !x.on } : x))); };
  const weight = (id, d) => { touch(); setChips((c) => c.map((x) => (x.id === id ? { ...x, w: Math.min(1.5, Math.max(0.5, +(x.w + d).toFixed(1))) } : x))); };
  const addChip = () => { if (!newText.trim()) return; touch(); setChips((c) => [...c, { id: `u${Math.random()}`, cat: newCat, text: newText.trim(), on: true, w: 1 }]); setNewText(""); };

  const ai = async (mode, arg = "") => {
    setBusy(mode + arg); setErr("");
    try {
      const out = await api.transform(mode === "negative" ? built : text, mode, arg);
      if (mode === "negative") setNegative(out.text);
      else { snapshot(`Before ${mode}`); setManual(out.text); }
    } catch (e) { setErr(e.message); } finally { setBusy(null); }
  };
  const makeVars = async () => { setBusy("vars"); setErr(""); try { setVars(await api.variations(attrs)); } catch (e) { setErr(e.message); } finally { setBusy(null); } };
  const save = async () => { try { await api.update(res.id, { prompt_text: text }); setSaved(true); setTimeout(() => setSaved(false), 2200); } catch (e) { setErr(e.message); } };
  const pack = () => download("prompt-pack.json", JSON.stringify({ target, prompt: text, negative_prompt: negative, aspect_ratio: ar, sd_size: res.aspect?.sd_size, palette: res.palette, keywords: attrs.keywords, alt_text: attrs.alt_text }, null, 2), "application/json");

  const grouped = CATS.map(([k, label]) => [k, label, chips.filter((c) => c.cat === k)]).filter(([, , l]) => l.length);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Left rail */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="card overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Source" className="max-h-72 w-full object-cover" />
          <div className="flex flex-wrap gap-2 p-4 text-xs">
            <span className="rounded-full bg-raised px-3 py-1">{res.file.width}×{res.file.height}</span>
            <span className="rounded-full bg-raised px-3 py-1">Ratio {ar}</span>
            {res.aspect?.sd_size && <span className="rounded-full bg-raised px-3 py-1">SDXL {res.aspect.sd_size}</span>}
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <Ring value={q.score} />
          <div className="min-w-0"><p className="font-display text-lg font-semibold">{q.score}% complete</p>
            <p className="text-xs text-dim">{q.missing.length ? `Add or enable: ${q.missing.join(", ")}` : "Every key aspect is covered."}</p></div>
        </div>
        <div className="card p-5"><p className="mb-3 text-sm font-semibold">Palette</p><PaletteBar palette={res.palette} /></div>
        {attrs.uncertain_observations?.length > 0 && <div className="card p-5"><p className="mb-2 text-sm font-semibold">The model wasn&apos;t sure about</p><ul className="list-disc space-y-1 pl-4 text-xs text-dim">{attrs.uncertain_observations.map((u) => <li key={u}>{u}</li>)}</ul></div>}
      </aside>

      {/* Studio */}
      <div className="min-w-0 space-y-5">
        <Section title="Target generator" hint="Each one gets prompt syntax it actually understands.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {TARGETS.map(([k, name, desc]) => (
              <button key={k} onClick={() => { touch(); setTarget(k); }} aria-pressed={target === k}
                className={`relative rounded-xl border p-3 text-left transition-colors ${target === k ? "border-iris bg-iris/10" : "border-line hover:border-iris/50"}`}>
                {target === k && <motion.span layoutId="target-glow" className="absolute inset-0 rounded-xl ring-2 ring-iris/70" />}
                <span className="relative block text-sm font-semibold">{name}</span><span className="relative mt-1 block text-[11px] leading-snug text-dim">{desc}</span>
              </button>))}
          </div>
        </Section>

        <Section title="Shape the prompt">
          <div className="flex flex-wrap gap-2">{STYLES.map((s) => <Pill key={s} active={style === s} onClick={() => { touch(); setStyle(s); }} className="capitalize">{s}</Pill>)}</div>
          <div className="mt-5 flex items-center gap-4"><span className="w-16 text-sm text-dim">Length</span>
            <input type="range" min="0" max="2" step="1" value={detail} onChange={(e) => { touch(); setDetail(+e.target.value); }} aria-label="Prompt length" className="flex-1 accent-[#8F83FF]" />
            <span className="w-16 text-right text-sm font-semibold">{DETAIL[detail]}</span></div>
          <p className="mb-2 mt-5 text-sm text-dim">Reimagine as</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(REIMAGINE).map(([k, [label]]) => <Pill key={k} active={fx === k} onClick={() => { touch(); setFx(fx === k ? null : k); }}>{label}</Pill>)}
          </div>
        </Section>

        <motion.div layout className="card relative overflow-hidden p-5 sm:p-6">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-iris/15 blur-[80px]" />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-lg font-semibold">Your prompt</h3>
              {manual !== null && <button onClick={() => { snapshot("Manual edit"); setManual(null); }} className="inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-3 py-1 text-xs text-warn"><RotateCcw size={12} /> Edited. Rebuild from chips</button>}
            </div>
            <div className="relative mt-4">
              <textarea value={text} onChange={(e) => setManual(e.target.value)} rows={7} spellCheck={false} aria-label="Prompt" className="field resize-y font-[450] leading-relaxed" />
              <AnimatePresence>{busy && busy !== "vars" && busy !== "negative" && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-ink/70 text-sm text-dim"><Loader2 className="animate-spin text-iris" size={18} /> Rewriting with Codestral...</motion.div>}</AnimatePresence>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-dim"><span>{st.used} / {st.limit} {st.unit}</span><span className={st.over ? "text-warn" : ""}>{st.note}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-raised"><motion.div className={`h-full rounded-full ${st.over ? "bg-warn" : "bg-iris"}`} animate={{ width: `${st.pct}%` }} /></div>
            </div>
            {err && <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-warn"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{err}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <CopyButton text={text} label="Copy prompt" className="btn btn-primary !py-2.5 text-sm" />
              <button onClick={() => download("prompt.txt", text)} className="btn btn-ghost !py-2 text-sm"><Download size={15} /> .txt</button>
              <button onClick={pack} className="btn btn-ghost !py-2 text-sm"><FileJson size={15} /> Prompt pack</button>
              {res.saved && <button onClick={save} className="btn btn-ghost !py-2 text-sm">{saved ? <><Check size={15} /> Saved</> : <><BookmarkCheck size={15} /> Save to library</>}</button>}
            </div>
            <div className="mt-5 border-t border-line pt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-dim">AI tools (Mistral Codestral)</p>
              <div className="flex flex-wrap gap-2">
                {[["polish", Sparkles, "Polish"], ["expand", Expand, "Expand"], ["shorten", Scissors, "Shorten"]].map(([m, Icon, l]) => (
                  <button key={m} onClick={() => ai(m)} disabled={!!busy} className="btn btn-ghost !py-2 text-sm"><Icon size={15} /> {l}</button>))}
                <button onClick={makeVars} disabled={!!busy} className="btn btn-ghost !py-2 text-sm">{busy === "vars" ? <Loader2 size={15} className="animate-spin" /> : <Shuffle size={15} />} 3 variations</button>
                <select aria-label="Translate prompt" defaultValue="" disabled={!!busy} onChange={(e) => { if (e.target.value) ai("translate", e.target.value); e.target.value = ""; }} className="field !w-auto !py-2 text-sm"><option value="" disabled>Translate to...</option>{LANGS.map((l) => <option key={l}>{l}</option>)}</select>
              </div>
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {vars && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Section title="Variations" hint={vars.source === "templates" ? `AI variations weren't available (${vars.note}); showing style templates.` : "Same scene, different camera, light or style."} right={<button onClick={() => setVars(null)} aria-label="Close" className="text-dim hover:text-lumen"><X size={18} /></button>}>
                <ul className="space-y-3">{vars.variations.map((x, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-raised p-4 text-sm leading-relaxed">
                    <span className="min-w-0 flex-1">{x}</span>
                    <span className="flex gap-2"><button onClick={() => { snapshot("Before variation"); setManual(x); }} className="btn btn-ghost !px-3 !py-1.5 text-xs">Use</button><CopyButton text={x} /></span>
                  </motion.li>))}</ul>
              </Section>
            </motion.div>)}
        </AnimatePresence>

        <Section title="Prompt builder" hint={target === "stable-diffusion" ? "Click a chip to switch it on or off. Use − and + to change its weight." : "Click a chip to switch it on or off. Add your own below."}>
          <div className="space-y-5">
            {grouped.map(([k, label, list]) => (
              <div key={k}><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dim">{label}</p>
                <div className="flex flex-wrap gap-2">
                  {list.map((c) => (
                    <motion.span layout key={c.id} className={`group inline-flex items-center gap-1 rounded-full border py-1 pl-3.5 pr-2 text-sm transition-colors ${c.on ? "border-iris/70 bg-iris/15 text-lumen" : "border-line text-dim hover:border-iris/40"}`}>
                      <button onClick={() => toggle(c.id)} aria-pressed={c.on} className="text-left">{c.text}</button>
                      {target === "stable-diffusion" && c.on && <span className="flex items-center gap-0.5 text-xs text-dim"><button onClick={() => weight(c.id, -0.1)} aria-label="Lower weight"><Minus size={11} /></button><span className="w-6 text-center tabular-nums">{c.w.toFixed(1)}</span><button onClick={() => weight(c.id, 0.1)} aria-label="Raise weight"><Plus size={11} /></button></span>}
                      <button onClick={() => { touch(); setChips((l) => l.filter((x) => x.id !== c.id)); }} aria-label={`Remove ${c.text}`} className="rounded-full p-0.5 text-dim opacity-0 transition-opacity hover:text-fake group-hover:opacity-100 focus:opacity-100"><X size={12} /></button>
                    </motion.span>))}
                </div></div>))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
            <select value={newCat} onChange={(e) => setNewCat(e.target.value)} aria-label="Chip category" className="field !w-auto !py-2 text-sm">{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <input value={newText} onChange={(e) => setNewText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addChip()} placeholder="Add your own term" aria-label="New term" className="field !w-auto min-w-[12rem] flex-1 !py-2 text-sm" />
            <button onClick={addChip} className="btn btn-ghost !py-2 text-sm"><Plus size={15} /> Add</button>
          </div>
        </Section>

        <div className="grid gap-5 md:grid-cols-2">
          <Section title="Negative prompt" right={<button onClick={() => ai("negative")} disabled={!!busy} className="btn btn-ghost !px-3 !py-1.5 text-xs">{busy === "negative" ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />} Suggest</button>}>
            <textarea value={negative} onChange={(e) => { touch(); setNegative(e.target.value); }} rows={3} aria-label="Negative prompt" className="field text-sm" />
            <p className="mt-2 text-xs text-dim">Used by Midjourney (--no) and Stable Diffusion.</p>
          </Section>
          {attrs.alt_text && <Section title="Alt text" hint="Accessibility description of this image."><p className="text-sm leading-relaxed text-dim">{attrs.alt_text}</p><div className="mt-4"><CopyButton text={attrs.alt_text} /></div></Section>}
        </div>

        {versions.length > 0 && (
          <Section title="Version history" hint="Your edits and AI rewrites are kept so you can go back.">
            <ul className="space-y-2">{versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 rounded-xl bg-raised px-4 py-2.5 text-sm"><span className="min-w-0"><b className="mr-2 text-xs text-iris">{v.label}</b><span className="truncate text-dim">{v.text.slice(0, 90)}{v.text.length > 90 ? "…" : ""}</span></span>
                <button onClick={() => { snapshot("Before restore"); setManual(v.text); }} className="btn btn-ghost !px-3 !py-1.5 text-xs"><Undo2 size={13} /> Restore</button></li>))}</ul>
          </Section>)}
      </div>
    </div>
  );
}
