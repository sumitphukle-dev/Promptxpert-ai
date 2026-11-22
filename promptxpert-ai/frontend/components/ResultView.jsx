"use client";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Download, FileJson, Loader2, RefreshCw, ShieldAlert, ShieldCheck, Shuffle, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { FORMATS, PROV, RISK, STYLES, VERDICT, cleanCopy, download } from "@/lib/util";
import CopyButton from "./CopyButton";
import Gauge from "./Gauge";
import HeatViewer from "./HeatViewer";
import PaletteBar from "./PaletteBar";
import Tabs from "./Tabs";

const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.35 } };
const Card = ({ title, children, className = "" }) => (
  <div className={`card p-6 sm:p-8 ${className}`}>{title && <h3 className="mb-4 font-display text-xl font-semibold">{title}</h3>}{children}</div>
);

export default function ResultView({ res, preview, file, user, onRetryPrompt, retrying }) {
  const d = res.detection, v = res.verdict;
  const tabs = [["overview", "Overview"]];
  if (res.forensics || res.robustness) tabs.push(["forensics", "Forensics"]);
  tabs.push(["privacy", "Metadata & privacy"]);
  if (res.prompt || res.prompt_error) tabs.push(["prompt", "Prompt"]);
  const [tab, setTab] = useState("overview");
  const [style, setStyle] = useState(res.prompt?.style || "detailed");
  const [fmt, setFmt] = useState("plain");
  const [text, setText] = useState(res.prompt?.text || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [vars, setVars] = useState(null);
  const [varBusy, setVarBusy] = useState(false);
  const [label, vCls] = VERDICT[v?.overall] || VERDICT["not-assessed"];
  const attrs = res.prompt?.attributes;

  const recompose = async (s, f, polish = false) => {
    setBusy(true); setErr("");
    try {
      const out = await api.compose({ attributes: attrs, style: s, format: f, polish, analysis_id: res.id });
      setText(out.text);
      if (out.polish_error) setErr(out.polish_error);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const makeVariations = async () => {
    setVarBusy(true); setErr("");
    try { setVars(await api.variations(attrs)); } catch (e) { setErr(e.message); } finally { setVarBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={tabs} value={tab} onChange={setTab} id={`tabs-${res.file.sha256.slice(0, 6)}`} />
        <div className="flex gap-2">
          {res.saved && res.id ? (
            <>
              <button className="btn btn-ghost !py-2 !px-3 text-xs" onClick={() => api.report(res.id, "md").catch((e) => setErr(e.message))}><Download size={14} /> Report</button>
              <button className="btn btn-ghost !py-2 !px-3 text-xs" onClick={() => api.report(res.id, "json").catch((e) => setErr(e.message))}><FileJson size={14} /> JSON</button>
            </>
          ) : (
            <button className="btn btn-ghost !py-2 !px-3 text-xs" onClick={() => download("promptxpert-report.json", JSON.stringify({ ...res, forensics: undefined }, null, 2), "application/json")}><FileJson size={14} /> Export JSON</button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} {...fade} className="space-y-5">
          {tab === "overview" && (
            <>
              {d ? (
                <Card className="grid gap-8 md:grid-cols-[300px_1fr]">
                  <div>
                    <Gauge score={d.score} band={d.band} />
                    <p className="-mt-2 text-center font-display text-3xl font-semibold">{Math.round(d.score * 100)}<span className="text-lg text-dim">% AI-likelihood</span></p>
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${vCls}`}>{label}</span>
                    <ul className="mt-5 space-y-4">
                      {v?.evidence.map((e) => (
                        <li key={e.signal} className="border-l-2 border-line pl-4">
                          <p className="font-semibold">{e.signal}: <span className="text-dim">{e.signal === "Provenance" ? PROV[e.state] || e.state : e.state}</span></p>
                          <p className="mt-1 text-sm text-dim">{e.detail}</p>
                        </li>))}
                    </ul>
                    {res.robustness && !res.robustness.stable && <p className="mt-4 flex items-start gap-2 text-sm text-warn"><AlertTriangle size={16} className="mt-0.5 shrink-0" />The estimate changes under ordinary edits (see Forensics), so be extra cautious.</p>}
                    <p className="mt-5 text-xs text-dim">{v?.disclaimer} Method: {d.method} ({d.model_version}).</p>
                  </div>
                </Card>
              ) : <Card><p className="text-dim">Authenticity signals were not selected for this run.</p></Card>}
              <Card title="Colour palette"><PaletteBar palette={res.palette} /></Card>
              {res.similar?.length > 0 && (
                <Card title="You've seen something like this">
                  <ul className="space-y-2 text-sm">{res.similar.map((s) => <li key={s.id} className="flex items-center justify-between rounded-lg bg-raised px-4 py-2.5"><span>{s.title}</span><span className="text-dim">{s.exact ? "identical file" : `visually similar (distance ${s.distance})`}</span></li>)}</ul>
                </Card>
              )}
              <p className="text-center text-xs text-dim">{res.file.width}×{res.file.height}px · {(res.file.bytes / 1024).toFixed(0)} KB · analysed in {res.timings_ms.total} ms{res.saved ? " · saved to your history" : ""}</p>
              {!user && <p className="text-center text-sm text-dim">Want to keep this? <Link href="/register" className="text-iris hover:underline">Create a free account</Link> and run it again to save it.</p>}
            </>
          )}

          {tab === "forensics" && (
            <>
              {res.forensics ? (
                <Card title="Forensic maps"><HeatViewer forensics={res.forensics} preview={preview} width={res.file.width} height={res.file.height} /></Card>
              ) : res.forensics_error && <Card><p className="text-sm text-warn">{res.forensics_error}</p></Card>}
              {res.robustness && (
                <Card title="Robustness check">
                  <p className="mb-5 text-sm text-dim">The same detector re-run on edited copies. A trustworthy estimate shouldn&apos;t swing wildly.</p>
                  <div className="space-y-3">
                    {res.robustness.variants.map((r, i) => (
                      <div key={r.variant} className="grid grid-cols-[120px_1fr_44px] items-center gap-3 text-sm sm:grid-cols-[150px_1fr_50px]">
                        <span className="text-dim">{r.variant}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-raised"><motion.div className="h-full rounded-full bg-iris" initial={{ width: 0 }} animate={{ width: `${r.score * 100}%` }} transition={{ delay: i * 0.1, duration: 0.8 }} /></div>
                        <span className="text-right tabular-nums">{Math.round(r.score * 100)}%</span>
                      </div>))}
                  </div>
                  <p className={`mt-5 flex items-center gap-2 text-sm ${res.robustness.stable ? "text-real" : "text-warn"}`}>{res.robustness.stable ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}{res.robustness.note}</p>
                </Card>
              )}
              {d?.signals?.length > 0 && (
                <Card title="Heuristic signals"><ul className="space-y-3 text-sm">{d.signals.map((s) => <li key={s.name}><b>{s.name}:</b> {s.value}. <span className="text-dim">{s.note}</span></li>)}</ul></Card>
              )}
            </>
          )}

          {tab === "privacy" && (
            <>
              <Card title="Privacy scan">
                <p className={`flex items-center gap-2 font-semibold capitalize ${RISK[res.privacy.risk]}`}>{res.privacy.risk === "clean" ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}Risk: {res.privacy.risk}</p>
                <p className="mt-1 text-sm text-dim">{res.privacy.advice}</p>
                {file && res.privacy.risk !== "clean" && <button onClick={() => cleanCopy(file).catch(() => setErr("Could not create a clean copy in this browser."))} className="btn btn-primary mt-5 !py-2.5 text-sm"><ShieldCheck size={16} /> Download metadata-free copy</button>}
                {res.privacy.items.length > 0 && <ul className="mt-5 space-y-2">{res.privacy.items.map((i) => <li key={i.item} className="rounded-xl bg-raised p-4 text-sm"><span className={`mr-2 text-xs font-bold uppercase ${RISK[i.level]}`}>{i.level}</span><b>{i.item}</b><p className="mt-1 text-dim">{i.detail}</p></li>)}</ul>}
              </Card>
              {res.provenance && (
                <Card title="Provenance">
                  <p className="text-sm text-dim">{res.provenance.c2pa.message}</p>
                  {res.provenance.generator_flags.length > 0 && <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-warn">{res.provenance.generator_flags.map((f) => <li key={f}>{f}</li>)}</ul>}
                  {Object.keys(res.provenance.exif_all || {}).length > 0 ? (
                    <details className="mt-5 text-sm" open><summary className="cursor-pointer text-iris">All EXIF fields ({Object.keys(res.provenance.exif_all).length})</summary>
                      <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">{Object.entries(res.provenance.exif_all).map(([k, val]) => <div key={k} className="flex justify-between gap-4 border-b border-line py-1.5"><dt className="text-dim">{k}</dt><dd className="truncate text-right">{val}</dd></div>)}</dl></details>
                  ) : <p className="mt-4 text-sm text-dim">No EXIF metadata in this file.</p>}
                </Card>
              )}
            </>
          )}

          {tab === "prompt" && (
            <>
              {res.prompt_error && (
                <Card><div className="flex flex-wrap items-center justify-between gap-4"><p className="flex items-center gap-3 text-sm"><AlertTriangle size={18} className="text-warn" />{res.prompt_error}</p>
                  <button onClick={onRetryPrompt} disabled={retrying} className="btn btn-ghost !py-2 text-sm">{retrying ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Retry prompt</button></div></Card>
              )}
              {attrs && (
                <>
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <h3 className="font-display text-xl font-semibold">Reconstructed prompt</h3>
                      <div className="flex flex-wrap gap-2">{STYLES.map((s) => <button key={s} disabled={busy} onClick={() => { setStyle(s); recompose(s, fmt); }} className={`rounded-full px-3.5 py-1 text-sm capitalize transition-colors ${style === s ? "bg-lumen text-ink" : "border border-line text-dim hover:text-lumen"}`}>{s}</button>)}</div>
                    </div>
                    <p className="mt-2 text-sm text-dim">An approximate prompt based on what is visible, not the original one used to make the image.</p>
                    <div className="relative mt-5">
                      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} aria-label="Editable prompt" className="field resize-y leading-relaxed" />
                      {busy && <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-ink/60"><Loader2 className="animate-spin text-iris" /></div>}
                    </div>
                    {err && <p role="alert" className="mt-3 text-sm text-warn">{err}</p>}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <select value={fmt} onChange={(e) => { setFmt(e.target.value); recompose(style, e.target.value); }} aria-label="Prompt format" className="field !w-auto !py-2 text-sm">{FORMATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                      <button onClick={() => recompose(style, fmt, true)} disabled={busy} className="btn btn-ghost !py-2 text-sm"><Sparkles size={15} /> Polish with Codestral</button>
                      <button onClick={makeVariations} disabled={varBusy} className="btn btn-ghost !py-2 text-sm">{varBusy ? <Loader2 size={15} className="animate-spin" /> : <Shuffle size={15} />} 3 variations</button>
                      <CopyButton text={text} label="Copy" className="btn btn-primary !py-2 text-sm" />
                      <button onClick={() => download("prompt.txt", text)} className="btn btn-ghost !py-2 text-sm"><Download size={15} /> .txt</button>
                    </div>
                  </Card>
                  {vars && (
                    <Card title="Variations">
                      {vars.source === "templates" && <p className="mb-3 text-xs text-dim">AI variations weren&apos;t available ({vars.note}), so these use style templates.</p>}
                      <ul className="space-y-3">{vars.variations.map((x, i) => <motion.li key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="flex items-start justify-between gap-4 rounded-xl bg-raised p-4 text-sm leading-relaxed"><span>{x}</span><CopyButton text={x} /></motion.li>)}</ul>
                    </Card>
                  )}
                  <div className="grid gap-5 md:grid-cols-2">
                    {attrs.negative_prompt && <Card title="Negative prompt"><p className="text-sm text-dim">{attrs.negative_prompt}</p><div className="mt-4"><CopyButton text={attrs.negative_prompt} /></div></Card>}
                    {attrs.alt_text && <Card title="Alt text (accessibility)"><p className="text-sm text-dim">{attrs.alt_text}</p><div className="mt-4"><CopyButton text={attrs.alt_text} /></div></Card>}
                  </div>
                  <Card title="What the model saw">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(attrs).filter(([k, val]) => !["alt_text", "negative_prompt"].includes(k) && (Array.isArray(val) ? val.length : val)).map(([k, val]) => (
                        <div key={k} className="rounded-xl bg-raised p-4"><p className="text-xs capitalize text-dim">{k.replace(/_/g, " ")}</p><p className="mt-1 text-sm">{Array.isArray(val) ? val.join(", ") : val}</p></div>))}
                    </div>
                  </Card>
                </>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
