"use client";
import { motion } from "framer-motion";
import { RotateCw } from "lucide-react";
import { useState } from "react";

/* The hero's one orchestrated moment: a synthetic scene is scanned left to right,
   and each finding locks in as the beam passes it. Beam speed = 3.4s. */
const CALLOUTS = [
  { x: 4, y: 7, t: 0.5, k: "Provenance", v: "No credential detected", c: "#98A2C3" },
  { x: 4, y: 56, t: 0.9, k: "Composition", v: "Horizon on lower third", c: "#8F83FF" },
  { x: 4, y: 83, t: 1.3, k: "Palette", v: "Amber, indigo, slate", c: "#FFC65C" },
  { x: 52, y: 10, t: 2.0, k: "Lighting", v: "Low warm sun, backlit", c: "#FFC65C" },
  { x: 55, y: 82, t: 2.9, k: "Classifier", v: "Inconclusive (0.52)", c: "#3DDDB4" },
];
const BOXES = [
  { x: 262, y: 54, w: 112, h: 112, t: 1.9 },
  { x: 14, y: 196, w: 532, h: 74, t: 1.0 },
];

export default function ScanStage() {
  const [run, setRun] = useState(0);
  return (
    <div className="relative">
      <div key={run} className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-line bg-panel shadow-[0_40px_120px_-40px_rgba(143,131,255,.45)]">
        <svg viewBox="0 0 560 420" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-label="Illustration of an image being scanned">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1D1B4B" /><stop offset=".55" stopColor="#7A4B8F" /><stop offset="1" stopColor="#F59E5B" /></linearGradient>
            <radialGradient id="sun"><stop offset="0" stopColor="#FFF1C2" /><stop offset="1" stopColor="#FFB45C" /></radialGradient>
            <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F2A15D" /><stop offset="1" stopColor="#1A1D3D" /></linearGradient>
          </defs>
          <rect width="560" height="420" fill="url(#sky)" />
          <circle cx="318" cy="110" r="46" fill="url(#sun)" />
          <path d="M0 230 L90 150 L160 205 L250 120 L350 215 L440 160 L560 235 L560 270 L0 270Z" fill="#2A2158" />
          <path d="M0 250 L120 190 L210 240 L330 180 L450 245 L560 205 L560 270 L0 270Z" fill="#171636" />
          <rect y="270" width="560" height="150" fill="url(#lake)" />
          <ellipse cx="318" cy="300" rx="30" ry="6" fill="#FFD28A" opacity=".55" /><ellipse cx="318" cy="320" rx="52" ry="5" fill="#FFD28A" opacity=".25" />
          {BOXES.map((b, i) => (
            <motion.rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="6" fill="none" stroke="#EDF1FF" strokeWidth="1.5" strokeDasharray="5 5"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: b.t, duration: 0.4 }} />
          ))}
        </svg>

        <motion.div className="pointer-events-none absolute inset-y-0 w-24 scanline" style={{ boxShadow: "0 0 40px 6px rgba(143,131,255,.35)" }}
          initial={{ left: "-12%" }} animate={{ left: "108%" }} transition={{ duration: 3.4, ease: [0.45, 0, 0.35, 1] }} />

        {CALLOUTS.map((c) => (
          <motion.div key={c.k} style={{ left: `${c.x}%`, top: `${c.y}%` }}
            className="absolute max-w-[46%] rounded-lg border border-white/10 bg-ink/80 px-3 py-2 text-xs backdrop-blur-md"
            initial={{ opacity: 0, scale: 0.85, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: c.t, type: "spring", stiffness: 260, damping: 20 }}>
            <span className="mb-0.5 flex items-center gap-1.5 font-semibold text-lumen"><i className="h-1.5 w-1.5 rounded-full" style={{ background: c.c }} />{c.k}</span>
            <span className="text-dim">{c.v}</span>
          </motion.div>
        ))}
      </div>
      <button onClick={() => setRun((r) => r + 1)} className="mt-4 inline-flex items-center gap-2 text-sm text-dim transition-colors hover:text-lumen">
        <RotateCw size={14} /> Replay scan <span className="text-dim/60">(illustrative example)</span>
      </button>
    </div>
  );
}
