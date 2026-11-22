"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Download, ImagePlus, Loader2, Plus, RefreshCw, Wand2, X } from "lucide-react";
import Footer from "@/components/Footer";
import PromptStudio from "@/components/PromptStudio";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/api";
import { download } from "@/lib/util";

const EASE = [0.2, 0.8, 0.2, 1];
const MAX = 6;
const uid = () => Math.random().toString(36).slice(2, 10);
const STAGES = ["Reading your image", "Identifying subject and scene", "Analysing light, composition and colour", "Writing your prompts"];

export default function Generator() {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const ref = useRef([]);
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [drag, setDrag] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState(0);
  ref.current = items;
  useEffect(() => () => ref.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);
  useEffect(() => { if (!running) return; setStage(0); const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 2200); return () => clearInterval(t); }, [running]);

  const add = useCallback((files) => {
    const next = []; let msg = "";
    for (const f of Array.from(files || [])) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) { msg = "Only JPEG, PNG or WebP images are supported."; continue; }
      if (f.size > 10 * 1024 * 1024) { msg = `${f.name || "Image"} is over 10 MB.`; continue; }
      next.push({ id: uid(), file: f, preview: URL.createObjectURL(f), status: "idle" });
    }
    setItems((cur) => {
      const room = MAX - cur.length;
      if (next.length > room) { msg = `You can queue up to ${MAX} images.`; next.slice(room).forEach((n) => URL.revokeObjectURL(n.preview)); }
      const merged = [...cur, ...next.slice(0, room)];
      if (!cur.length && merged.length) setActive(merged[0].id);
      return merged;
    });
    setError(msg);
  }, []);
  useEffect(() => {
    const onPaste = (e) => { const f = Array.from(e.clipboardData?.files || []).filter((x) => x.type.startsWith("image/")); if (f.length) add(f); };
    window.addEventListener("paste", onPaste); return () => window.removeEventListener("paste", onPaste);
  }, [add]);

  const patch = (id, p) => setItems((c) => c.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const remove = (id) => setItems((cur) => { const g = cur.find((i) => i.id === id); if (g) URL.revokeObjectURL(g.preview); const rest = cur.filter((i) => i.id !== id); setActive((a) => (a === id ? rest[0]?.id ?? null : a)); return rest; });

  const generate = async (only) => {
    setError(""); setRunning(true);
    const todo = only ? ref.current.filter((i) => i.id === only) : ref.current.filter((i) => i.status !== "done");
    for (const it of todo) {
      patch(it.id, { status: "running", error: "" }); setActive(it.id);
      const fd = new FormData(); fd.append("image", it.file); fd.append("operations", "prompt"); fd.append("style", "detailed");
      try { patch(it.id, { status: "done", res: await api.analyze(fd) }); } catch (e) { patch(it.id, { status: "error", error: e.message }); }
    }
    setRunning(false);
  };

  const cur = items.find((i) => i.id === active);
  const pending = items.filter((i) => i.status !== "done" && i.status !== "running").length;
  const exportAll = () => download("prompts.json", JSON.stringify(items.filter((i) => i.res?.prompt).map((i) => ({ image: i.file.name, prompt: i.res.prompt.text, negative_prompt: i.res.prompt.attributes.negative_prompt, ratio: i.res.aspect?.ratio, palette: i.res.palette?.map((c) => c.hex) })), null, 2), "application/json");

  return (
    <main>
      <section className="relative mx-auto max-w-6xl px-5 pb-20 pt-28">
        <div aria-hidden className="absolute -top-10 left-1/2 -z-10 h-80 w-[700px] -translate-x-1/2 rounded-full bg-iris/15 blur-[120px]" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs text-dim"><Wand2 size={13} className="text-iris" /> Image to Prompt Generator</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">Turn any image into<br />the perfect prompt</h1>
          <p className="mt-4 max-w-xl text-dim">Upload an image and get ready-to-use prompts for Midjourney, Stable Diffusion, Flux and DALL·E, then fine-tune every detail in the studio. Images are deleted after analysis. {!user && <Link href="/register" className="text-iris hover:underline">Create a free account</Link>} {!user && "to save your prompts."}</p>
        </motion.div>

        <div className="mt-10">
          {!items.length ? (
            <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
              onClick={() => inputRef.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()} role="button" tabIndex={0} aria-label="Upload images"
              className={`flex min-h-[300px] cursor-pointer items-center justify-center rounded-3xl border-2 border-dashed transition-all duration-300 ${drag ? "scale-[1.01] border-iris bg-iris/10" : "border-line bg-panel hover:border-iris/60"}`}>
              <div className="px-6 text-center"><motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-raised"><ImagePlus className="text-iris" size={26} /></motion.div>
                <p className="text-lg font-semibold">Drop an image here, click to choose, or paste</p><p className="mt-1 text-sm text-dim">JPEG, PNG or WebP, up to 10 MB. Add up to {MAX} at once.</p></div>
            </div>
          ) : (
            <div className="card flex flex-wrap items-center gap-4 p-4">
              <div className="flex flex-1 gap-3 overflow-x-auto py-1">
                {items.map((it) => (
                  <motion.div layout key={it.id} className="relative shrink-0">
                    <button onClick={() => setActive(it.id)} aria-label="Select image" className={`h-16 w-16 overflow-hidden rounded-xl border-2 transition-all ${active === it.id ? "border-iris" : "border-line opacity-60 hover:opacity-100"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}<img src={it.preview} alt="" className="h-full w-full object-cover" /></button>
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-ink p-0.5">{it.status === "running" ? <Loader2 size={14} className="animate-spin text-iris" /> : it.status === "done" ? <CheckCircle2 size={14} className="text-real" /> : it.status === "error" ? <AlertTriangle size={14} className="text-fake" /> : null}</span>
                    {!running && <button onClick={() => remove(it.id)} aria-label="Remove image" className="absolute -right-1.5 -top-1.5 rounded-full border border-line bg-raised p-0.5 text-dim hover:text-lumen"><X size={12} /></button>}
                  </motion.div>))}
                {items.length < MAX && !running && <button onClick={() => inputRef.current?.click()} aria-label="Add more images" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-line text-dim hover:border-iris hover:text-lumen"><Plus size={20} /></button>}
              </div>
              <div className="flex flex-wrap gap-2">
                {items.filter((i) => i.res?.prompt).length > 1 && <button onClick={exportAll} className="btn btn-ghost !py-2.5 text-sm"><Download size={15} /> Export all</button>}
                <button onClick={() => generate()} disabled={!pending || running} className="btn btn-primary !py-2.5">{running ? <><Loader2 size={17} className="animate-spin" /> Working</> : <><Wand2 size={17} /> {items.length > 1 && pending ? `Generate ${pending} prompts` : "Generate prompt"}</>}</button>
              </div>
            </div>
          )}
          <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </div>

        <AnimatePresence>{error && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-fake/40 bg-fake/10 p-4 text-sm"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-fake" /><span>{error}</span></motion.div>}</AnimatePresence>

        {cur?.status === "running" && (
          <div className="card relative mt-6 overflow-hidden p-6">
            <div className="grid items-center gap-6 sm:grid-cols-[200px_1fr]">
              <div className="relative overflow-hidden rounded-2xl">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={cur.preview} alt="" className="h-40 w-full object-cover" /><div className="absolute inset-0 bg-ink/40" /><div className="absolute inset-y-0 w-20 animate-beam scanline" style={{ boxShadow: "0 0 40px 6px rgba(143,131,255,.45)" }} /></div>
              <ul className="space-y-3 text-sm">{STAGES.map((s, i) => (
                <li key={s} className={`flex items-center gap-3 transition-opacity ${i > stage ? "opacity-30" : ""}`}>{i < stage ? <CheckCircle2 size={16} className="text-real" /> : i === stage ? <Loader2 size={16} className="animate-spin text-iris" /> : <span className="h-4 w-4 rounded-full border border-line" />}{s}</li>))}</ul>
            </div>
            <p className="mt-4 text-xs text-dim">The first request after a quiet period can take ~30 s while the free server wakes up.</p>
          </div>)}
        {cur?.status === "error" && <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-fake/40 bg-fake/10 p-4 text-sm"><span>{cur.error}</span><button onClick={() => generate(cur.id)} className="btn btn-ghost !py-2 text-sm"><RefreshCw size={14} /> Try again</button></div>}

        {items.filter((i) => i.res).map((i) => (
          <div key={i.id} className={`mt-10 ${i.id === active ? "" : "hidden"}`}>
            {i.res.prompt ? <PromptStudio res={i.res} preview={i.preview} user={user} />
              : <div className="card flex flex-wrap items-center justify-between gap-4 p-6"><p className="flex items-center gap-3 text-sm"><AlertTriangle size={18} className="text-warn" />{i.res.prompt_error || "No prompt was returned."}</p><button onClick={() => generate(i.id)} disabled={running} className="btn btn-ghost !py-2 text-sm"><RefreshCw size={15} /> Retry</button></div>}
          </div>))}
      </section>
      <Footer />
    </main>
  );
}
