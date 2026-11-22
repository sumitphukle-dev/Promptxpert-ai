"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Trash2 } from "lucide-react";
import Footer from "@/components/Footer";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/api";

const LABEL = { "likely-ai": "Leans AI-generated", "likely-real": "Leans real", inconclusive: "Inconclusive", conflicting: "Signals conflict" };

export default function History() {
  const { user, ready } = useAuth();
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => { if (user) api.history().then(setItems).catch((e) => setErr(e.message)); }, [user]);
  const del = async (id) => { await api.remove(id).catch((e) => setErr(e.message)); setItems((l) => l.filter((x) => x.id !== id)); };

  return (
    <main>
      <section className="mx-auto min-h-[70vh] max-w-4xl px-5 pb-20 pt-28">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Your history</h1>
        <p className="mt-2 text-dim">Results and prompts only. Your images are never stored.</p>
        {ready && !user && <p className="mt-10 text-dim">Sign in to see your saved analyses. <Link href="/login" className="text-iris hover:underline">Sign in</Link></p>}
        {err && <p role="alert" className="mt-6 text-fake">{err}</p>}
        {user && items && items.length === 0 && (
          <div className="card mt-10 p-10 text-center"><p className="text-dim">Nothing here yet.</p><Link href="/analyze" className="btn btn-primary mt-5">Analyze your first image</Link></div>
        )}
        <ul className="mt-10 space-y-4">
          <AnimatePresence>
            {(items || []).map((it, i) => (
              <motion.li key={it.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ delay: i * 0.05, duration: 0.5 }} className="card p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{LABEL[it.verdict?.overall] || "Prompt only"}{it.detector_score != null && <span className="ml-2 text-dim">{Math.round(it.detector_score * 100)}% AI-likelihood</span>}</p>
                    <p className="mt-1 text-sm text-dim">{new Date(it.created_at).toLocaleString()} · file {it.file_hash} · {it.mime_type.replace("image/", "")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => api.report(it.id).catch((e) => setErr(e.message))} className="btn btn-ghost !px-3 !py-2 text-sm" aria-label="Download report"><Download size={15} /></button>
                    <button onClick={() => del(it.id)} className="btn btn-ghost !px-3 !py-2 text-sm hover:!border-fake hover:!text-fake" aria-label="Delete"><Trash2 size={15} /></button>
                  </div>
                </div>
                {it.prompt && <p className="mt-4 rounded-xl bg-raised p-4 text-sm leading-relaxed text-lumen/90">{it.prompt.text}</p>}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>
      <Footer />
    </main>
  );
}
