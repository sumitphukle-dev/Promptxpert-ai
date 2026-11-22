"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Star, Timer, ScanLine } from "lucide-react";
import Footer from "@/components/Footer";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/api";
import { RISK, VERDICT } from "@/lib/util";

const Kpi = ({ icon: Icon, label, value, i }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="card p-6">
    <Icon size={18} className="text-iris" /><p className="mt-4 font-display text-4xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-sm text-dim">{label}</p>
  </motion.div>
);

function Donut({ data }) {
  const entries = Object.entries(data), total = entries.reduce((a, [, n]) => a + n, 0) || 1;
  let acc = 0; const R = 54, C = 2 * Math.PI * R;
  return (
    <div className="flex flex-wrap items-center gap-8">
      <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90" role="img" aria-label="Verdict distribution">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#171B2B" strokeWidth="16" />
        {entries.map(([k, n]) => {
          const len = (n / total) * C, off = -acc; acc += len;
          return <motion.circle key={k} cx="70" cy="70" r={R} fill="none" stroke={(VERDICT[k] || VERDICT["not-assessed"])[2]} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={off}
            initial={{ strokeDasharray: `0 ${C}` }} animate={{ strokeDasharray: `${len} ${C - len}` }} transition={{ duration: 1, ease: "easeOut" }} />;
        })}
      </svg>
      <ul className="space-y-2 text-sm">{entries.map(([k, n]) => <li key={k} className="flex items-center gap-3"><i className="h-3 w-3 rounded-full" style={{ background: (VERDICT[k] || VERDICT["not-assessed"])[2] }} />{(VERDICT[k] || VERDICT["not-assessed"])[0]}<span className="text-dim">{n}</span></li>)}</ul>
    </div>
  );
}

function Bars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Analyses per day">
      {data.map((d, i) => (
        <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.day}: ${d.count}`}>
          <motion.div className="rounded-t bg-iris/80 group-hover:bg-iris" initial={{ height: 0 }} animate={{ height: `${Math.max(d.count ? 8 : 2, (d.count / max) * 100)}%` }} transition={{ delay: i * 0.03, duration: 0.6 }} style={{ opacity: d.count ? 1 : 0.25 }} />
        </div>))}
    </div>
  );
}

const Meter = ({ data, colors = {} }) => {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  return <div className="space-y-3">{Object.entries(data).map(([k, n]) => (
    <div key={k}><div className="mb-1 flex justify-between text-sm capitalize"><span className={colors[k] || ""}>{k}</span><span className="text-dim">{n}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-raised"><motion.div className="h-full rounded-full bg-iris" initial={{ width: 0 }} animate={{ width: `${(n / total) * 100}%` }} transition={{ duration: 0.8 }} /></div></div>))}</div>;
};

export default function Dashboard() {
  const { user, ready } = useAuth();
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { if (user) api.stats().then(setS).catch((e) => setErr(e.message)); }, [user]);

  return (
    <main>
      <section className="mx-auto min-h-[70vh] max-w-6xl px-5 pb-20 pt-28">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Dashboard</h1>
        <p className="mt-3 text-dim">Your analysis activity at a glance.</p>
        {ready && !user && <p className="mt-10 text-dim">Sign in to see your dashboard. <Link href="/login" className="text-iris hover:underline">Sign in</Link></p>}
        {err && <p role="alert" className="mt-6 text-fake">{err}</p>}
        {s && s.total === 0 && <div className="card mt-10 p-10 text-center"><p className="text-dim">No analyses yet.</p><Link href="/analyze" className="btn btn-primary mt-5">Analyze an image</Link></div>}
        {s && s.total > 0 && (
          <>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi i={0} icon={ScanLine} label="Images analysed" value={s.total} />
              <Kpi i={1} icon={Star} label="Starred" value={s.starred} />
              <Kpi i={2} icon={Timer} label="Average time" value={`${(s.avg_latency_ms / 1000).toFixed(1)}s`} />
              <Kpi i={3} icon={Activity} label="Last 14 days" value={s.by_day.reduce((a, d) => a + d.count, 0)} />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="card p-6 sm:p-8"><h2 className="mb-6 font-display text-xl font-semibold">Verdicts</h2><Donut data={s.by_verdict} /></div>
              <div className="card p-6 sm:p-8"><h2 className="mb-6 font-display text-xl font-semibold">Activity (14 days)</h2><Bars data={s.by_day} /></div>
              <div className="card p-6 sm:p-8"><h2 className="mb-6 font-display text-xl font-semibold">Prompt styles used</h2>{Object.keys(s.styles).length ? <Meter data={s.styles} /> : <p className="text-sm text-dim">No prompts generated yet.</p>}</div>
              <div className="card p-6 sm:p-8"><h2 className="mb-6 font-display text-xl font-semibold">Privacy risk in your files</h2><Meter data={s.privacy_risks} colors={RISK} /></div>
            </div>
          </>
        )}
      </section>
      <Footer />
    </main>
  );
}
