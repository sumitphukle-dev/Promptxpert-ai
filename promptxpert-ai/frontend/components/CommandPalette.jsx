"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { useAuth } from "./Providers";

const BASE = [["Image to Prompt Generator", "/generator", "Turn an image into prompts"], ["Authenticity detector", "/analyze", "AI-likelihood, forensics, privacy"], ["Compare two images", "/compare", "Similarity and side-by-side"], ["Dashboard", "/dashboard", "Your activity charts", true], ["History", "/history", "Saved analyses", true], ["System status", "/status", "Is everything up?"], ["Home", "/", "Landing page"]];

export default function CommandPalette() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const inputRef = useRef(null);
  const items = useMemo(() => {
    const all = [...BASE.filter((x) => !x[3] || user), ...(user ? [["Sign out", "#signout", "End your session"]] : [["Sign in", "/login", ""], ["Create account", "/register", ""]])];
    return all.filter(([l, , d]) => `${l} ${d}`.toLowerCase().includes(q.toLowerCase()));
  }, [q, user]);

  useEffect(() => {
    const key = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } else if (e.key === "Escape") setOpen(false); };
    const ev = () => setOpen(true);
    window.addEventListener("keydown", key); window.addEventListener("px:palette", ev);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("px:palette", ev); };
  }, []);
  useEffect(() => { if (open) { setQ(""); setI(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);
  const go = (href) => { setOpen(false); if (href === "#signout") signOut(); else router.push(href); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-start justify-center bg-ink/70 px-4 pt-[18vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
          <motion.div initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette" className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
            <div className="flex items-center gap-3 border-b border-line px-4"><Search size={16} className="text-dim" />
              <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} placeholder="Go to..." aria-label="Search commands" className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-dim"
                onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, items.length - 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); } else if (e.key === "Enter" && items[i]) go(items[i][1]); }} />
              <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-dim">esc</kbd></div>
            <ul className="max-h-72 overflow-y-auto p-2">
              {items.map(([l, href, d], n) => (
                <li key={l}><button onMouseEnter={() => setI(n)} onClick={() => go(href)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${n === i ? "bg-raised" : ""}`}><span>{l}</span><span className="text-xs text-dim">{d}</span></button></li>))}
              {!items.length && <li className="px-3 py-6 text-center text-sm text-dim">Nothing matches.</li>}
            </ul>
          </motion.div>
        </motion.div>)}
    </AnimatePresence>
  );
}
