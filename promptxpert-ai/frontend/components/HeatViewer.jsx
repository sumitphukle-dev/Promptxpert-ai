"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const NAMES = { ela: "Error level", noise: "Noise", spectrum: "Frequency" };

/** Overlay a forensic map on the original photo with an opacity slider. */
export default function HeatViewer({ forensics, preview, width, height }) {
  const keys = Object.keys(forensics || {});
  const [k, setK] = useState(keys[0]);
  const [op, setOp] = useState(70);
  if (!keys.length) return null;
  const f = forensics[k];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {keys.map((x) => (
          <button key={x} onClick={() => setK(x)} className={`rounded-full px-4 py-1.5 text-sm transition-colors ${k === x ? "bg-lumen text-ink" : "border border-line text-dim hover:text-lumen"}`}>{NAMES[x]}</button>
        ))}
      </div>
      <div className="relative mx-auto mt-4 max-h-[520px] overflow-hidden rounded-2xl border border-line bg-ink" style={{ aspectRatio: `${width} / ${height}`, maxWidth: `${Math.min(760, (520 * width) / height)}px` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Original" className="absolute inset-0 h-full w-full object-cover" />
        <AnimatePresence mode="wait">
          <motion.img key={k} src={f.image} alt={`${NAMES[k]} map`} initial={{ opacity: 0 }} animate={{ opacity: op / 100 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            className="absolute inset-0 h-full w-full object-cover mix-blend-screen" />
        </AnimatePresence>
      </div>
      <label className="mx-auto mt-4 flex max-w-md items-center gap-3 text-sm text-dim">Original
        <input type="range" min="0" max="100" value={op} onChange={(e) => setOp(+e.target.value)} aria-label="Overlay strength" className="flex-1 accent-[#8F83FF]" />Map</label>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-dim">{f.note}</p>
    </div>
  );
}
