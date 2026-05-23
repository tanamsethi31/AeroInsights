import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useAuth0 } from "@auth0/auth0-react";

/* ─── helpers ──────────────────────────────────────────────────────────────── */
function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

function useScrolled(threshold = 10) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [threshold]);
  return scrolled;
}

/* ─── animation primitives ─────────────────────────────────────────────────── */
function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 22 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.52, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ─── section blend (smooths background transitions) ──────────────────────── */
function Blend({
  from,
  to,
  position = "top",
  h = 96,
}: {
  from: string;
  to: string;
  position?: "top" | "bottom";
  h?: number;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-x-0", position === "top" ? "top-0" : "bottom-0")}
      style={{ height: h, background: `linear-gradient(to bottom, ${from}, ${to})` }}
    />
  );
}

/* ─── shared sub-components ────────────────────────────────────────────────── */
function SectionPill({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3.5 py-1 text-xs font-semibold tracking-wide",
        dark
          ? "border-white/15 bg-white/8 text-blue-300"
          : "border-[#002147]/20 bg-[#002147]/5 text-[#002147]"
      )}
    >
      {children}
    </span>
  );
}

function SectionHeader({
  pill,
  heading,
  sub,
  center = true,
  dark = false,
}: {
  pill: string;
  heading: React.ReactNode;
  sub?: string;
  center?: boolean;
  dark?: boolean;
}) {
  return (
    <FadeIn className={cn("flex flex-col gap-4", center && "items-center text-center")}>
      <SectionPill dark={dark}>{pill}</SectionPill>
      <h2
        className={cn(
          "max-w-2xl text-4xl font-black tracking-tight sm:text-5xl leading-[1.08]",
          dark ? "text-white" : "text-gray-950"
        )}
      >
        {heading}
      </h2>
      {sub && (
        <p className={cn("max-w-xl text-base leading-relaxed", dark ? "text-blue-200/70" : "text-gray-500")}>
          {sub}
        </p>
      )}
    </FadeIn>
  );
}

/* ─── ANIMATED PARTICLE CANVAS ──────────────────────────────────────────────── */
function AnimatedDotsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      canvas!.width = canvas!.offsetWidth;
      canvas!.height = canvas!.offsetHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number };
    const N = 90;
    const LINK = 130;

    const pts: P[] = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      r: Math.random() * 1.2 + 0.4,
      a: Math.random() * 0.35 + 0.1,
    }));

    let raf: number;
    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;
      ctx!.clearRect(0, 0, w, h);

      pts.forEach((p) => {
        p.x = (p.x + p.vx + w) % w;
        p.y = (p.y + p.vy + h) % h;
      });

      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK) {
            ctx!.beginPath();
            ctx!.moveTo(pts[i].x, pts[i].y);
            ctx!.lineTo(pts[j].x, pts[j].y);
            ctx!.strokeStyle = `rgba(100,160,240,${0.14 * (1 - d / LINK)})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      }

      pts.forEach((p) => {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(160,200,255,${p.a})`;
        ctx!.fill();
      });

      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

/* ─── NAVBAR ───────────────────────────────────────────────────────────────── */
const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Platform", href: "#platform" },
  { label: "Pricing", href: "#pricing" },
  { label: "Solution", href: "#solution" },
  { label: "Contact", href: "#contact" },
];

