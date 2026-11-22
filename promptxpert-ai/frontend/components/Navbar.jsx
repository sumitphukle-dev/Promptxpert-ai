"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, LayoutDashboard, LogOut, Search } from "lucide-react";
import Logo from "./Logo";
import { useAuth } from "./Providers";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${solid ? "border-b border-line bg-ink/75 backdrop-blur-xl" : "border-b border-transparent"}`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5" aria-label="Main">
        <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight">
          <Logo /> PromptXpert AI
        </Link>
        <div className="flex items-center gap-2 sm:gap-3 text-sm">
          <Link href="/generator" className="hidden rounded-full px-3 py-2 text-dim transition-colors hover:text-lumen sm:block">Generator</Link>
          <Link href="/analyze" className="hidden rounded-full px-3 py-2 text-dim transition-colors hover:text-lumen md:block">Detector</Link>
          <Link href="/compare" className="hidden rounded-full px-3 py-2 text-dim transition-colors hover:text-lumen lg:block">Compare</Link>
          <button onClick={() => window.dispatchEvent(new Event("px:palette"))} aria-label="Open command palette" className="hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs text-dim transition-colors hover:border-iris hover:text-lumen md:flex"><Search size={13} /> Ctrl K</button>
          {user ? (
            <>
              <Link href="/dashboard" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-dim transition-colors hover:text-lumen sm:flex"><LayoutDashboard size={16} /> Dashboard</Link>
              <Link href="/history" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-dim transition-colors hover:text-lumen"><History size={16} /> History</Link>
              <button onClick={signOut} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-dim transition-colors hover:border-iris hover:text-lumen" aria-label="Sign out"><LogOut size={15} /> <span className="hidden sm:inline">Sign out</span></button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-4 py-2 text-dim transition-colors hover:text-lumen">Sign in</Link>
              <Link href="/generator" className="btn btn-primary !px-5 !py-2 !text-sm">Try it free</Link>
            </>
          )}
        </div>
      </nav>
    </motion.header>
  );
}
