"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { History, LayoutDashboard, LogOut, Menu, Search, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import { useAuth } from "./Providers";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scrollProgress = useSpring(scrollYProgress, { stiffness: 120, damping: 28, skipInitialAnimation: true });
  const linkClass = (href) => `hidden rounded-full px-3 py-2 transition-colors xl:block ${pathname === href ? "bg-raised text-lumen" : "text-dim hover:text-lumen"}`;
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <>
      <motion.header
        initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${solid ? "border-b border-line bg-ink/75 backdrop-blur-xl" : "border-b border-transparent"}`}
      >
        {!reduceMotion && <motion.div aria-hidden className="absolute inset-x-0 top-0 h-px origin-left bg-gradient-to-r from-iris via-lumen to-real" style={{ scaleX: scrollProgress }} />}
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5" aria-label="Main">
          <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight">
            <Logo /> PromptXpert AI
          </Link>
          <div className="flex items-center gap-2 text-sm sm:gap-3">
            <Link href="/prompt-lab" aria-current={pathname === "/prompt-lab" ? "page" : undefined} className={linkClass("/prompt-lab")}>Prompt Lab</Link>
            <Link href="/generator" aria-current={pathname === "/generator" ? "page" : undefined} className={linkClass("/generator")}>Generator</Link>
            <Link href="/analyze" aria-current={pathname === "/analyze" ? "page" : undefined} className={linkClass("/analyze")}>Detector</Link>
            <Link href="/compare" aria-current={pathname === "/compare" ? "page" : undefined} className={linkClass("/compare")}>Compare</Link>
            <button onClick={() => window.dispatchEvent(new Event("px:palette"))} aria-label="Open command palette" className="hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs text-dim transition-colors hover:border-iris hover:text-lumen md:flex"><Search size={13} /> Ctrl K</button>
            {user ? (
              <>
                <Link href="/dashboard" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-dim transition-colors hover:text-lumen xl:flex"><LayoutDashboard size={16} /> Dashboard</Link>
                <Link href="/history" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-dim transition-colors hover:text-lumen xl:flex"><History size={16} /> History</Link>
                <button onClick={signOut} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-dim transition-colors hover:border-iris hover:text-lumen" aria-label="Sign out"><LogOut size={15} /> <span className="hidden sm:inline">Sign out</span></button>
              </>
            ) : (
              <>
                <Link href="/login" className="hidden rounded-full px-4 py-2 text-dim transition-colors hover:text-lumen xl:block">Sign in</Link>
                <Link href="/generator" className="btn btn-primary !px-4 !py-2 !text-sm sm:!px-5">Try it free</Link>
              </>
            )}
            <button
              type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen} aria-controls="mobile-navigation"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-lumen transition-colors hover:border-iris hover:bg-raised xl:hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={menuOpen ? "close" : "open"} initial={{ opacity: 0, rotate: -35, scale: 0.7 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 35, scale: 0.7 }} transition={{ duration: 0.16 }}>
                  {menuOpen ? <X size={18} /> : <Menu size={18} />}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </nav>
        <AnimatePresence>
          {menuOpen && (
            <motion.nav id="mobile-navigation" aria-label="Mobile" initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ duration: 0.18 }} className="absolute inset-x-4 top-[calc(100%+0.5rem)] rounded-2xl border border-line bg-panel/95 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl xl:hidden">
              {[
                ["/prompt-lab", "Professional Prompt Lab", <Sparkles key="prompt-lab" size={16} />],
                ["/generator", "Prompt generator", <Menu key="generator" size={16} />],
                ["/analyze", "Image analyzer", <Search key="analyze" size={16} />],
                ["/compare", "Compare images", <History key="compare" size={16} />],
                ...(user ? [["/dashboard", "Dashboard", <LayoutDashboard key="dashboard" size={16} />], ["/history", "History", <History key="history" size={16} />]] : []),
              ].map(([href, label, Icon]) => (
                <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors hover:bg-raised hover:text-lumen ${pathname === href ? "bg-raised text-lumen" : "text-dim"}`}>
                  <span className="text-iris">{Icon}</span>{label}
                </Link>
              ))}
              <button onClick={() => { setMenuOpen(false); window.dispatchEvent(new Event("px:palette")); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-dim transition-colors hover:bg-raised hover:text-lumen"><Search size={16} className="text-iris" /> Search tools <span className="ml-auto text-xs">Ctrl K</span></button>
            </motion.nav>
          )}
        </AnimatePresence>
      </motion.header>
    </>
  );
}
