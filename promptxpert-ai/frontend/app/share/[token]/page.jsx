"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import CopyButton from "@/components/CopyButton";
import Footer from "@/components/Footer";
import Gauge from "@/components/Gauge";
import PaletteBar from "@/components/PaletteBar";
import { api } from "@/lib/api";
import { PROV, VERDICT } from "@/lib/util";

export default function Shared() {
  const { token } = useParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.shared(token).then(setD).catch((e) => setErr(e.message)); }, [token]);
  const [label, cls] = VERDICT[d?.verdict?.overall] || VERDICT["not-assessed"];

  return (
    <main>
      <section className="mx-auto min-h-[70vh] max-w-3xl px-5 pb-20 pt-28">
        {!d && !err && <p className="flex items-center gap-2 text-dim"><Loader2 className="animate-spin" size={18} /> Loading shared analysis (the free server may take ~30 s to wake)...</p>}
        {err && <div className="card p-8"><h1 className="font-display text-2xl font-semibold">This link isn&apos;t available</h1><p className="mt-2 text-dim">It may have been turned off by its owner.</p></div>}
        {d && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <p className="text-sm text-dim">Shared analysis · {new Date(d.created_at).toLocaleDateString()} · results only, no image</p>
            <h1 className="font-display text-4xl font-semibold tracking-tight">{d.title}</h1>
            {d.detection && (
              <div className="card grid gap-6 p-6 sm:grid-cols-[240px_1fr] sm:p-8">
                <div><Gauge score={d.detection.score} band={d.detection.band} /><p className="-mt-2 text-center font-display text-2xl font-semibold">{Math.round(d.detection.score * 100)}%</p></div>
                <div><span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${cls}`}>{label}</span>
                  <p className="mt-4 text-sm text-dim">{d.detection.confidence_note}</p>
                  {d.provenance && <p className="mt-3 text-sm text-dim">Provenance: {PROV[d.verdict?.evidence?.find((e) => e.signal === "Provenance")?.state] || d.provenance}</p>}</div>
              </div>)}
            {d.palette?.length > 0 && <div className="card p-6 sm:p-8"><h2 className="mb-4 font-display text-xl font-semibold">Palette</h2><PaletteBar palette={d.palette} /></div>}
            {d.prompt && <div className="card p-6 sm:p-8"><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-xl font-semibold">Reconstructed prompt</h2><CopyButton text={d.prompt.text} /></div><p className="leading-relaxed text-lumen/90">{d.prompt.text}</p></div>}
            {d.verdict?.disclaimer && <p className="text-xs text-dim">{d.verdict.disclaimer}</p>}
            <Link href="/analyze" className="btn btn-primary">Analyze your own image</Link>
          </motion.div>
        )}
      </section>
      <Footer />
    </main>
  );
}