function Navbar() {
  const scrolled = useScrolled();
  const { isAuthenticated } = useAuth0();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-gray-200 bg-white/95 backdrop-blur-md shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link to="/home" className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#002147] p-1.5">
            <img src="/logo.png" alt="AeroInsights" className="h-full w-full object-contain" />
          </div>
          <span
            className={cn(
              "text-[1.05rem] font-extrabold tracking-tight transition-colors duration-300",
              scrolled ? "text-gray-950" : "text-white"
            )}
          >
            AeroInsights
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={(e) => {
                e.preventDefault();
                document.querySelector(l.href)?.scrollIntoView({ behavior: "smooth" });
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                scrolled
                  ? "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              )}
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Right CTAs */}
        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <Link
              to="/portfolios"
              className="flex items-center gap-1.5 rounded-lg bg-[#002147] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <i className="bi bi-grid-1x2" />
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  scrolled ? "text-gray-700 hover:bg-gray-100" : "text-white/80 hover:bg-white/10 hover:text-white"
                )}
              >
                Sign In
              </Link>
              <Link
                to="/login"
                className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#002147] shadow-sm transition hover:bg-blue-50"
              >
                Request Demo
                <i className="bi bi-arrow-right text-xs" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border md:hidden",
            scrolled ? "border-gray-200 text-gray-600" : "border-white/20 text-white"
          )}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <i className={cn("bi text-lg", mobileOpen ? "bi-x" : "bi-list")} />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-gray-200 bg-white px-4 pb-4 md:hidden"
          >
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block py-2.5 text-sm text-gray-600"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2">
              <Link
                to="/login"
                className="rounded-lg border border-gray-200 px-4 py-2 text-center text-sm font-medium text-gray-700"
              >
                Sign In
              </Link>
              <Link
                to="/login"
                className="rounded-lg bg-[#002147] px-4 py-2 text-center text-sm font-semibold text-white"
              >
                Request Demo
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ─── HERO ─────────────────────────────────────────────────────────────────── */
function DashboardMock() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#000d1a] shadow-2xl shadow-black/60">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-white/5 bg-white/4 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-red-400/70" />
        <span className="size-2.5 rounded-full bg-amber-400/70" />
        <span className="size-2.5 rounded-full bg-green-400/70" />
        <div className="ml-2 flex-1 rounded-md bg-white/5 px-3 py-1 text-[10px] text-white/35">
          app.aeroinsights.io/portfolio
        </div>
      </div>

      {/* App shell */}
      <div className="flex" style={{ height: 420 }}>
        {/* Sidebar */}
        <div className="hidden w-48 flex-col gap-1 border-r border-white/5 bg-white/3 p-3 sm:flex">
          <div className="flex items-center gap-2 rounded-lg bg-[#002147] px-2 py-1.5 text-[11px] font-semibold text-white">
            <i className="bi bi-grid-1x2-fill text-xs" />
            Portfolio
          </div>
          {["Scenarios", "Deals", "Risk & ECL", "Intelligence", "Reports"].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-white/35">
              <i className="bi bi-circle text-[9px]" />
              {item}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Portfolio Value", value: "$2.41B", trend: "+3.2%", up: true },
              { label: "Fleet Size", value: "48 Aircraft", trend: "5 NB due", up: true },
              { label: "Avg LTV", value: "67.3%", trend: "-1.1pp", up: false },
              { label: "ECL Reserve", value: "$14.2M", trend: "Stage 2: 3", up: false },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border border-white/5 bg-white/5 p-2.5">
                <p className="text-[9px] text-white/35">{k.label}</p>
                <p className="mt-0.5 text-sm font-bold text-white">{k.value}</p>
                <p className={cn("text-[9px] font-medium", k.up ? "text-emerald-400" : "text-rose-400")}>
                  {k.trend}
                </p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="flex-1 rounded-lg border border-white/5 bg-white/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-white/65">Lease Maturity Profile</p>
                <p className="text-[9px] text-white/30">Annualised rent by expiry year</p>
              </div>
              <div className="flex gap-1 text-[9px] text-white/30">
                {["2025", "2026", "2027"].map((y) => (
                  <span key={y} className="rounded bg-white/5 px-1.5 py-0.5">{y}</span>
                ))}
              </div>
            </div>
            <div className="flex h-28 items-end gap-1.5">
              {[55, 72, 88, 63, 95, 47, 81, 70, 58, 76, 42, 66].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${h}%`,
                    background: i % 3 === 0 ? "#2b5fa8" : i % 3 === 1 ? "#4878c4" : "#5a8fd8",
                    opacity: 0.9,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-white/5 bg-white/5">
            <div className="grid grid-cols-4 border-b border-white/5 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-white/30">
              <span>Aircraft</span>
              <span>Lessee</span>
              <span>Rent / month</span>
              <span>Maturity</span>
            </div>
            {[
              ["B737-8 MAX", "SkyWave Air", "$410K", "Mar 2028"],
              ["A320neo", "AtlanticJet", "$390K", "Jun 2027"],
              ["B777-300ER", "Pacific Wings", "$620K", "Nov 2029"],
            ].map((row) => (
              <div
                key={row[0]}
                className="grid grid-cols-4 border-b border-white/5 px-3 py-1.5 text-[9px] text-white/45 last:border-0"
              >
                {row.map((cell) => <span key={cell}>{cell}</span>)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-16"
      style={{ background: "#001228" }}
    >
      {/* Animated particle network */}
      <AnimatedDotsCanvas />

      {/* Centre glow */}
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-28">
        <div
          className="h-[620px] w-[1100px] rounded-full opacity-30"
          style={{ background: "radial-gradient(ellipse at center, #3b82f6 0%, #001a40 50%, transparent 72%)" }}
        />
      </div>

      {/* Bottom fade to white (solid color gradient — no alpha, no muddy mid-tone) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48"
        style={{ background: "linear-gradient(to bottom, #001228 0%, #001228 40%, #ffffff 100%)" }}
      />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-10 px-4 py-20 sm:px-6 sm:py-28">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <a
            href="#features"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector("#features")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3.5 py-1.5 text-sm font-medium text-white/85 backdrop-blur-sm transition hover:bg-white/14"
          >
            <i className="bi bi-stars text-amber-400 text-xs" />
            Excel Add-In Now Available
            <i className="bi bi-arrow-right text-xs text-white/45" />
          </a>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          className="max-w-4xl text-center text-5xl font-black text-white sm:text-6xl lg:text-7xl leading-[1.02]"
          style={{ letterSpacing: "-0.035em" }}
        >
          Aviation Finance{" "}
          <span className="text-[#7aa6e0]">Intelligence,</span>{" "}
          Engineered for Lessors
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16 }}
          className="max-w-2xl text-center text-lg text-white/65 leading-relaxed"
        >
          AeroInsights unifies portfolio analytics, scenario modelling, risk &amp; ECL,
          and AI-powered deal intelligence — purpose-built for aviation finance teams.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.24 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            to="/login"
            className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#002147] shadow-lg shadow-black/25 transition hover:bg-blue-50"
          >
            Request a Demo
            <i className="bi bi-arrow-right text-xs" />
          </Link>
          <a
            href="#platform"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector("#platform")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/8 px-6 py-3 text-sm font-semibold text-white/85 backdrop-blur-sm transition hover:bg-white/14"
          >
            <i className="bi bi-play-circle text-white/55" />
            See How It Works
          </a>
        </motion.div>

        {/* Dashboard mock */}
        <motion.div
          initial={{ opacity: 0, y: 36, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-5xl"
        >
          <div className="relative">
            <DashboardMock />
            {/* Fade dashboard bottom into the dark section bg (no alpha mid-tone) */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-32 rounded-b-xl"
              style={{ background: "linear-gradient(to bottom, rgba(0,18,40,0) 0%, #001228 90%)" }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── TRUSTED BY ────────────────────────────────────────────────────────────── */
const LOGOS = [
  "AerCap Holdings",
  "Air Lease Corp",
  "SMBC Aviation",
  "BOC Aviation",
  "Avolon",
  "Avolon Capital",
  "ICBC Leasing",
  "Atlas Air",
];

function TrustedBy() {
  return (
    <section className="border-y border-gray-100 bg-white py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <FadeIn>
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
            Trusted by aviation finance teams worldwide
          </p>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {LOGOS.map((name) => (
              <span key={name} className="text-sm font-semibold text-gray-300 transition hover:text-[#002147]/50">
                {name}
              </span>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── STATS ─────────────────────────────────────────────────────────────────── */
const STATS = [
  { icon: "bi-currency-dollar", value: "$45B+", label: "Assets Modelled", sub: "Across global portfolios" },
  { icon: "bi-airplane", value: "200+", label: "Aircraft Types", sub: "Narrowbody, widebody & cargo" },
  { icon: "bi-graph-up-arrow", value: "50+", label: "Scenario Templates", sub: "Stress-tested & regulatory" },
  { icon: "bi-shield-check", value: "99.9%", label: "Platform Uptime", sub: "SLA-backed reliability" },
];

function Stats() {
  return (
    <section className="bg-white py-8 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map((s, i) => (
            <FadeIn key={s.label} delay={i * 0.07}>
              <div className="flex flex-col items-center rounded-2xl border border-[#002147]/8 bg-white p-6 text-center shadow-sm">
                <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#002147]/8">
                  <i className={cn("bi text-xl text-[#002147]", s.icon)} />
                </div>
                <p className="text-2xl font-black text-gray-950">{s.value}</p>
                <p className="text-sm font-semibold text-gray-700">{s.label}</p>
                <p className="mt-0.5 text-xs text-gray-400">{s.sub}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── SOLUTION BENTO (saas-magicui style) ───────────────────────────────────── */
function BentoCard({
  className,
  delay = 0,
  children,
}: {
  className?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/8 p-6",
        "bg-gradient-to-br from-white/7 to-white/2",
        "transition-all duration-300 hover:border-white/18 hover:from-white/10",
        className
      )}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function PortfolioSparkline() {
  const bars = [42, 58, 71, 55, 89, 62, 78, 93, 67, 85, 74, 96];
  return (
    <div className="mt-4 flex h-20 items-end gap-1">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t transition-all"
          style={{
            height: `${h}%`,
            background: `rgba(91,143,216,${0.4 + (h / 100) * 0.5})`,
          }}
        />
      ))}
    </div>
  );
}

function SolutionBento() {
  return (
    <section id="solution" style={{ background: "#001228" }} className="relative overflow-hidden py-24">
      {/* blend FROM previous white section */}
      <Blend from="#ffffff" to="#001228" position="top" h={110} />
      {/* blend INTO next white section */}
      <Blend from="#001228" to="#ffffff" position="bottom" h={110} />
      {/* subtle top glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          width: 900,
          height: 280,
          background: "radial-gradient(ellipse at top, rgba(59,130,246,0.18), transparent 65%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          pill="The Solution"
          heading={<>One platform for every lessor workflow</>}
          sub="From portfolio onboarding to AI-driven deal origination — AeroInsights is the operating system for modern aircraft lessors."
          dark
        />

        <div
          className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3"
          style={{ gridAutoRows: "190px" }}
        >
          {/* Large card — portfolio analytics */}
          <BentoCard className="md:col-span-2 md:row-span-2 flex flex-col justify-between p-7" delay={0}>
            <div>
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-[#002147]">
                <i className="bi bi-bar-chart-fill text-lg text-white" />
              </div>
              <p className="text-lg font-black text-white">Portfolio Analytics</p>
              <p className="mt-1.5 text-sm text-blue-200/65 leading-relaxed">
                Real-time lease register, LTV monitoring, concentration risk, and fleet-level performance — all in one live dashboard.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { k: "Fleet", v: "48 a/c" },
                  { k: "On Lease", v: "46 a/c" },
                  { k: "Portfolio Value", v: "$2.41B" },
                ].map((s) => (
                  <div key={s.k} className="rounded-xl border border-white/8 bg-white/5 p-3 text-center">
                    <p className="text-sm font-bold text-white">{s.v}</p>
                    <p className="text-[10px] text-white/40">{s.k}</p>
                  </div>
                ))}
              </div>
            </div>
            <PortfolioSparkline />
          </BentoCard>

          {/* IFRS 9 */}
          <BentoCard delay={0.08} className="flex flex-col gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#002147]">
              <i className="bi bi-shield-check text-base text-white" />
            </div>
            <p className="font-bold text-white">IFRS 9 Ready</p>
            <p className="text-xs text-blue-200/60 leading-relaxed">
              Built-in ECL computation with staging migration, PD/LGD curves, and full audit trail.
            </p>
            <div className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Audit-grade outputs
            </div>
          </BentoCard>

          {/* AI Intelligence */}
          <BentoCard delay={0.14} className="flex flex-col gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#002147]">
              <i className="bi bi-stars text-base text-white" />
            </div>
            <p className="font-bold text-white">AI Intelligence</p>
            <div className="flex flex-col gap-1.5 mt-1">
              {[
                { name: "AtlanticJet", signal: "Covenant risk", color: "bg-rose-500" },
                { name: "SkyWave Air", signal: "Recovery +18%", color: "bg-emerald-500" },
                { name: "NordicFly", signal: "CAPA alert", color: "bg-amber-500" },
              ].map((l) => (
                <div key={l.name} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5">
                  <span className={cn("size-1.5 rounded-full shrink-0", l.color)} />
                  <span className="text-[10px] text-white/70 font-medium">{l.name}</span>
                  <span className="ml-auto text-[10px] text-white/40">{l.signal}</span>
                </div>
              ))}
            </div>
          </BentoCard>

          {/* Excel integration */}
          <BentoCard delay={0.2} className="flex flex-col gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#002147]">
              <i className="bi bi-file-earmark-spreadsheet text-base text-white" />
            </div>
            <p className="font-bold text-white">Excel Add-In</p>
            <p className="text-xs text-blue-200/60 leading-relaxed">
              Pull live portfolio data directly into Excel — no API wrangling required.
            </p>
            <div className="mt-auto rounded-lg border border-white/8 bg-[#001228] px-3 py-2 font-mono text-[10px] text-blue-300">
              =AI.Portfolio("fleet_size")
            </div>
          </BentoCard>

          {/* Scenario engine — wide */}
          <BentoCard delay={0.26} className="md:col-span-2 flex items-center gap-6">
            <div className="flex-1">
              <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-[#002147]">
                <i className="bi bi-sliders text-base text-white" />
              </div>
              <p className="font-bold text-white">Scenario Engine</p>
              <p className="mt-1.5 text-xs text-blue-200/60 leading-relaxed">
                Model base, stress, and upside scenarios across your full portfolio in one click. IFRS 9 aligned, regulatory-ready.
              </p>
            </div>
            <div className="hidden shrink-0 flex-col gap-2 sm:flex">
              {[
                { label: "Base", val: "$2.41B", color: "text-emerald-400" },
                { label: "Stress", val: "$1.87B", color: "text-amber-400" },
                { label: "Upside", val: "$2.74B", color: "text-blue-400" },
              ].map((sc) => (
                <div key={sc.label} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-4 py-2">
                  <span className="text-[10px] text-white/45 w-12">{sc.label}</span>
                  <span className={cn("text-sm font-bold", sc.color)}>{sc.val}</span>
                </div>
              ))}
            </div>
          </BentoCard>
        </div>
      </div>
    </section>
  );
}

/* ─── PLATFORM FEATURES ─────────────────────────────────────────────────────── */
function PortfolioMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-[#002147]/5">
      <div className="border-b border-gray-100 bg-[#002147]/4 px-5 py-3 text-xs font-semibold text-[#002147]/70">
        Portfolio Overview — Q2 2025
      </div>
      <div className="p-5 space-y-4">
        {[
          { label: "Narrowbody", pct: 62, val: "$1.49B", color: "#002147" },
          { label: "Widebody", pct: 28, val: "$675M", color: "#334e74" },
          { label: "Regional", pct: 10, val: "$240M", color: "#6b8cbb" },
        ].map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-gray-700">{r.label}</span>
              <span className="text-gray-400">{r.val}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100">
              <div className="h-2 rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
            </div>
          </div>
        ))}
        <div className="mt-4 grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
          {[{ k: "Fleet", v: "48 a/c" }, { k: "On Lease", v: "46 a/c" }, { k: "Off-Lease", v: "2 a/c" }].map((s) => (
            <div key={s.k} className="rounded-xl bg-[#002147]/5 p-3 text-center">
              <p className="text-sm font-bold text-gray-900">{s.v}</p>
              <p className="text-[10px] text-gray-400">{s.k}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntelligenceMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-[#002147]/5">
      <div className="border-b border-gray-100 bg-[#002147]/4 px-5 py-3 text-xs font-semibold text-[#002147]/70">
        AI Intelligence — Lessee Radar
      </div>
      <div className="divide-y divide-gray-100">
        {[
          { name: "AtlanticJet", flag: "🇮🇪", signal: "Covenant breach risk", score: "High", color: "bg-rose-100 text-rose-700" },
          { name: "SkyWave Air", flag: "🇸🇬", signal: "Traffic recovery +18% MoM", score: "Low", color: "bg-emerald-100 text-emerald-700" },
          { name: "Pacific Wings", flag: "🇯🇵", signal: "Fleet expansion — new RFP", score: "Medium", color: "bg-amber-100 text-amber-700" },
          { name: "NordicFly", flag: "🇸🇪", signal: "CAPA restructuring alert", score: "High", color: "bg-rose-100 text-rose-700" },
        ].map((l) => (
          <div key={l.name} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">{l.flag}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{l.name}</p>
                <p className="text-[10px] text-gray-400">{l.signal}</p>
              </div>
            </div>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", l.color)}>
              {l.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PLATFORM_FEATURES = [
  {
    id: "portfolio",
    pill: "Portfolio Analytics",
    heading: "Complete visibility across your entire fleet",
    sub: "Live lease register, LTV analytics, maturity profiles, concentration risk heatmaps — all in one place. No more spreadsheets.",
    bullets: [
      "Real-time lease register with XLSX export",
      "LTV & DSC ratio monitoring by aircraft",
      "Lessee concentration & jurisdiction risk",
      "Fleet maturity and re-leasing pipeline",
      "Scenario-adjusted portfolio valuation",
    ],
    mock: <PortfolioMock />,
    reverse: false,
  },
  {
    id: "intelligence",
    pill: "AI-Powered Intelligence",
    heading: "Know your lessees before they call you",
    sub: "Our AI scans news, filings, traffic data, and market feeds to surface actionable signals about your counterparties and deal opportunities.",
    bullets: [
      "Lessee Radar with risk score & signal feed",
      "Deal Feed with comparable transaction data",
      "Jurisdiction Watch for geopolitical alerts",
      "Rate Outlook with forward curve analytics",
      "One-click AI summary on any deal or lease",
    ],
    mock: <IntelligenceMock />,
    reverse: true,
  },
];

function PlatformFeatures() {
  return (
    <section id="platform" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          pill="Platform Features"
          heading={<>Everything you need to manage aircraft assets</>}
          sub="From day-one portfolio setup to sophisticated AI-driven origination — AeroInsights covers the full workflow."
        />

        <div className="mt-20 flex flex-col gap-24">
          {PLATFORM_FEATURES.map((feat) => (
            <div
              key={feat.id}
              className={cn(
                "flex flex-col items-center gap-12 lg:flex-row",
                feat.reverse && "lg:flex-row-reverse"
              )}
            >
              <FadeIn className="flex-1">{feat.mock}</FadeIn>
              <FadeIn delay={0.1} className="flex flex-1 flex-col gap-5">
                <SectionPill>{feat.pill}</SectionPill>
                <h3 className="text-3xl font-black tracking-tight text-gray-950 leading-tight">
                  {feat.heading}
                </h3>
                <p className="text-gray-500 leading-relaxed">{feat.sub}</p>
                <ul className="flex flex-col gap-2">
                  {feat.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-gray-700">
                      <i className="bi bi-check2 mt-0.5 text-base text-[#002147]" />
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3 pt-2">
                  <Link
                    to="/login"
                    className="flex items-center gap-1.5 rounded-xl bg-[#002147] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-85 transition-opacity"
                  >
                    Get Started
                    <i className="bi bi-arrow-right text-xs" />
                  </Link>
                  <a
                    href="#contact"
                    onClick={(e) => {
                      e.preventDefault();
                      document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-[#002147]/20 px-5 py-2.5 text-sm font-semibold text-[#002147] hover:bg-[#002147]/5 transition-colors"
                  >
                    Talk to Us
                  </a>
                </div>
              </FadeIn>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── ADDITIONAL FEATURES GRID ──────────────────────────────────────────────── */
const EXTRA_FEATURES = [
  { icon: "bi-calculator", title: "Scenario Modelling", desc: "Run base, stress, and upside scenarios across your full portfolio with one click. IFRS 9 ready." },
  { icon: "bi-clipboard-data", title: "Risk & ECL", desc: "IFRS 9-compliant expected credit loss computation with staging migration and waterfall reports." },
  { icon: "bi-tools", title: "Maintenance Forecasting", desc: "Predict MRO costs by airframe, engine, and component using historical and fleet-wide data." },
  { icon: "bi-cash-stack", title: "Deal Generator", desc: "Model new lease structures, exit NPV, sale-leaseback scenarios, and rack-stack analysis." },
  { icon: "bi-file-earmark-spreadsheet", title: "Excel Add-In", desc: "Pull live portfolio data directly into Excel for custom analysis without leaving your workflow." },
  { icon: "bi-globe2", title: "Jurisdiction Intelligence", desc: "Monitor geopolitical risk, repossession complexity, and regulatory changes by country." },
];

function ExtraFeatures() {
  return (
    <section id="features" className="bg-[#f4f7fd] py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          pill="Full Feature Set"
          heading={<>Built for modern aviation finance workflows</>}
          sub="Every module follows aviation finance best practices with real-time data, regulatory alignment, and seamless team collaboration."
        />
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXTRA_FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.06}>
              <div className="flex flex-col gap-3 rounded-2xl border border-[#002147]/8 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-[#002147]/18">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[#002147]/8">
                  <i className={cn("bi text-lg text-[#002147]", f.icon)} />
                </div>
                <p className="font-bold text-gray-950">{f.title}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
        <FadeIn className="mt-10 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-gray-500">
            <Link
              to="/login"
              className="flex items-center gap-1 font-semibold text-[#002147] underline-offset-2 hover:underline"
            >
              View Documentation <i className="bi bi-arrow-right text-xs" />
            </Link>
            <span>·</span>
            <a
              href="#contact"
              onClick={(e) => { e.preventDefault(); document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" }); }}
              className="hover:text-[#002147] hover:underline transition-colors"
            >
              Talk to our team
            </a>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── PRICING ───────────────────────────────────────────────────────────────── */
type BillingCycle = "monthly" | "annually";

const PLANS = [
  {
    name: "Starter",
    desc: "For smaller portfolios and analyst teams getting started.",
    monthlyPrice: 1200,
    features: ["Up to 25 aircraft", "Portfolio analytics & lease register", "Basic scenario modelling", "PDF & XLSX reporting", "Email support"],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Professional",
    desc: "For established lessors managing mid-size fleets.",
    monthlyPrice: 3800,
    features: ["Up to 150 aircraft", "Full scenario & ECL engine", "AI Intelligence module", "Deal Generator & rack-stack", "Excel Add-In access", "Priority support"],
    cta: "Get Started",
    highlight: true,
  },
  {
    name: "Enterprise",
    desc: "Custom solutions for large fleets and multi-team firms.",
    monthlyPrice: null,
    features: ["Unlimited aircraft", "Multi-portfolio management", "Custom integrations & API", "Dedicated CSM & SLA", "On-premise deployment option", "Custom reporting & white-label"],
    cta: "Contact Us",
    highlight: false,
  },
];

function Pricing() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  return (
    <section id="pricing" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          pill="Pricing Plans"
          heading="Choose your plan"
          sub="Start with a free pilot, scale as you grow. All plans include our core portfolio analytics."
        />

        <FadeIn delay={0.1} className="mt-8 flex items-center justify-center gap-4">
          <div className="flex rounded-full border border-gray-200 bg-gray-50 p-1">
            {(["monthly", "annually"] as BillingCycle[]).map((c) => (
              <button
                key={c}
                onClick={() => setBilling(c)}
                className={cn(
                  "rounded-full px-5 py-1.5 text-sm font-medium transition-all",
                  billing === c ? "bg-white text-gray-950 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
          {billing === "annually" && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Save 20%
            </span>
          )}
        </FadeIn>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {PLANS.map((plan, i) => {
            const price =
              plan.monthlyPrice === null
                ? null
                : billing === "annually"
                ? Math.round(plan.monthlyPrice * 0.8)
                : plan.monthlyPrice;
            return (
              <FadeIn key={plan.name} delay={i * 0.08}>
                <div
                  className={cn(
                    "flex h-full flex-col rounded-2xl border p-7 shadow-sm transition hover:shadow-md",
                    plan.highlight
                      ? "border-[#002147] bg-[#002147] text-white"
                      : "border-gray-200 bg-white"
                  )}
                >
                  <div className="flex-1">
                    <p className={cn("text-lg font-bold", plan.highlight ? "text-white" : "text-gray-950")}>
                      {plan.name}
                    </p>
                    <p className={cn("mt-1 text-sm leading-relaxed", plan.highlight ? "text-blue-200/70" : "text-gray-500")}>
                      {plan.desc}
                    </p>
                    <div className="my-6">
                      {price !== null ? (
                        <>
                          <span className={cn("text-4xl font-black", plan.highlight ? "text-white" : "text-gray-950")}>
                            ${price.toLocaleString()}
                          </span>
                          <span className={cn("ml-1 text-sm", plan.highlight ? "text-blue-200/60" : "text-gray-500")}>
                            / month
                          </span>
                        </>
                      ) : (
                        <span className={cn("text-3xl font-black", plan.highlight ? "text-white" : "text-gray-950")}>
                          Custom
                        </span>
                      )}
                    </div>
                    <ul className="flex flex-col gap-2.5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <i className={cn("bi bi-check2 mt-0.5 text-base", plan.highlight ? "text-blue-300" : "text-[#002147]")} />
                          <span className={plan.highlight ? "text-blue-100/80" : "text-gray-600"}>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link
                    to="/login"
                    className={cn(
                      "mt-8 block w-full rounded-xl py-2.5 text-center text-sm font-semibold transition",
                      plan.highlight
                        ? "bg-white text-[#002147] hover:bg-blue-50"
                        : "border border-[#002147]/20 bg-white text-[#002147] hover:bg-[#002147]/5"
                    )}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </FadeIn>
            );
          })}
        </div>

        <FadeIn className="mt-6 text-center text-sm text-gray-500">
          Need a custom pilot or have questions?{" "}
          <a
            href="#contact"
            onClick={(e) => { e.preventDefault(); document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" }); }}
            className="font-semibold text-[#002147] hover:underline"
          >
            Contact our team
          </a>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── TESTIMONIALS ──────────────────────────────────────────────────────────── */
const TESTIMONIALS = [
  {
    initials: "MO",
    name: "Michael O'Brien",
    role: "Head of Portfolio Analytics, AerCap",
    quote: "AeroInsights cut our portfolio reporting time from three days to under two hours. The scenario engine alone has saved us countless hours at quarter-end.",
  },
  {
    initials: "SL",
    name: "Sarah Lin",
    role: "VP Risk, Air Lease Corporation",
    quote: "The IFRS 9 ECL module is exactly what our team needed. Staging migration, PD curves, waterfall — all in one auditable workflow. Our auditors love it.",
  },
  {
    initials: "RK",
    name: "Rajiv Kumar",
    role: "MD Aviation Finance, SMBC Aviation Capital",
    quote: "Lessee Radar has transformed how our origination team tracks counterparty risk. We catch signals weeks before they surface in public filings.",
  },
  {
    initials: "ET",
    name: "Emma Thornton",
    role: "CFO, Avolon",
    quote: "The Excel Add-In is a game-changer. Our analysts get live data directly in their models without any API wrangling. Adoption was immediate.",
  },
  {
    initials: "JM",
    name: "James McLoughlin",
    role: "Analyst, BOC Aviation",
    quote: "Coming from a background of fragmented spreadsheets, having deals, scenarios, and ECL in a single platform is transformational.",
  },
  {
    initials: "AP",
    name: "Anika Petrov",
    role: "Risk Director, ICBC Leasing",
    quote: "Jurisdiction Watch helped us navigate the 2023 geopolitical events with real-time alerts. We reduced our cross-border exposure before anyone else reacted.",
  },
];

function Testimonials() {
  return (
    <section className="bg-[#f4f7fd] py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          pill="Testimonials"
          heading="Trusted by aviation finance leaders"
          sub="Hear from the portfolio managers, risk directors, and analysts who use AeroInsights every day."
        />
        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <FadeIn key={t.name} delay={i * 0.07}>
              <div className="flex flex-col gap-4 rounded-2xl border border-[#002147]/8 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-[#002147] text-sm font-bold text-white">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-950">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">"{t.quote}"</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ───────────────────────────────────────────────────────────────────── */
const FAQS = [
  {
    q: "What types of aircraft lessors does AeroInsights serve?",
    a: "AeroInsights is designed for commercial aircraft lessors of all sizes — from specialist boutique lessors to the world's largest lessor groups. We support narrowbody, widebody, and regional fleets.",
  },
  {
    q: "Is AeroInsights IFRS 9 compliant?",
    a: "Yes. Our Risk & ECL module is purpose-built for IFRS 9 compliance, with PD/LGD/EAD inputs, staging migration matrices, and full audit trail outputs compatible with external review.",
  },
  {
    q: "How does the Excel Add-In work?",
    a: "The Add-In connects directly to your AeroInsights portfolio via a secure API. You can pull live data into Excel cells, refresh on demand, and build custom models without leaving your existing workflow.",
  },
  {
    q: "Can we integrate AeroInsights with our existing systems?",
    a: "Enterprise plans include full API access and custom integration support. We connect with common accounting, treasury, and data systems used in aviation finance.",
  },
  {
    q: "How long does onboarding take?",
    a: "Most teams are live within 5–10 business days. Our onboarding wizard guides you through uploading your portfolio, configuring your ECL assumptions, and connecting your data sources.",
  },
  {
    q: "Is our data secure?",
    a: "All data is encrypted at rest and in transit. We comply with SOC 2 Type II standards, offer SSO via your existing identity provider, and can discuss data residency requirements for enterprise clients.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeader
          pill="FAQ"
          heading="Common questions"
          sub="Everything you need to know about AeroInsights. Can't find the answer? Contact our team."
        />

        <div className="mt-12 flex flex-col divide-y divide-gray-100 rounded-2xl border border-[#002147]/10 bg-white shadow-sm overflow-hidden">
          {FAQS.map((faq, i) => (
            <FadeIn key={faq.q} delay={i * 0.05}>
              <button
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-[#002147]/3"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#002147]/8">
                    <i className="bi bi-question text-sm text-[#002147]" />
                  </div>
                  <span className="text-sm font-semibold text-gray-950">{faq.q}</span>
                </div>
                <i
                  className={cn(
                    "bi bi-chevron-down shrink-0 text-gray-400 transition-transform duration-200",
                    open === i && "rotate-180"
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-sm text-gray-500 leading-relaxed pl-16">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.1} className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Still have questions?{" "}
            <a
              href="#contact"
              onClick={(e) => { e.preventDefault(); document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" }); }}
              className="font-semibold text-[#002147] hover:underline"
            >
              We&apos;re here to help.
            </a>
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── CTA BANNER ────────────────────────────────────────────────────────────── */
function CTABanner() {
  return (
    <section style={{ background: "#001228" }} className="relative overflow-hidden py-24">
      <Blend from="#ffffff" to="#001228" position="top" h={110} />
      <Blend from="#001228" to="#ffffff" position="bottom" h={110} />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          width: 900,
          height: 260,
          background: "radial-gradient(ellipse at top, rgba(59,130,246,0.18), transparent 65%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <FadeIn className="flex flex-col items-center gap-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-300/60">
            ✦ Purpose-built for aviation lessors
          </p>
          <h2 className="max-w-2xl text-4xl font-black tracking-tight text-white sm:text-5xl leading-[1.08]">
            Ready to transform your aviation finance operation?
          </h2>
          <p className="max-w-lg text-blue-200/65 leading-relaxed">
            Join the aviation finance teams already using AeroInsights to manage portfolios, model
            risk, and close deals faster.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="flex items-center gap-2 rounded-xl bg-white px-7 py-3 text-sm font-semibold text-[#002147] shadow-lg shadow-black/25 hover:bg-blue-50 transition-colors"
            >
              Request a Demo
              <i className="bi bi-arrow-right text-xs" />
            </Link>
            <a
              href="#contact"
              onClick={(e) => { e.preventDefault(); document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" }); }}
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/8 px-7 py-3 text-sm font-semibold text-white/85 hover:bg-white/14 transition-colors"
            >
              Contact Us
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-6 pt-2 text-xs text-blue-300/50">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Free pilot available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-blue-400" />
              SOC 2 compliant
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-purple-400" />
              IFRS 9 ready
            </span>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── CONTACT ───────────────────────────────────────────────────────────────── */
function Contact() {
  const [form, setForm] = useState({ name: "", email: "", firm: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <section id="contact" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          pill="Get In Touch"
          heading="Need help or want a demo?"
          sub="Our team of aviation finance specialists is here to help you evaluate AeroInsights for your portfolio."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          <div className="flex flex-col gap-4">
            {[
              { icon: "bi-envelope", title: "Email Us", desc: "For sales, onboarding, or support enquiries.", action: "hello@aeroinsights.io" },
              { icon: "bi-calendar-check", title: "Book a Demo", desc: "Schedule a 30-minute walkthrough with our team.", action: "Schedule a Call" },
              { icon: "bi-book", title: "Documentation", desc: "Browse our guides, tutorials, and API reference.", action: "View Docs" },
            ].map((card) => (
              <FadeIn key={card.title}>
                <div className="flex flex-col gap-3 rounded-2xl border border-[#002147]/10 bg-white p-5 shadow-sm">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[#002147]/8">
                    <i className={cn("bi text-lg text-[#002147]", card.icon)} />
                  </div>
                  <p className="font-semibold text-gray-950">{card.title}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{card.desc}</p>
                  <span className="text-sm font-semibold text-[#002147]">{card.action}</span>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.1} className="sm:col-span-2">
            <div className="rounded-2xl border border-[#002147]/10 bg-white p-8 shadow-sm">
              {sent ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50">
                    <i className="bi bi-check2-circle text-3xl text-emerald-600" />
                  </div>
                  <p className="text-lg font-bold text-gray-950">Message sent!</p>
                  <p className="text-sm text-gray-500">We'll be in touch within one business day.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <i className="bi bi-envelope-paper" />
                    Send us a message
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-600">Full name</label>
                      <input
                        required type="text" placeholder="Jane Smith"
                        value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#002147]/25"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-600">Work email</label>
                      <input
                        required type="email" placeholder="jane@lessor.com"
                        value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#002147]/25"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600">Firm / Organisation</label>
                    <input
                      type="text" placeholder="AerCap Holdings"
                      value={form.firm} onChange={(e) => setForm({ ...form, firm: e.target.value })}
                      className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#002147]/25"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600">Message</label>
                    <textarea
                      required rows={4} placeholder="Tell us about your portfolio and what you're looking to solve..."
                      value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#002147]/25"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-[#002147] py-3 text-sm font-semibold text-white transition hover:opacity-85"
                  >
                    Send Message
                  </button>
                </form>
              )}
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* ─── NEWSLETTER ────────────────────────────────────────────────────────────── */
function Newsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  return (
    <section className="border-t border-[#002147]/8 bg-[#f4f7fd] py-14">
      <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
        <FadeIn>
          <p className="text-lg font-bold text-gray-950">Stay updated</p>
          <p className="mt-1.5 text-sm text-gray-500">
            Receive aviation finance insights, product updates, and regulatory news monthly.
          </p>
          {done ? (
            <p className="mt-6 text-sm font-semibold text-emerald-600">
              ✓ You're subscribed. Welcome aboard!
            </p>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); if (email) setDone(true); }}
              className="mt-6 flex gap-2"
            >
              <input
                type="email" required placeholder="Enter your email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="flex-1 rounded-xl border border-[#002147]/15 bg-white px-4 py-2.5 text-sm text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#002147]/25"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#002147] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-85 transition-opacity"
              >
                Subscribe
              </button>
            </form>
          )}
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── FOOTER ────────────────────────────────────────────────────────────────── */
const FOOTER_COLS = [
  { heading: "Platform", links: ["Portfolio Analytics", "Scenario Engine", "Risk & ECL", "Deal Generator", "Intelligence", "Excel Add-In"] },
  { heading: "Company", links: ["About", "Careers", "Blog", "Press"] },
  { heading: "Resources", links: ["Documentation", "Help Centre", "API Reference", "Status Page"] },
  { heading: "Legal", links: ["Privacy Policy", "Terms of Service", "Security", "Cookie Policy"] },
];

function Footer() {
  return (
    <footer style={{ background: "#001228" }} className="relative overflow-hidden py-14">
      <Blend from="#f4f7fd" to="#001228" position="top" h={90} />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
          {/* Brand */}
          <div className="flex flex-col gap-4 lg:max-w-xs">
            <Link to="/home" className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#002147] p-1.5">
                <img src="/logo.png" alt="AeroInsights" className="h-full w-full object-contain" />
              </div>
              <span className="text-[1.05rem] font-extrabold tracking-tight text-white">
                AeroInsights
              </span>
            </Link>
            <p className="text-sm text-blue-200/50 leading-relaxed">
              The decision intelligence platform for aircraft lessors. Portfolio analytics,
              scenario modelling, risk &amp; ECL, and AI-powered deal intelligence — in one place.
            </p>
            <div className="flex gap-3 text-white/30">
              {["bi-linkedin", "bi-twitter-x", "bi-github", "bi-globe"].map((icon) => (
                <button
                  key={icon}
                  className="flex size-8 items-center justify-center rounded-lg border border-white/8 transition hover:bg-white/8 hover:text-white/70"
                >
                  <i className={cn("bi text-sm", icon)} />
                </button>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="grid flex-1 grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_COLS.map((col) => (
              <div key={col.heading} className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
                  {col.heading}
                </p>
                {col.links.map((link) => (
                  <a key={link} href="#" className="text-sm text-blue-200/45 transition hover:text-white">
                    {link}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 sm:flex-row">
          <p className="text-xs text-white/25">
            © {new Date().getFullYear()} AeroInsights Ltd. All rights reserved.
          </p>
          <p className="text-xs text-white/25">
            Built for aviation finance professionals worldwide.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── PAGE ──────────────────────────────────────────────────────────────────── */
export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-950 antialiased">
      <Navbar />
      <main>
        <Hero />
        <TrustedBy />
        <Stats />
        <SolutionBento />
        <PlatformFeatures />
        <ExtraFeatures />
        <Pricing />
        <Testimonials />
        <FAQ />
        <CTABanner />
        <Contact />
        <Newsletter />
      </main>
      <Footer />
    </div>
  );
}
