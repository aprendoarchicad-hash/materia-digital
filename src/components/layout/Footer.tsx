export default function Footer() {
  return (
    <footer className="bg-bg border-t-2 border-ink py-8 h-[80px] flex items-center">
      <div className="container-custom flex justify-between items-center w-full font-mono text-[10px] uppercase tracking-[0.1em] font-bold text-ink/60">
        <div className="flex gap-12">
          <span>SYST_VER_2026.04</span>
          <span className="hidden md:inline">ARCHITECTURE & ENGINEERING CORE</span>
        </div>
        <div className="text-right">
          © 2026 MATERIA // DIGI
        </div>
      </div>
    </footer>
  );
}
