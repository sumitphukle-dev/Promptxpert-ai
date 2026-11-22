"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Copy, Download, FileSearch, ImagePlus, Loader2, RefreshCw, ScanLine, Sparkles, Wand2 } from "lucide-react";
import Footer from "@/components/Footer";
import Gauge from "@/components/Gauge";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/api";

const EASE = [0.2, 0.8, 0.2, 1];
const STYLES = ["concise", "detailed", "cinematic", "illustrative"];
const FORMATS = [["plain", "Plain text"], ["midjourney", "Midjourney"], ["stable-diffusion", "Stable Diffusion"]];
const VERDICT = {
  "likely-ai": ["Leans AI-generated", "text-fake border-fake/40 bg-fake/10"],
  "likely-real": ["Leans real", "text-real border-real/40 bg-real/10"],
  inconclusive: ["Inconclusive", "text-warn border-warn/40 bg-warn/10"],
  conflicting: ["Signals conflict", "text-warn border-warn/40 bg-warn/10"],
  "not-assessed": ["Not assessed", "text-dim border-line bg-raised"],
};
const PROV = { generator_metadata: "Generator metadata found", present_unverified: "Credential found, not validated", absent: "No credential detected", no_metadata: "No metadata or credential detected" };

function Pill({ children, cls }) {
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${cls}`}>{children}</span>;
}

export default function Analyze() {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [drag, setDrag] = useState(false);
  const [ops, setOps] = useState({ detect: true, prompt: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState(null);
  const [style, setStyle] = useState("detailed");
  const [fmt, setFmt] = useState("plain");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef(null);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const pick = useCallback((f) => {
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setError("Use a JPEG, PNG or WebP image.");
    if (f.size > 10 * 1024 * 1024) return setError("That image is over 10 MB.");
    setError(""); setRes(null); setFile(f); setPreview(URL.createObjectURL(f));
  }, []);

  const run = async (only) => {
    if (!file) return;
    const operations = only || Object.keys(ops).filter((k) => ops[k]);
    if (!operations.length) return setError("Choose at least one thing to run.");
    setLoading(true); setError("");
    const fd = new FormData();
    fd.append("image", file); fd.append("style", style);
    operations.forEach((o) => fd.append("operations", o));
    try {
      const data = await api.analyze(fd);
      setRes((prev) => (only && prev ? { ...prev, prompt: data.prompt, prompt_error: data.prompt_error } : data));
      if (data.prompt) { setText(data.prompt.text); setFmt("plain"); }
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const recompose = async (nextStyle, nextFmt, polish = false) => {
    if (!res?.prompt) return;
    setBusy(true); setError("");
    try {
      const out = await api.compose({ attributes: res.prompt.attributes, style: nextStyle, format: nextFmt, polish, analysis_id: res.id });
      setText(out.text);
      if (out.polish_error) setError(out.polish_error);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const copy = async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    Object.assign(document.createElement("a"), { href: url, download: "prompt.txt" }).click();
    URL.revokeObjectURL(url);
  };

  const v = res?.verdict, d = res?.detection, p = res?.provenance;
  const [vLabel, vCls] = VERDICT[v?.overall] || VERDICT["not-assessed"];

  return (
    <main>
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-28">
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }} className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Analyze an image</motion.h1>
        <p className="mt-3 max-w-xl text-dim">Images are deleted after analysis. {user ? "Your results are saved to your history." : <>Sign in to save results. <Link href="/login" className="text-iris underline-offset-4 hover:underline">Sign in</Link></>}</p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          {/* Upload */}
          <div>
            <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
              onClick={() => inputRef.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              role="button" tabIndex={0} aria-label="Upload an image"
              className={`relative flex min-h-[320px] cursor-pointer items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 ${drag ? "scale-[1.01] border-iris bg-iris/10" : "border-line bg-panel hover:border-iris/60"}`}>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              {preview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Selected upload" className="max-h-[460px] w-full object-contain" />
                  {loading && (
                    <div className="absolute inset-0 overflow-hidden bg-ink/40">
                      <div className="absolute inset-y-0 w-28 animate-beam scanline" style={{ boxShadow: "0 0 50px 8px rgba(143,131,255,.45)" }} />
                    </div>
                  )}
                </>
              ) : (
                <div className="px-6 text-center">
                  <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }} className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-raised"><ImagePlus className="text-iris" /></motion.div>
                  <p className="font-semibold">Drop an image here, or click to choose</p>
                  <p className="mt-1 text-sm text-dim">JPEG, PNG or WebP, up to 10 MB</p>
                </div>
              )}
            </div>
            {file && <p className="mt-3 truncate text-sm text-dim">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB). <button className="text-iris hover:underline" onClick={() => inputRef.current?.click()}>Change</button></p>}
          </div>

          {/* Controls */}
          <div className="card h-fit p-6">
            <h2 className="font-display text-xl font-semibold">What should we run?</h2>
            <div className="mt-4 space-y-3">
              {[["detect", "Authenticity signals", "Classifier estimate plus provenance check", FileSearch], ["prompt", "Prompt reconstruction", "Describe the image and build an editable prompt", Wand2]].map(([k, t, s, Icon]) => (
                <label key={k} className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors ${ops[k] ? "border-iris/60 bg-iris/10" : "border-line hover:border-line/80"}`}>
                  <input type="checkbox" checked={ops[k]} onChange={(e) => setOps({ ...ops, [k]: e.target.checked })} className="mt-1 h-4 w-4 accent-[#8F83FF]" />
                  <span><span className="flex items-center gap-2 font-semibold"><Icon size={16} className="text-iris" />{t}</span><span className="text-sm text-dim">{s}</span></span>
                </label>
              ))}
            </div>
            {ops.prompt && (
              <div className="mt-5">
                <p className="mb-2 text-sm text-dim">Starting style</p>
                <div className="flex flex-wrap gap-2">{STYLES.map((s) => (
                  <button key={s} onClick={() => setStyle(s)} className={`rounded-full px-4 py-1.5 text-sm capitalize transition-colors ${style === s ? "bg-lumen text-ink" : "border border-line text-dim hover:text-lumen"}`}>{s}</button>))}
                </div>
              </div>
            )}
            <button onClick={() => run()} disabled={!file || loading} className="btn btn-primary mt-7 w-full">
              {loading ? <><Loader2 size={18} className="animate-spin" /> Analyzing</> : <><ScanLine size={18} /> Run analysis</>}
            </button>
            <p className="mt-3 text-center text-xs text-dim">First request may take ~30 s while the free server wakes up.</p>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-fake/40 bg-fake/10 p-4 text-sm">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-fake" /><span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <div ref={resultRef} className="scroll-mt-24">
          {res && (
            <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.12 } } }} className="mt-14 space-y-6">
              {d && (
                <motion.div variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } }} className="card grid gap-8 p-6 sm:p-8 md:grid-cols-[320px_1fr]">
                  <div>
                    <Gauge score={d.score} band={d.band} />
                    <p className="-mt-2 text-center font-display text-3xl font-semibold">{Math.round(d.score * 100)}<span className="text-lg text-dim">% AI-likelihood</span></p>
                  </div>
                  <div>
                    <Pill cls={vCls}>{vLabel}</Pill>
                    <ul className="mt-5 space-y-4">
                      {v?.evidence.map((e) => (
                        <li key={e.signal} className="border-l-2 border-line pl-4">
                          <p className="font-semibold">{e.signal}: <span className="text-dim">{e.signal === "Provenance" ? PROV[e.state] || e.state : e.state}</span></p>
                          <p className="mt-1 text-sm text-dim">{e.detail}</p>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-5 text-xs text-dim">{v?.disclaimer}</p>
                    <p className="mt-2 text-xs text-dim">Method: {d.method} ({d.model_version}). Total time {res.timings_ms.total} ms.</p>
                  </div>
                </motion.div>
              )}

              {p && (
                <motion.div variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } }} className="card p-6 sm:p-8">
                  <h2 className="font-display text-xl font-semibold">Provenance details</h2>
                  <p className="mt-2 text-sm text-dim">{p.c2pa.message}</p>
                  {p.generator_flags.length > 0 && <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-warn">{p.generator_flags.map((f) => <li key={f}>{f}</li>)}</ul>}
                  {Object.keys(p.exif).length > 0 && (
                    <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">{Object.entries(p.exif).map(([k, val]) => (<div key={k} className="flex justify-between gap-4 border-b border-line py-1.5"><dt className="text-dim">{k}</dt><dd className="truncate text-right">{val}</dd></div>))}</dl>
                  )}
                  {d?.signals?.length > 0 && (
                    <details className="mt-5 text-sm"><summary className="cursor-pointer text-iris">Heuristic signals</summary>
                      <ul className="mt-3 space-y-2">{d.signals.map((s) => <li key={s.name}><b>{s.name}:</b> {s.value}. <span className="text-dim">{s.note}</span></li>)}</ul></details>
                  )}
                </motion.div>
              )}

              {res.prompt_error && (
                <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} className="card flex flex-wrap items-center justify-between gap-4 p-6">
                  <p className="flex items-center gap-3 text-sm"><AlertTriangle size={18} className="text-warn" />{res.prompt_error}</p>
                  <button onClick={() => run(["prompt"])} disabled={loading} className="btn btn-ghost !py-2 text-sm"><RefreshCw size={15} /> Retry prompt</button>
                </motion.div>
              )}

              {res.prompt && (
                <motion.div variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } }} className="card p-6 sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <h2 className="font-display text-xl font-semibold">Reconstructed prompt</h2>
                    <div className="flex flex-wrap gap-2">
                      {STYLES.map((s) => (
                        <button key={s} disabled={busy} onClick={() => { setStyle(s); recompose(s, fmt); }} className={`rounded-full px-3.5 py-1 text-sm capitalize transition-colors ${style === s ? "bg-lumen text-ink" : "border border-line text-dim hover:text-lumen"}`}>{s}</button>))}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-dim">An approximate prompt based on what is visible, not the original one used to make the image.</p>
                  <div className="relative mt-5">
                    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} aria-label="Editable prompt" className="field resize-y leading-relaxed" />
                    {busy && <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-ink/60"><Loader2 className="animate-spin text-iris" /></div>}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <select value={fmt} onChange={(e) => { setFmt(e.target.value); recompose(style, e.target.value); }} aria-label="Prompt format" className="field !w-auto !py-2 text-sm">
                      {FORMATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                    <button onClick={() => recompose(style, fmt, true)} disabled={busy} className="btn btn-ghost !py-2 text-sm"><Sparkles size={15} /> Polish with Codestral</button>
                    <button onClick={copy} className="btn btn-primary !py-2 text-sm">{copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}</button>
                    <button onClick={download} className="btn btn-ghost !py-2 text-sm"><Download size={15} /> .txt</button>
                  </div>
                  <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(res.prompt.attributes).filter(([, val]) => (Array.isArray(val) ? val.length : val)).map(([k, val]) => (
                      <div key={k} className="rounded-xl bg-raised p-4"><p className="text-xs capitalize text-dim">{k.replace(/_/g, " ")}</p><p className="mt-1 text-sm">{Array.isArray(val) ? val.join(", ") : val}</p></div>
                    ))}
                  </div>
                </motion.div>
              )}
              {!user && <p className="text-center text-sm text-dim">Want to keep this? <Link href="/register" className="text-iris hover:underline">Create a free account</Link> and run it again to save it.</p>}
            </motion.div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
