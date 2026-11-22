"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ImagePlus, Loader2, ScanLine } from "lucide-react";
import Footer from "@/components/Footer";
import Gauge from "@/components/Gauge";
import PaletteBar from "@/components/PaletteBar";
import { api } from "@/lib/api";

function Drop({ label, file, preview, onFile }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  return (
    <div onClick={() => ref.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ref.current?.click()} role="button" tabIndex={0} aria-label={`Choose image ${label}`}
      className={`relative flex min-h-[220px] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all ${drag ? "border-iris bg-iris/10" : "border-line bg-panel hover:border-iris/60"}`}>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      {preview ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt={`Image ${label}`} className="max-h-72 w-full object-contain" /> : <div className="text-center text-dim"><ImagePlus className="mx-auto mb-2 text-iris" /><p className="font-semibold text-lumen">Image {label}</p><p className="text-xs">Click or drop</p></div>}
      <span className="absolute left-3 top-3 rounded-full bg-ink/80 px-2.5 py-0.5 text-xs font-bold">{label}</span>
    </div>
  );
}

function Slider({ a, b }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="relative mx-auto aspect-[4/3] max-w-3xl select-none overflow-hidden rounded-2xl border border-line bg-ink">
      {/* eslint-disable-next-line @next/next/no-img-element */}<img src={b} alt="Image B" className="absolute inset-0 h-full w-full object-cover" />
      {/* eslint-disable-next-line @next/next/no-img-element */}<img src={a} alt="Image A" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-lumen shadow-[0_0_20px_4px_rgba(143,131,255,.7)]" style={{ left: `${pos}%` }}><span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-lumen text-xs font-bold text-ink">⇆</span></div>
      <input type="range" min="0" max="100" value={pos} onChange={(e) => setPos(+e.target.value)} aria-label="Compare slider" className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
    </div>
  );
}

export default function Compare() {
  const [files, setFiles] = useState({});
  const [prev, setPrev] = useState({});
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => () => Object.values(prev).forEach((u) => URL.revokeObjectURL(u)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (k) => (f) => {
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setErr("Use JPEG, PNG or WebP images.");
    setErr(""); setRes(null); setFiles((x) => ({ ...x, [k]: f })); setPrev((x) => { if (x[k]) URL.revokeObjectURL(x[k]); return { ...x, [k]: URL.createObjectURL(f) }; });
  };
  const run = async () => {
    setBusy(true); setErr("");
    const fd = new FormData(); fd.append("a", files.a); fd.append("b", files.b);
    try { setRes(await api.compare(fd)); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const R = 40, C = 2 * Math.PI * R;

  return (
    <main>
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-28">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Compare two images</h1>
        <p className="mt-3 max-w-xl text-dim">See how similar two pictures are, and how their authenticity estimates and colours differ. Spot a re-upload, an edit or a near-duplicate.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2"><Drop label="A" file={files.a} preview={prev.a} onFile={pick("a")} /><Drop label="B" file={files.b} preview={prev.b} onFile={pick("b")} /></div>
        <button onClick={run} disabled={!files.a || !files.b || busy} className="btn btn-primary mt-6">{busy ? <><Loader2 size={17} className="animate-spin" /> Comparing</> : <><ScanLine size={17} /> Compare</>}</button>
        {err && <p role="alert" className="mt-5 flex items-center gap-2 text-sm text-fake"><AlertTriangle size={16} />{err}</p>}

        {res && (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="mt-12 space-y-5">
            <div className="card flex flex-wrap items-center gap-8 p-6 sm:p-8">
              <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90" role="img" aria-label={`${res.similarity} percent similar`}>
                <circle cx="50" cy="50" r={R} fill="none" stroke="#171B2B" strokeWidth="10" />
                <motion.circle cx="50" cy="50" r={R} fill="none" stroke={res.similarity > 85 ? "#FF5A8F" : res.similarity > 60 ? "#FFC65C" : "#3DDDB4"} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - res.similarity / 100) }} transition={{ duration: 1 }} />
              </svg>
              <div><p className="font-display text-5xl font-semibold tabular-nums">{res.similarity}%</p><p className="mt-1 text-dim">visual similarity</p>
                <p className="mt-3 text-sm">{res.identical ? "These are the same file." : res.similarity > 90 ? "Very likely the same picture, possibly resized, recompressed or lightly edited." : res.similarity > 70 ? "Related images with noticeable differences." : "Different images."}</p>
                <p className="mt-1 text-xs text-dim">Perceptual hash distance {res.hash_distance}/64 · authenticity estimates differ by {Math.round(res.score_gap * 100)} points</p></div>
            </div>
            {files.a && prev.a && prev.b && <div className="card p-6"><h2 className="mb-4 font-display text-xl font-semibold">Slide to compare</h2><Slider a={prev.a} b={prev.b} /></div>}
            <div className="grid gap-5 md:grid-cols-2">
              {["a", "b"].map((k) => { const s = res[k]; return (
                <div key={k} className="card p-6">
                  <h2 className="font-display text-xl font-semibold">Image {k.toUpperCase()}</h2><p className="truncate text-sm text-dim">{s.name} · {s.width}×{s.height} · {s.aspect.ratio} · {(s.bytes / 1024).toFixed(0)} KB</p>
                  <div className="mx-auto mt-4 max-w-[240px]"><Gauge score={s.detection.score} band={s.detection.band} /></div>
                  <p className="-mt-1 text-center text-sm">{Math.round(s.detection.score * 100)}% AI-likelihood · <span className="capitalize text-dim">{s.detection.label}</span></p>
                  <div className="mt-5"><PaletteBar palette={s.palette} /></div>
                  <p className="mt-4 text-xs text-dim">Privacy risk in metadata: {s.privacy_risk}</p>
                </div>); })}
            </div>
          </motion.div>)}
      </section>
      <Footer />
    </main>
  );
}
