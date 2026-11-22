"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, FileSearch, Layers, ImagePlus, Loader2, Plus, ScanLine, Wand2, X } from "lucide-react";
import Footer from "@/components/Footer";
import ResultView from "@/components/ResultView";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/api";
import { STYLES } from "@/lib/util";

const EASE = [0.2, 0.8, 0.2, 1];
const MAX_ITEMS = 6;
const OPS = [["detect", "Authenticity signals", "Classifier, provenance and robustness check", FileSearch],
  ["forensics", "Forensic maps", "Error-level, noise and frequency heatmaps", Layers],
  ["prompt", "Prompt reconstruction", "Describe the image and build an editable prompt", Wand2]];
const uid = () => Math.random().toString(36).slice(2, 10);

export default function Analyze() {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const itemsRef = useRef([]);
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [drag, setDrag] = useState(false);
  const [ops, setOps] = useState({ detect: true, forensics: true, prompt: true });
  const [style, setStyle] = useState("detailed");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const resultRef = useRef(null);

  itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  const add = useCallback((files) => {
    const next = []; let msg = "";
    for (const f of Array.from(files || [])) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) { msg = "Only JPEG, PNG or WebP images are supported."; continue; }
      if (f.size > 10 * 1024 * 1024) { msg = `${f.name || "Image"} is over 10 MB.`; continue; }
      next.push({ id: uid(), file: f, preview: URL.createObjectURL(f), status: "idle" });
    }
    setItems((cur) => {
      const room = MAX_ITEMS - cur.length;
      if (next.length > room) { msg = `You can queue up to ${MAX_ITEMS} images at once.`; next.slice(room).forEach((n) => URL.revokeObjectURL(n.preview)); }
      const merged = [...cur, ...next.slice(0, room)];
      if (!cur.length && merged.length) setActive(merged[0].id);
      return merged;
    });
    setError(msg);
  }, []);

  useEffect(() => {
    const onPaste = (e) => { const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith("image/")); if (files.length) add(files); };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [add]);

  const patch = (id, p) => setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const remove = (id) => setItems((cur) => {
    const gone = cur.find((i) => i.id === id); if (gone) URL.revokeObjectURL(gone.preview);
    const rest = cur.filter((i) => i.id !== id);
    setActive((a) => (a === id ? rest[0]?.id ?? null : a));
    return rest;
  });

  const analyzeOne = async (item, operations) => {
    const fd = new FormData();
    fd.append("image", item.file); fd.append("style", style);
    operations.forEach((o) => fd.append("operations", o));
    return api.analyze(fd);
  };

  const runAll = async () => {
    const operations = Object.keys(ops).filter((k) => ops[k]);
    if (!operations.length) return setError("Choose at least one thing to run.");
    setError(""); setRunning(true);
    for (const it of itemsRef.current.filter((i) => i.status !== "done")) {
      patch(it.id, { status: "running", error: "" }); setActive(it.id);
      try { patch(it.id, { status: "done", res: await analyzeOne(it, operations) }); }
      catch (e) { patch(it.id, { status: "error", error: e.message }); }
    }
    setRunning(false);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  };

  const [retrying, setRetrying] = useState(false);
  const retryPrompt = async (item) => {
    setRetrying(true);
    try {
      const data = await analyzeOne(item, ["prompt"]);
      patch(item.id, { res: { ...item.res, prompt: data.prompt, prompt_error: data.prompt_error } });
    } catch (e) { setError(e.message); } finally { setRetrying(false); }
  };

  const cur = items.find((i) => i.id === active);
  const pending = items.filter((i) => i.status !== "done").length;

  return (
    <main>
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-28">
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }} className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Analyze images</motion.h1>
        <p className="mt-3 max-w-xl text-dim">Images are deleted after analysis. Add up to {MAX_ITEMS}, or paste one with Ctrl/Cmd+V. {user ? "Results are saved to your history." : <>Sign in to save results. <Link href="/login" className="text-iris underline-offset-4 hover:underline">Sign in</Link></>}</p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
              onClick={() => !cur && inputRef.current?.click()} onKeyDown={(e) => !cur && (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              role={cur ? undefined : "button"} tabIndex={cur ? -1 : 0} aria-label="Upload images"
              className={`relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 ${cur ? "cursor-default" : "cursor-pointer"} ${drag ? "scale-[1.01] border-iris bg-iris/10" : "border-line bg-panel hover:border-iris/60"}`}>
              <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
              {cur ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cur.preview} alt="Selected upload" className="max-h-[460px] w-full object-contain" />
                  {cur.status === "running" && <div className="absolute inset-0 overflow-hidden bg-ink/40"><div className="absolute inset-y-0 w-28 animate-beam scanline" style={{ boxShadow: "0 0 50px 8px rgba(143,131,255,.45)" }} /></div>}
                </>
              ) : (
                <div className="px-6 text-center">
                  <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }} className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-raised"><ImagePlus className="text-iris" /></motion.div>
                  <p className="font-semibold">Drop images here, click to choose, or paste</p>
                  <p className="mt-1 text-sm text-dim">JPEG, PNG or WebP, up to 10 MB each</p>
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {items.map((it) => (
                  <motion.div layout key={it.id} className="relative shrink-0">
                    <button onClick={() => setActive(it.id)} aria-label="Select image" className={`h-16 w-16 overflow-hidden rounded-xl border-2 transition-all ${active === it.id ? "border-iris" : "border-line opacity-70 hover:opacity-100"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.preview} alt="" className="h-full w-full object-cover" />
                    </button>
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-ink p-0.5">
                      {it.status === "running" ? <Loader2 size={14} className="animate-spin text-iris" /> : it.status === "done" ? <CheckCircle2 size={14} className="text-real" /> : it.status === "error" ? <AlertTriangle size={14} className="text-fake" /> : null}
                    </span>
                    {!running && <button onClick={() => remove(it.id)} aria-label="Remove image" className="absolute -right-1.5 -top-1.5 rounded-full border border-line bg-raised p-0.5 text-dim hover:text-lumen"><X size={12} /></button>}
                  </motion.div>
                ))}
                {items.length < MAX_ITEMS && !running && <button onClick={() => inputRef.current?.click()} aria-label="Add more images" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-line text-dim hover:border-iris hover:text-lumen"><Plus size={20} /></button>}
              </div>
            )}
            {cur?.status === "error" && <p role="alert" className="mt-2 text-sm text-fake">{cur.error}</p>}
          </div>

          <div className="card h-fit p-6">
            <h2 className="font-display text-xl font-semibold">What should we run?</h2>
            <div className="mt-4 space-y-3">
              {OPS.map(([k, t, s, Icon]) => (
                <label key={k} className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors ${ops[k] ? "border-iris/60 bg-iris/10" : "border-line hover:border-line/80"}`}>
                  <input type="checkbox" checked={ops[k]} onChange={(e) => setOps({ ...ops, [k]: e.target.checked })} className="mt-1 h-4 w-4 accent-[#8F83FF]" />
                  <span><span className="flex items-center gap-2 font-semibold"><Icon size={16} className="text-iris" />{t}</span><span className="text-sm text-dim">{s}</span></span>
                </label>))}
            </div>
            {ops.prompt && (
              <div className="mt-5"><p className="mb-2 text-sm text-dim">Starting style</p>
                <div className="flex flex-wrap gap-2">{STYLES.map((s) => <button key={s} onClick={() => setStyle(s)} className={`rounded-full px-4 py-1.5 text-sm capitalize transition-colors ${style === s ? "bg-lumen text-ink" : "border border-line text-dim hover:text-lumen"}`}>{s}</button>)}</div></div>
            )}
            <button onClick={runAll} disabled={!pending || running} className="btn btn-primary mt-7 w-full">
              {running ? <><Loader2 size={18} className="animate-spin" /> Analyzing {items.filter((i) => i.status === "done").length + 1} of {items.length}</> : <><ScanLine size={18} /> {items.length > 1 ? `Run analysis on ${pending} image${pending === 1 ? "" : "s"}` : "Run analysis"}</>}
            </button>
            <p className="mt-3 text-center text-xs text-dim">First request may take ~30 s while the free server wakes up.</p>
          </div>
        </div>

        <AnimatePresence>
          {error && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-fake/40 bg-fake/10 p-4 text-sm"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-fake" /><span>{error}</span></motion.div>}
        </AnimatePresence>

        <div ref={resultRef} className="scroll-mt-24">
          {items.filter((i) => i.res).map((i) => (
            <div key={i.id} className={`mt-14 ${i.id === active ? "" : "hidden"}`}>
              <ResultView res={i.res} preview={i.preview} file={i.file} user={user} onRetryPrompt={() => retryPrompt(i)} retrying={retrying} />
            </div>))}
        </div>
      </section>
      <Footer />
    </main>
  );
}
