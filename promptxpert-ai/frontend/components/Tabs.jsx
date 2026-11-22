"use client";
import { motion } from "framer-motion";

export default function Tabs({ tabs, value, onChange, id = "tabs" }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto rounded-full border border-line bg-panel p-1">
      {tabs.map(([key, label]) => (
        <button key={key} role="tab" aria-selected={value === key} onClick={() => onChange(key)}
          className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${value === key ? "text-ink" : "text-dim hover:text-lumen"}`}>
          {value === key && <motion.span layoutId={id} className="absolute inset-0 rounded-full bg-lumen" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  );
}
