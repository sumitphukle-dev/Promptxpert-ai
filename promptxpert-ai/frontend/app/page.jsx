"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useScroll, useSpring } from "framer-motion";
import { ChevronDown, FileSearch, Fingerprint, ShieldCheck, Wand2 } from "lucide-react";
import Footer from "@/components/Footer";
import Gauge from "@/components/Gauge";
import Reveal from "@/components/Reveal";
import ScanStage from "@/components/ScanStage";

const EASE = [0.2, 0.8, 0.2, 1];

function Hero() {
  const words = "Check where an image might come from. Rebuild the prompt behind it.".split(" ");
  return (
    <section className="relative isolate overflow-hidden pt-32 pb-24 sm:pt-40">
      <div aria-hidden className="absolute -top-40 left-1/2 -z-10 h-[620px] w-[900px] -translate-x-1/2 rounded-full bg-iris/20 blur-[140px]" />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <h1 className="font-display text-[2.6rem] font-semibold leading-[1.04] tracking-tight sm:text-6xl">
            {words.map((w, i) => (
              <span key={i} className="inline-block overflow-hidden pb-1 align-bottom">
                <motion.span className="inline-block" initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.8, delay: 0.1 + i * 0.055, ease: EASE }}>
                  {w}&nbsp;
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.8, ease: EASE }}
            className="mt-6 max-w-lg text-lg leading-relaxed text-dim">
            Upload a JPEG, PNG or WebP. PromptXpert AI reads the pixels, the file&apos;s metadata and the picture itself, and keeps those three kinds of evidence separate so you can judge for yourself.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.8, ease: EASE }} className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/analyze" className="btn btn-primary">Analyze an image</Link>
            <a href="#how" className="btn btn-ghost">See how it works</a>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="mt-5 text-sm text-dim">
            No account needed. Uploaded images are deleted right after analysis.
          </motion.p>
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 1, ease: EASE }}>
          <ScanStage />
        </motion.div>
      </div>
    </section>
  );
}

function Typing({ text, play }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!play) return;
    const id = setInterval(() => setN((v) => (v >= text.length ? v : v + 2)), 22);
    return () => clearInterval(id);
  }, [play, text]);
  return <span>{text.slice(0, n)}<span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-iris" /></span>;
}

