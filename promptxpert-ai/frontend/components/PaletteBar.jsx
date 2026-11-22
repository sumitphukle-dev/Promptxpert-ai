"use client";
import { motion } from "framer-motion";
import { paletteExports } from "@/lib/util";
import CopyButton from "./CopyButton";

export default function PaletteBar({ palette = [] }) {
  if (!palette.length) return null;
  return (
    <div>
      <div className="flex h-12 overflow-hidden rounded-xl border border-line">
        {palette.map((c, i) => (
          <motion.div key={c.hex} title={`${c.hex} · ${Math.round(c.share * 100)}%`} style={{ background: c.hex, flexGrow: c.share }}
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.08, duration: 0.5 }} className="origin-bottom" />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {palette.map((c) => (
          <span key={c.hex} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs">
            <i className="h-3 w-3 rounded-full border border-white/20" style={{ background: c.hex }} />{c.hex.toUpperCase()}<span className="text-dim">{Math.round(c.share * 100)}%</span>
          </span>
        ))}
        <CopyButton text={palette.map((c) => c.hex).join(", ")} label="Copy all" />
        {Object.entries(paletteExports).map(([k, fn]) => <CopyButton key={k} text={fn(palette)} label={k} />)}
      </div>
    </div>
  );
}
