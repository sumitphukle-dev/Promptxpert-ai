"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, FileJson, Link2, Pencil, Search, Star, Trash2, X } from "lucide-react";
import CopyButton from "@/components/CopyButton";
import Footer from "@/components/Footer";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/api";
import { VERDICT, copyText, download as saveFile } from "@/lib/util";

const FILTERS = [["all", "All"], ["starred", "Starred"], ["likely-ai", "Leans AI"], ["likely-real", "Leans real"], ["inconclusive", "Inconclusive"]];

function Item({ it, onChange, onRemove, setErr }) {
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(it.title);
  const [tag, setTag] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [label, cls] = VERDICT[it.verdict?.overall] || ["Prompt only", "text-dim border-line bg-raised"];
  const save = async (p) => { try { onChange(await api.update(it.id, p)); } catch (e) { setErr(e.message); } };
  const toggleShare = async () => {
    try {
      const { share_token } = await api.share(it.id);
      onChange({ ...it, share_token });
      if (share_token && (await copyText(`${window.location.origin}/share/${share_token}`))) { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1800); }
    } catch (e) { setErr(e.message); }
  };

  return (
    <motion.li layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }} className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {edit ? (
            <div className="flex gap-2"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus aria-label="Title" className="field !py-1.5" onKeyDown={(e) => e.key === "Enter" && (save({ title }), setEdit(false))} />
              <button onClick={() => { save({ title }); setEdit(false); }} className="btn btn-ghost !p-2" aria-label="Save title"><Check size={16} /></button></div>
          ) : (
            <p className="flex items-center gap-2 truncate font-display text-lg font-semibold">{it.title || it.original_name || `Analysis #${it.id}`}
              <button onClick={() => setEdit(true)} className="text-dim hover:text-lumen" aria-label="Rename"><Pencil size={14} /></button></p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full border px-2.5 py-0.5 font-semibold ${cls}`}>{label}</span>
            {it.detector_score != null && <span className="text-dim">{Math.round(it.detector_score * 100)}% AI-likelihood</span>}
            {it.privacy_risk && it.privacy_risk !== "clean" && <span className="text-warn">privacy: {it.privacy_risk}</span>}
            <span className="text-dim">{new Date(it.created_at).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => save({ starred: !it.starred })} className={`btn btn-ghost !px-3 !py-2 ${it.starred ? "!border-warn !text-warn" : ""}`} aria-label={it.starred ? "Unstar" : "Star"}><Star size={15} fill={it.starred ? "currentColor" : "none"} /></button>
          <button onClick={toggleShare} className={`btn btn-ghost !px-3 !py-2 text-xs ${it.share_token ? "!border-iris !text-iris" : ""}`}>{linkCopied ? <><Check size={14} /> Link copied</> : <><Link2 size={14} /> {it.share_token ? "Shared" : "Share"}</>}</button>
          <button onClick={() => api.report(it.id, "md").catch((e) => setErr(e.message))} className="btn btn-ghost !px-3 !py-2" aria-label="Download report"><Download size={15} /></button>
          <button onClick={() => api.report(it.id, "json").catch((e) => setErr(e.message))} className="btn btn-ghost !px-3 !py-2" aria-label="Download JSON"><FileJson size={15} /></button>
          {confirm ? <button onClick={onRemove} onBlur={() => setConfirm(false)} autoFocus className="btn !px-3 !py-2 text-xs bg-fake text-ink">Confirm delete</button>
            : <button onClick={() => setConfirm(true)} className="btn btn-ghost !px-3 !py-2 hover:!border-fake hover:!text-fake" aria-label="Delete"><Trash2 size={15} /></button>}
        </div>
      </div>
      {it.palette?.length > 0 && <div className="mt-4 flex h-3 overflow-hidden rounded-full">{it.palette.map((c) => <i key={c.hex} style={{ background: c.hex, flexGrow: c.share }} />)}</div>}
      {it.prompt && <div className="mt-4 flex items-start justify-between gap-3 rounded-xl bg-raised p-4 text-sm leading-relaxed text-lumen/90"><span>{it.prompt.text}</span><CopyButton text={it.prompt.text} /></div>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(it.tags || []).map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs">{t}<button onClick={() => save({ tags: it.tags.filter((x) => x !== t) })} aria-label={`Remove tag ${t}`} className="text-dim hover:text-fake"><X size={11} /></button></span>)}
        {(it.tags || []).length < 8 && <input value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && tag.trim()) { save({ tags: [...(it.tags || []), tag.trim()] }); setTag(""); } }} placeholder="+ add tag" aria-label="Add tag" className="w-24 rounded-full border border-dashed border-line bg-transparent px-3 py-1 text-xs placeholder:text-dim focus:border-iris focus:outline-none" />}
      </div>
    </motion.li>
  );
}

export default function History() {
  const { user, ready } = useAuth();
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [f, setF] = useState("all");
  useEffect(() => { if (user) api.history().then(setItems).catch((e) => setErr(e.message)); }, [user]);

  const shown = useMemo(() => (items || []).filter((it) => {
    if (f === "starred" && !it.starred) return false;
    if (!["all", "starred"].includes(f) && it.verdict?.overall !== f) return false;
    const hay = `${it.title} ${it.original_name} ${(it.tags || []).join(" ")} ${it.prompt?.text || ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }), [items, q, f]);

  const remove = async (id) => { try { await api.remove(id); setItems((l) => l.filter((x) => x.id !== id)); } catch (e) { setErr(e.message); } };

  return (
    <main>
      <section className="mx-auto min-h-[70vh] max-w-4xl px-5 pb-20 pt-28">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="font-display text-4xl font-semibold tracking-tight">Your history</h1><p className="mt-2 text-dim">Results and prompts only. Your images are never stored.</p></div>
          {items?.length > 0 && <button onClick={() => saveFile("promptxpert-history.json", JSON.stringify(items, null, 2), "application/json")} className="btn btn-ghost !py-2 text-sm"><FileJson size={15} /> Export all</button>}
        </div>
        {ready && !user && <p className="mt-10 text-dim">Sign in to see your saved analyses. <Link href="/login" className="text-iris hover:underline">Sign in</Link></p>}
        {err && <p role="alert" className="mt-6 text-fake">{err}</p>}
        {items?.length > 0 && (
          <div className="mt-8 space-y-4">
            <div className="relative"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, tags and prompts" aria-label="Search history" className="field !pl-11" /></div>
            <div className="flex flex-wrap gap-2">{FILTERS.map(([k, l]) => <button key={k} onClick={() => setF(k)} className={`rounded-full px-4 py-1.5 text-sm transition-colors ${f === k ? "bg-lumen text-ink" : "border border-line text-dim hover:text-lumen"}`}>{l}</button>)}</div>
          </div>
        )}
        {user && items && items.length === 0 && <div className="card mt-10 p-10 text-center"><p className="text-dim">Nothing here yet.</p><Link href="/analyze" className="btn btn-primary mt-5">Analyze your first image</Link></div>}
        {items?.length > 0 && shown.length === 0 && <p className="mt-10 text-center text-dim">No results match your search.</p>}
        <ul className="mt-6 space-y-4"><AnimatePresence>{shown.map((it) => <Item key={it.id} it={it} setErr={setErr} onRemove={() => remove(it.id)} onChange={(n) => setItems((l) => l.map((x) => (x.id === n.id ? { ...x, ...n } : x)))} />)}</AnimatePresence></ul>
      </section>
      <Footer />
    </main>
  );
}
