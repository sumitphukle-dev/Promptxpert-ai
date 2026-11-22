"use client";
import { animate } from "framer-motion";
import { useEffect, useState } from "react";

const R = 80, C = 100;
const pt = (f) => [C + R * Math.cos(Math.PI * (1 - f)), C - R * Math.sin(Math.PI * (1 - f))];
const arc = (a, b) => { const [x0, y0] = pt(a), [x1, y1] = pt(b); return `M${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1}`; };

/** Half-circle gauge: teal = real-like, amber = inconclusive band, magenta = AI-like. */
export default function Gauge({ score = 0.5, band = [0.4, 0.6], play = true }) {
  const [f, setF] = useState(0);
  useEffect(() => {
    if (!play) return;
    const c = animate(0, score, { duration: 1.6, ease: [0.2, 0.8, 0.2, 1], onUpdate: setF });
    return () => c.stop();
  }, [score, play]);
  const [nx, ny] = pt(f);
  const [lo, hi] = band;
  return (
    <svg viewBox="0 0 200 124" className="w-full" role="img" aria-label={`AI-likelihood ${Math.round(score * 100)} percent`}>
      <path d={arc(0, lo)} stroke="#3DDDB4" strokeWidth="12" strokeLinecap="butt" fill="none" opacity=".85" />
      <path d={arc(lo, hi)} stroke="#FFC65C" strokeWidth="12" fill="none" opacity=".85" />
      <path d={arc(hi, 1)} stroke="#FF5A8F" strokeWidth="12" fill="none" opacity=".85" />
      <line x1={C} y1={C} x2={C + (nx - C) * 0.86} y2={C + (ny - C) * 0.86} stroke="#EDF1FF" strokeWidth="3" strokeLinecap="round" />
      <circle cx={C} cy={C} r="7" fill="#EDF1FF" />
      <text x="14" y="118" fill="#98A2C3" fontSize="9">real-like</text>
      <text x="186" y="118" fill="#98A2C3" fontSize="9" textAnchor="end">AI-like</text>
    </svg>
  );
}
