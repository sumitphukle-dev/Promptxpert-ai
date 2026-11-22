import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-sm">
          <div className="mb-3 flex items-center gap-2.5 font-display text-lg font-semibold"><Logo size={24} /> PromptXpert AI</div>
          <p className="text-sm leading-relaxed text-dim">An assistive tool, not a forensic verdict. Results are estimates from automated signals and can be wrong.</p>
        </div>
        <p className="text-sm text-dim sm:text-right">
          Final-year B.Sc. IT project, 2026-27<br />
          Karmaveer Bhaurao Patil College, Vashi<br />
          Guide: Prof. Tazeen A. Shaikh
        </p>
      </div>
    </footer>
  );
}