function Signals() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const states = [["Credential found", "bg-real"], ["Found, not validated", "bg-warn"], ["None detected", "bg-dim"], ["Unreadable", "bg-fake"]];
  const [tab, setTab] = useState("Cinematic");
  const demo = {
    Concise: "Lone hiker on a ridge, alpine dawn, warm backlight, photorealistic",
    Detailed: "A lone hiker on a granite ridge above a sea of cloud, wide centered composition, eye-level view, low warm backlight, amber and indigo palette, calm mood, photorealistic, fine rock texture",
    Cinematic: "Cinematic still of a lone hiker on a granite ridge, low-angle wide shot, warm rim light with dramatic contrast, amber and indigo grade, shallow depth of field, film grain",
    Illustrative: "Digital illustration of a lone hiker on a ridge above clouds, balanced composition, amber and indigo palette, quiet mood, clean linework, painterly shading",
  };
  return (
    <section ref={ref} className="mx-auto max-w-6xl px-5 py-24">
      <Reveal><h2 className="max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Three kinds of evidence, never merged into one number</h2></Reveal>
      <Reveal delay={0.1}><p className="mt-5 max-w-xl text-lg text-dim">A detector estimates, a metadata check reports what is recorded, and a vision model describes what it sees. They answer different questions, so each gets its own panel.</p></Reveal>

      <div className="mt-14 grid gap-5 lg:grid-cols-12">
        <Reveal className="card relative overflow-hidden p-8 lg:col-span-7" >
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-iris"><FileSearch size={16} /> Visual classifier</div>
          <p className="max-w-md text-dim">Scores how closely an image resembles the real or AI-generated examples the model was trained on. When the score is too close to call, the answer is &ldquo;inconclusive&rdquo;.</p>
          <div className="mx-auto mt-6 max-w-sm"><Gauge score={0.52} band={[0.4, 0.6]} play={inView} /></div>
          <p className="mt-2 text-center text-sm text-dim">Example: 0.52 falls inside the inconclusive band</p>
        </Reveal>

        <div className="grid gap-5 lg:col-span-5">
          <Reveal delay={0.1} className="card p-8">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-iris"><Fingerprint size={16} /> Provenance</div>
            <p className="mb-5 text-dim">Reads EXIF and embedded generation settings, and looks for C2PA Content Credentials. Missing metadata is reported as missing, never as proof.</p>
            <ul className="space-y-2.5">
              {states.map(([s, c], i) => (
                <motion.li key={s} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-3 rounded-lg bg-raised px-4 py-2.5 text-sm"><i className={`h-2 w-2 rounded-full ${c}`} />{s}</motion.li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={0.15} className="card p-8 lg:col-span-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-iris"><Wand2 size={16} /> Prompt reconstruction</div>
              <p className="text-dim">A vision model lists subject, scene, composition, camera angle, lighting, palette, mood and style. You pick a style, edit the result and copy it.</p>
              <div className="mt-5 flex flex-wrap gap-2" role="tablist">
                {Object.keys(demo).map((t) => (
                  <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                    className={`rounded-full px-4 py-1.5 text-sm transition-colors ${tab === t ? "bg-lumen text-ink" : "border border-line text-dim hover:text-lumen"}`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="min-h-[9rem] rounded-xl border border-line bg-ink p-5 leading-relaxed text-lumen/90">
              <Typing key={tab} text={demo[tab]} play={inView} />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const STEPS = [
  ["Upload", "Drop in a JPEG, PNG or WebP up to 10 MB. The file is checked for type, signature and size before anything runs."],
  ["Choose what to run", "Authenticity signals, prompt reconstruction, or both."],
  ["Read the evidence", "See the classifier estimate, the provenance status and a plain-language note on what each one means."],
  ["Edit and keep", "Switch the prompt style, polish it, copy it, and save the report to your history if you have an account."],
];

function How() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 28 });
  return (
    <section id="how" ref={ref} className="mx-auto max-w-4xl px-5 py-24">
      <Reveal><h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">From file to answer in four steps</h2></Reveal>
      <div className="relative mt-14 pl-10 sm:pl-14">
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-line sm:left-[15px]" />
        <motion.div className="absolute left-[11px] top-2 bottom-2 w-px origin-top bg-iris sm:left-[15px]" style={{ scaleY }} />
        {STEPS.map(([t, d], i) => (
          <Reveal key={t} className="relative pb-12 last:pb-0">
            <span className="absolute -left-10 top-0 flex h-6 w-6 items-center justify-center rounded-full border border-iris bg-ink text-xs font-bold text-iris sm:-left-14 sm:h-8 sm:w-8 sm:text-sm">{i + 1}</span>
            <h3 className="font-display text-2xl font-semibold">{t}</h3>
            <p className="mt-2 max-w-xl text-dim">{d}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Honest() {
  const rows = [
    ["A score is not proof.", "The classifier reflects its training data. Unfamiliar generators, edits and heavy compression can fool it in both directions."],
    ["No metadata is not a verdict.", "Social apps and editors strip metadata all the time. We report it as absent, never as AI-generated."],
    ["A prompt is a new description.", "You get an approximate prompt based on what is visible, not the original text someone typed."],
  ];
  return (
    <section className="border-y border-line bg-panel/50">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <Reveal><div className="flex items-center gap-2 text-sm font-semibold text-iris"><ShieldCheck size={16} /> Built to be honest</div>
          <h2 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">What this tool will not tell you</h2></Reveal>
        <div className="mt-12 divide-y divide-line">
          {rows.map(([h, p], i) => (
            <Reveal key={h} delay={i * 0.08}>
              <div className="group grid gap-3 py-8 sm:grid-cols-[1.1fr_1fr] sm:gap-10">
                <h3 className="relative w-fit font-display text-2xl font-semibold sm:text-3xl">{h}
                  <span className="absolute -bottom-1 left-0 h-px w-0 bg-iris transition-all duration-500 group-hover:w-full" /></h3>
                <p className="text-dim">{p}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  ["Are my images stored?", "No. Images are processed in memory and discarded. If you sign in, we save the results, a file hash and your prompt text, not the picture."],
  ["Does the prompt come from Mistral?", "Yes. A Mistral vision model describes the image, and you can optionally polish the final wording with Mistral Codestral."],
  ["Why does it sometimes say inconclusive?", "Because that is the honest answer when the evidence is weak or conflicting. A forced yes or no would be less trustworthy."],
  ["Can it verify C2PA Content Credentials?", "It detects whether a credential appears to be embedded and says when it has not validated the signature."],
  ["Is it free?", "Yes. It runs on free-tier hosting, so the first request after a quiet period can take about 30 seconds while the server wakes up."],
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="mx-auto max-w-3xl px-5 py-24">
      <Reveal><h2 className="font-display text-4xl font-semibold tracking-tight">Questions</h2></Reveal>
      <div className="mt-10 divide-y divide-line border-y border-line">
        {FAQ.map(([q, a], i) => (
          <div key={q}>
            <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-4 py-5 text-left text-lg font-medium">
              {q}<motion.span animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration: 0.3 }}><ChevronDown size={20} className="text-dim" /></motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} className="overflow-hidden">
                  <p className="pb-5 pr-8 leading-relaxed text-dim">{a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="px-5 pb-24">
      <Reveal>
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-line bg-panel px-8 py-16 text-center sm:py-20">
          <div aria-hidden className="absolute left-1/2 top-0 h-64 w-[34rem] -translate-x-1/2 rounded-full bg-iris/25 blur-[100px]" />
          <h2 className="relative font-display text-4xl font-semibold tracking-tight sm:text-5xl">Have an image you&apos;re unsure about?</h2>
          <p className="relative mx-auto mt-4 max-w-md text-dim">It takes about ten seconds and you don&apos;t need an account.</p>
          <Link href="/analyze" className="btn btn-primary relative mt-8">Analyze an image</Link>
        </div>
      </Reveal>
    </section>
  );
}

export default function Home() {
  return (
    <main>
      <Hero /><Signals /><How /><Honest /><Faq /><Cta /><Footer />
    </main>
  );
}
