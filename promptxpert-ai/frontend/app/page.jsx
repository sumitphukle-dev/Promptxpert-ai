"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useScroll, useSpring } from "framer-motion";
import { Activity, Sparkles, ChevronDown, FileSearch, Fingerprint, Layers, LayoutDashboard, Link2, Palette, ShieldAlert, ShieldCheck, Shuffle, Wand2 } from "lucide-react";
import Footer from "@/components/Footer";
import Gauge from "@/components/Gauge";
import Reveal from "@/components/Reveal";
import ScanStage from "@/components/ScanStage";

const EASE = [0.2, 0.8, 0.2, 1];

function Hero() {
  const words = "Turn any image into the perfect prompt.".split(" ");
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
            Upload an image and get ready-to-use prompts for Midjourney, Stable Diffusion, Flux and DALL·E, then fine-tune every detail in the studio. You can also check an image&apos;s authenticity signals, and we keep that evidence honest and separate.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.8, ease: EASE }} className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/prompt-lab" className="btn btn-primary"><Sparkles size={16} /> Open Prompt Lab</Link>
            <Link href="/generator" className="btn btn-ghost">Generate from an image</Link>
            <Link href="/analyze" className="rounded-full px-3 py-2 text-sm text-dim transition-colors hover:text-lumen">Check authenticity</Link>
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


const TOOLS = [
  [Sparkles, "Professional Prompt Lab", "Expand one-line ideas into structured prompts with role, context, objective, constraints, output format and examples.", "sm:col-span-2"],
  [Fingerprint, "Prompt quality analyzer", "Score clarity, context, constraints, output format and examples—or switch to a visual rubric for subject detail, light, composition and style."],
  [LayoutDashboard, "Six expert starters", "Get a useful head start with researcher, copywriter, tutor, developer, product and analyst templates."],
  [Layers, "Model-aware structure", "Shape instructions for ChatGPT, Claude, Gemini or use a clean, universal prompt."],
  [Activity, "Drafts and version restore", "Your draft saves locally in this browser. Revisit and restore earlier prompt versions."],
  [Shuffle, "Rewrite and translate", "Polish a prompt with AI or translate it into Hindi, Marathi, English and other languages."],
  [Wand2, "Prompt Studio", "Toggle, weight and edit every detail the AI found, with a live prompt, token meter and completeness score.", "sm:col-span-2"],
  [Shuffle, "Five target generators", "Midjourney flags, Stable Diffusion weights, Flux and DALL·E prose, or universal tags."],
  [Sparkles, "AI rewrite tools", "Polish, expand, shorten, translate, reimagine in 8 styles, or draft a negative prompt."],
  [Layers, "Forensic heatmaps", "Overlay error-level, noise and frequency maps on your photo.", "sm:col-span-2"],
  [Activity, "Robustness check", "Re-runs the detector on edited copies to show if the estimate holds."],
  [ShieldAlert, "Privacy scan", "Finds GPS and serial numbers in a file, and strips them in one click."],
  [Palette, "Palette export", "Copy dominant colours as CSS variables, Tailwind or JSON."],
  [Link2, "Compare and share", "Slide-compare two images and share a results-only link."],
  [Activity, "Prompt Improvement Score", "See detail, clarity, composition, lighting and completeness at a glance, with practical suggestions."],
  [Shuffle, "Multilingual prompts", "Translate prompts into Hindi, Marathi, English and 17 more languages while retaining generator syntax."],
];

function Toolkit() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <Reveal><h2 className="max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">More than a yes or no</h2></Reveal>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map(([Icon, t, d, span], i) => (
          <Reveal key={t} delay={i * 0.05} className={span || ""}>
            <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="card h-full p-6 transition-colors hover:border-iris/50">
              <Icon size={20} className="text-iris" /><h3 className="mt-4 font-display text-xl font-semibold">{t}</h3><p className="mt-2 text-sm leading-relaxed text-dim">{d}</p>
            </motion.div>
          </Reveal>))}
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
  ["Which AI powers prompts?", "Groq's vision-capable model describes uploaded images and powers prompt rewrites: polish, expand, shorten, translate, reimagine and negative prompts."],
  ["Why does it sometimes say inconclusive?", "Because that is the honest answer when the evidence is weak or conflicting. A forced yes or no would be less trustworthy."],
  ["Can it verify C2PA Content Credentials?", "It detects whether a credential appears to be embedded and says when it has not validated the signature."],
  ["Which generators are supported?", "Universal tags, Midjourney, Stable Diffusion, Flux and DALL·E 3. Each gets syntax it understands, such as aspect-ratio flags, word weights or plain prose."],
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
          <h2 className="relative font-display text-4xl font-semibold tracking-tight sm:text-5xl">Got an image you want to recreate?</h2>
          <p className="relative mx-auto mt-4 max-w-md text-dim">It takes about ten seconds and you don&apos;t need an account.</p>
          <Link href="/generator" className="btn btn-primary relative mt-8">Generate a prompt</Link>
        </div>
      </Reveal>
    </section>
  );
}

export default function Home() {
  return (
    <main>
      <Hero /><Signals /><Toolkit /><How /><Honest /><Faq /><Cta /><Footer />
    </main>
  );
}
