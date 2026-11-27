"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import Footer from "@/components/Footer";
import { api } from "@/lib/api";

export default function Status() {
  const [h, setH] = useState(null);
  const [ms, setMs] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(true);
  const check = useCallback(async () => {
    setBusy(true); setErr(""); const t = performance.now();
    try { setH(await api.health()); setMs(Math.round(performance.now() - t)); } catch (e) { setH(null); setErr(e.message); } finally { setBusy(false); }
  }, []);
  useEffect(() => { check(); }, [check]);

  const rows = h ? [
    ["API", true, `Reachable in ${ms} ms${ms > 5000 ? " (the free server had been asleep)" : ""}`],
    ["Authenticity detector", h.detector === "efficientnet-b0", h.detector === "efficientnet-b0" ? "EfficientNet-B0 model loaded" : "Heuristic fallback only. Trained weights are not installed, so results are low-confidence.", h.detector !== "efficientnet-b0"],
    ["Prompt generation", h.prompt_ready, h.prompt_ready ? `Groq vision: ${h.vision_model}. Text: ${h.text_model}` : "GROQ_API_KEY is not set on the server."],
    ["Upload limit", true, `${h.max_upload_mb} MB per image`],
  ] : [];

  return (
    <main>
      <section className="mx-auto min-h-[70vh] max-w-3xl px-5 pb-20 pt-28">
        <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="font-display text-4xl font-semibold tracking-tight">System status</h1>
          <button onClick={check} disabled={busy} className="btn btn-ghost !py-2 text-sm">{busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Re-check</button></div>
        {busy && !h && <p className="mt-8 text-dim">Contacting the server. The free tier can take ~30 seconds to wake up.</p>}
        {err && <div role="alert" className="mt-8 flex items-start gap-3 rounded-xl border border-fake/40 bg-fake/10 p-4 text-sm"><XCircle size={18} className="mt-0.5 shrink-0 text-fake" />{err}</div>}
        <ul className="mt-8 space-y-3">
          {rows.map(([name, ok, detail, warn], i) => (
            <motion.li key={name} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="card flex items-start gap-4 p-5">
              {ok ? <CheckCircle2 className="mt-0.5 shrink-0 text-real" size={20} /> : <AlertTriangle className={`mt-0.5 shrink-0 ${warn ? "text-warn" : "text-fake"}`} size={20} />}
              <div><p className="font-semibold">{name}</p><p className="mt-1 text-sm text-dim">{detail}</p></div>
            </motion.li>))}
        </ul>
      </section>
      <Footer />
    </main>
  );
}
