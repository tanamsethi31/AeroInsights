import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useAuth0 } from "@auth0/auth0-react";
import { AnimatedGroup } from "../components/ui/AnimatedGroup";
import { useScrollRestore } from "../hooks/useScrollRestore";

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

/* ─── shared brand colour constants ────────────────────────────────────────── */
const BRAND = "#002147";       // Oxford Blue — primary
const DARK_BG = "#0a1a33";     // softer dark navy used for atmospheric sections
const SOFT_BG = "#f4f7fd";     // subtle off-white used for alternating light sections

/**
 * Stand-alone transition section.
 *
 * Sits between two flat-coloured sections — its full height IS the gradient.
 * Adjacent sections start/end with their flat fill, so there is no overlap
 * and no visible seam where overlays would otherwise meet the page.
 *
 * Multi-stop curve passes through carefully picked mid-tones so light↔dark
 * transitions don't smear through muddy grey.
 */
function TransitionBand({
  from,
  to,
  height = 260,
  glow,
}: {
  from: string;
  to: string;
  height?: number;
  /** Optional accent colour for a soft radial glow centred at top — usually only
   *  used when transitioning INTO a dark section so the join feels lifted */
  glow?: string;
}) {
  // Pick 2 intermediate stops by interpolating in oklab-ish perceptual space
  // (simple weighted hex mix is good enough — we keep colours warm-blue, no grey).
  const stops = buildSmoothStops(from, to);
  return (
    <div
      aria-hidden
      className="relative w-full"
      style={{
        height,
        background: `linear-gradient(to bottom, ${stops[0]} 0%, ${stops[1]} 35%, ${stops[2]} 70%, ${stops[3]} 100%)`,
      }}
    >
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto"
          style={{
            height: Math.round(height * 0.9),
            background: `radial-gradient(ellipse at 50% 100%, ${glow}, transparent 65%)`,
          }}
        />
      )}
    </div>
  );
}

/** Mix two hex colours by ratio (0 = colour A, 1 = colour B). */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.replace("#", ""), 16);
  const pb = parseInt(b.replace("#", ""), 16);
  const ar = (pa >> 16) & 0xff, ag = (pa >> 8) & 0xff, ab = pa & 0xff;
  const br = (pb >> 16) & 0xff, bg = (pb >> 8) & 0xff, bb = pb & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

/** Build 4 stops for a smooth perceptual-feeling gradient between two colours. */
function buildSmoothStops(from: string, to: string): [string, string, string, string] {
  // Bias the curve so the transition spends more time near the dark colour
  // (eyes are more sensitive to changes at the dark end).
  return [from, mixHex(from, to, 0.28), mixHex(from, to, 0.62), to];
}

/* ─── shared sub-components ────────────────────────────────────────────────── */
function SectionPill({
  children,
  dark = false,
  className,
}: {
  children: React.ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        // `w-fit` keeps width to content. Alignment is owned by the parent
        // (so SectionHeader's `items-center` actually centres the pill).
        // Pass `self-start` via `className` where the pill needs to hug left
        // inside a stretch-default flex-col (e.g. PlatformFeatures side card).
        "inline-flex w-fit max-w-fit items-center whitespace-nowrap rounded-full border px-3.5 py-1 text-xs font-semibold tracking-wide",
        dark
          ? "border-white/15 bg-white/8 text-blue-300"
          : "border-[#002147]/20 bg-[#002147]/5 text-[#002147]",
        className
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

/* ─── AMBIENT BLOB BACKGROUND ───────────────────────────────────────────────
 * One continuous atmospheric layer behind the entire landing page.
 * Large, low-opacity, heavily-blurred colour blobs drift slowly with organic
 * keyframes — creates a smooth, modern SaaS feel and removes hard section
 * colour breaks entirely.
 *  • Fixed positioning so blobs stay anchored as the user scrolls.
 *  • `mix-blend-multiply` keeps blobs subtle on the pale base — they add
 *    *colour*, never blowing out content.
 *  • Each blob has its own keyframe + duration so they never sync.
 *  • GPU-friendly transform-only animation. Disabled under reduced-motion.
 * ─────────────────────────────────────────────────────────────────────────── */
function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Lighter, cleaner base — same gradient as the About page for visual parity */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #fafcff 0%, #f4f7fd 38%, #f6f8fd 72%, #f0f4fb 100%)",
        }}
      />

      {/* Blue-only palette + softer opacities (0.55-0.70) — matched to the About
          page so both surfaces feel like one continuous canvas. */}
      <div
        className="animate-blob-a absolute -left-20 top-[4%] h-[760px] w-[760px] rounded-full opacity-[0.65] mix-blend-multiply blur-[120px]"
        style={{ background: "radial-gradient(circle, #6fa6ff 0%, transparent 70%)" }}
      />
      <div
        className="animate-blob-b absolute -right-32 top-[22%] h-[820px] w-[820px] rounded-full opacity-[0.60] mix-blend-multiply blur-[130px]"
        style={{ background: "radial-gradient(circle, #4f7fd6 0%, transparent 70%)" }}
      />
      <div
        className="animate-blob-c absolute -left-24 top-[52%] h-[780px] w-[780px] rounded-full opacity-[0.65] mix-blend-multiply blur-[125px]"
        style={{ background: "radial-gradient(circle, #6fcdf2 0%, transparent 70%)" }}
      />
      <div
        className="animate-blob-a absolute -right-16 bottom-[6%] h-[680px] w-[680px] rounded-full opacity-[0.55] mix-blend-multiply blur-[120px]"
        style={{ background: "radial-gradient(circle, #8ab4f0 0%, transparent 70%)" }}
      />
      {/* Steel slate-blue centre — kept for compositional depth, softened to
          sit at the same intensity level as the rest. */}
      <div
        className="animate-blob-b absolute left-[40%] top-[38%] h-[540px] w-[540px] rounded-full opacity-[0.45] mix-blend-multiply blur-[125px]"
        style={{ background: "radial-gradient(circle, #5d83b8 0%, transparent 75%)" }}
      />

      {/* Fine dot-grid — matched to the About page (alpha + opacity) */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,33,71,0.07) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  );
}

/* ─── HERO MOUSE-TRACKING GLOW ──────────────────────────────────────────────── */
function HeroGlow() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const glow = glowRef.current;
    if (!glow) return;
    const section = glow.parentElement;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let targetX = section.offsetWidth / 2;
    let targetY = section.offsetHeight * 0.38;
    let currentX = targetX;
    let currentY = targetY;
    let raf: number;

    const onMove = (e: MouseEvent) => {
      const rect = section.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;
    };

    const tick = () => {
      // Smooth lerp — glow lags gently behind cursor for a fluid feel
      currentX += (targetX - currentX) * 0.09;
      currentY += (targetY - currentY) * 0.09;
      glow.style.transform = `translate(${currentX - 400}px, ${currentY - 400}px)`;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    section.addEventListener("mousemove", onMove);

    return () => {
      section.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={glowRef}
      aria-hidden
      className="pointer-events-none absolute top-0 left-0"
      style={{
        width: 800,
        height: 800,
        background:
          "radial-gradient(circle at center, rgba(0,33,71,0.06) 0%, rgba(0,33,71,0.022) 45%, transparent 70%)",
        willChange: "transform",
      }}
    />
  );
}

/* ─── HERO STARFIELD — parallax dots that drift with the cursor ─────────────
 * A constellation of tiny soft-blue dots, each on its own "depth layer". As
 * the cursor moves, each star translates by `cursor * -depth`, producing a
 * gentle parallax that feels like looking through space.
 * GPU-only (only transform), and disabled under reduced motion.
 * ─────────────────────────────────────────────────────────────────────────── */
const HERO_STARS = (() => {
  // Deterministic pseudo-random so layout is stable across renders.
  const rand = (() => {
    let s = 9173;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  })();
  return Array.from({ length: 140 }, (_, i) => {
    const r1 = rand();
    const size = 1 + r1 * r1 * 4.5;             // ~1–5.5px, biased small
    const opacity = rand() * 0.55 + 0.35;       // 0.35–0.90
    const depth = rand() * 0.10 + 0.04;         // cursor-parallax strength
    const x = rand() * 100;                     // % across hero
    const y = rand() * 100;                     // % down hero
    const twinkleDelay = rand() * 6;            // 0–6s
    // Autonomous drift: 4 keyframe variants, varied duration + delay so no
    // two stars sync. Bigger stars drift a touch slower (feel farther away).
    const driftVariant = ["A", "B", "C", "D"][i % 4];
    const driftDuration = 8 + rand() * 9 + (size > 3 ? 4 : 0);  // 8–17s, +4 if big
    const driftDelay = rand() * 8;
    return { size, opacity, depth, x, y, twinkleDelay, driftVariant, driftDuration, driftDelay };
  });
})();

function HeroStarfield() {
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const section = field.parentElement;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const stars = Array.from(field.children) as HTMLElement[];
    let targetX = 0, targetY = 0, curX = 0, curY = 0;
    let raf: number;

    const onMove = (e: MouseEvent) => {
      const rect = section.getBoundingClientRect();
      // Cursor offset from section centre, in pixels
      targetX = e.clientX - rect.left - rect.width / 2;
      targetY = e.clientY - rect.top - rect.height / 2;
    };

    const tick = () => {
      curX += (targetX - curX) * 0.06;
      curY += (targetY - curY) * 0.06;
      // Translate each star by cursor * its depth (so further stars move more)
      stars.forEach((s, i) => {
        const d = HERO_STARS[i].depth;
        s.style.transform = `translate3d(${-curX * d}px, ${-curY * d}px, 0)`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    section.addEventListener("mousemove", onMove);
    return () => {
      section.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={fieldRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {HERO_STARS.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-[#002147] will-change-transform"
          style={{
            width: s.size,
            height: s.size,
            top: `${s.y}%`,
            left: `${s.x}%`,
            opacity: s.opacity,
            boxShadow:
              s.size > 3
                ? `0 0 ${Math.round(s.size * 3)}px rgba(0,33,71,0.55), 0 0 ${Math.round(s.size * 7)}px rgba(91,143,216,0.25)`
                : s.size > 1.5
                ? `0 0 ${Math.round(s.size * 2.5)}px rgba(0,33,71,0.40)`
                : "0 0 2px rgba(0,33,71,0.25)",
            ["--star-base" as any]: s.opacity.toString(),
            // Two animations: starDrift{A|B|C|D} writes `translate`,
            // starTwinkle writes `opacity`. JS still writes `transform` for
            // cursor parallax. `translate` + `transform` compose cleanly.
            animation:
              `starDrift${s.driftVariant} ${s.driftDuration}s ease-in-out ${s.driftDelay}s infinite, ` +
              `starTwinkle 5.5s ease-in-out ${s.twinkleDelay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── NAVBAR ───────────────────────────────────────────────────────────────── */
const CONTACT_MAILTO = "mailto:sethit@tcd.ie?subject=AeroInsights%20%C2%B7%20Hello";
const DEMO_LINK = "https://cal.com/tanam-sethi/30min";
const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Platform", href: "#platform" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "/about", route: true as const },
  // Contact scrolls to the in-page "Get In Touch" section (id="contact").
  { label: "Contact", href: "#contact" },
];

function Navbar() {
  // The floating pill is intentionally constant — it does not transform on
  // scroll. Mobile-menu open state is the only stateful concern here.
  const { isAuthenticated } = useAuth0();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
    {/* Full-width blur band — fixed to the very top of the viewport, no gap,
        spanning the full screen. Pure backdrop-filter, no surface tint, so
        scrolling content behind the navbar is visibly blurred edge-to-edge.
        Sits beneath the pills (z-40) so it never intercepts pointer events. */}
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[160px] backdrop-blur-[26px] backdrop-saturate-150"
      style={{
        WebkitMaskImage:
          "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 38%, rgba(0,0,0,0.85) 58%, rgba(0,0,0,0.45) 80%, rgba(0,0,0,0) 100%)",
        maskImage:
          "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 38%, rgba(0,0,0,0.85) 58%, rgba(0,0,0,0.45) 80%, rgba(0,0,0,0) 100%)",
      }}
    />
    <header className="fixed inset-x-0 top-3 z-50 flex justify-center px-3 sm:top-4 sm:px-4">
      {/*
        Two pills side-by-side, centered as a unit:
          - Primary pill: logo + nav links + Book a Demo CTA
          - Secondary pill: auth-state button (Sign In OR Dashboard ↗)
        The secondary pill is its own dark surface, separated from the primary
        by a 2-unit gap, so it reads as a distinct affordance.
      */}
      <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex items-center gap-7 rounded-full border border-white/15 py-2.5 pl-5 pr-3.5 shadow-2xl shadow-[#001228]/35 backdrop-blur-[36px] backdrop-saturate-150",
          "bg-[#0a1a33]/92"
        )}
      >
        {/* Logo */}
        <Link to="/home" className="flex items-center gap-2.5 pl-1">
          <div className="flex size-7 items-center justify-center rounded-md bg-white/12 p-1">
            <img src="/logo.png" alt="AeroInsights" className="h-full w-full object-contain" />
          </div>
          <span className="text-[0.95rem] font-extrabold tracking-tight text-white">
            AeroInsights
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-3 md:flex">
          {NAV_LINKS.map((l) =>
            l.route ? (
              <Link
                key={l.label}
                to={l.href}
                className="rounded-full px-3.5 py-1.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.label}
                href={l.href}
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector(l.href)?.scrollIntoView({ behavior: "smooth" });
                }}
                className="rounded-full px-3.5 py-1.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              >
                {l.label}
              </a>
            )
          )}
        </nav>

        {/* Primary right CTA: Book a Demo only — Sign In / Dashboard moved to
            the secondary pill that follows. */}
        <div className="hidden items-center md:flex" style={{ marginLeft: 5 }}>
          <a
            href={DEMO_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-[#0a1a33] shadow-sm transition hover:bg-blue-50"
          >
            <i className="bi bi-calendar-event text-xs" />
            Book a Demo
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="ml-1 flex size-8 items-center justify-center rounded-lg border border-white/12 text-white/80 transition-colors hover:bg-white/10 hover:text-white md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          <i className={cn("bi text-lg", mobileOpen ? "bi-x" : "bi-list")} />
        </button>
      </div>

      {/*
        Secondary auth pill: ONE rounded-full button. Text reads
        "Sign In | Dashboard" in both auth states; href flips by state
        so signed-out users land on /login and signed-in users on the
        dashboard. Slide-in brand-blue gradient on hover via the
        .auth-pill-btn class (defined in fonts.css).
      */}
      {isAuthenticated ? (
        <a
          href="/portfolios"
          target="_blank"
          rel="noopener noreferrer"
          className="auth-pill-btn hidden h-[54px] items-center gap-2 rounded-full border border-white/12 bg-[#0a1a33]/92 px-5 text-sm font-semibold text-white shadow-2xl shadow-[#001228]/35 backdrop-blur-[36px] backdrop-saturate-150 md:inline-flex"
        >
          <i className="bi bi-box-arrow-in-right text-base" />
          Sign In | Dashboard
        </a>
      ) : (
        <Link
          to="/login"
          className="auth-pill-btn hidden h-[54px] items-center gap-2 rounded-full border border-white/12 bg-[#0a1a33]/92 px-5 text-sm font-semibold text-white shadow-2xl shadow-[#001228]/35 backdrop-blur-[36px] backdrop-saturate-150 md:inline-flex"
        >
          <i className="bi bi-box-arrow-in-right text-base" />
          Sign In | Dashboard
        </Link>
      )}
      </div>

      {/* Mobile menu — drops below the pill, matches the pill's dark
          aesthetic so it reads as the same surface expanded downward. */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-3 right-3 top-[calc(100%+10px)] rounded-2xl border border-white/10 bg-[#0a1a33]/97 px-4 py-3 shadow-2xl shadow-[#001228]/40 backdrop-blur-[36px] backdrop-saturate-150 md:hidden"
          >
            {NAV_LINKS.map((l) =>
              l.route ? (
                <Link
                  key={l.label}
                  to={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {l.label}
                </Link>
              ) : (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {l.label}
                </a>
              )
            )}
            <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3">
              <Link
                to="/login"
                className="rounded-lg border border-white/15 px-4 py-2 text-center text-sm font-medium text-white/85"
              >
                Sign In
              </Link>
              <a
                href={DEMO_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2 text-center text-sm font-semibold text-[#0a1a33]"
              >
                <i className="bi bi-calendar-event text-xs" />
                Book a Demo
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
    </>
  );
}

/* ─── HERO ─────────────────────────────────────────────────────────────────── */
function DashboardMock() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#002147]/12 bg-[#000d1a] shadow-2xl shadow-[#002147]/10">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-white/5 bg-white/4 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-red-400/70" />
        <span className="size-2.5 rounded-full bg-amber-400/70" />
        <span className="size-2.5 rounded-full bg-green-400/70" />
        <div className="ml-2 flex-1 rounded-md bg-white/5 px-3 py-1 text-[10px] text-white/35">
          aeroinsights.vercel.app/portfolios
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

/* ─── ROTATING ROLE — cycles the last word of the headline ──────────────────
 * Industries the platform configures around. One-word labels chosen so the
 * cycle reads cleanly inside the headline cadence.
 */
const HEADLINE_ROLES = [
  "Lessors",
  "Financiers",
  "Advisors",
  "Technicians",
  "Components",
  "Engines",
  "Manufacturers",
  "Traders",
];
// Reserve layout width using the longest word so the headline never reflows
const LONGEST_ROLE = HEADLINE_ROLES.reduce((a, b) => (b.length > a.length ? b : a));

function RotatingRole() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((p) => (p + 1) % HEADLINE_ROLES.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="relative inline-block align-baseline text-[#002147]">
      {/* Invisible spacer holds the widest possible width — no reflow on swap */}
      <span aria-hidden className="invisible">{LONGEST_ROLE}</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={HEADLINE_ROLES[i]}
          initial={{ opacity: 0, y: 36, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0,  filter: "blur(0px)" }}
          exit={{    opacity: 0, y: -36, filter: "blur(6px)" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 whitespace-nowrap"
        >
          {HEADLINE_ROLES[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* Tailark hero choreography ported to AeroInsights:
 *   - top stack (badge → headline → sub) animates with a "blur-slide" stagger
 *     and a 1s delayChildren, so the reveal reads as one continuous breath
 *   - CTAs use the same item variant but their own container with a faster
 *     stagger + earlier delayChildren so they overlap the headline tail
 *   - dashboard mock sits in a framed card with a top-gradient fade so the
 *     hero settles into the page (replaces the old motion.div fade)
 *   - top-left radial wash + light ambient backdrop sit BEHIND everything
 */
const heroItemVariants = {
  hidden: { opacity: 0, filter: "blur(12px)", y: 12 },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: { type: "spring", bounce: 0.3, duration: 1.5 },
  },
} as const;

function Hero() {
  // Hero video modal state. Click the play button overlaid on the dashboard
  // mockup to open; Escape, backdrop click, or the close button to dismiss.
  // Body scroll is locked while the modal is open so the page underneath
  // does not move when the user scrolls inside the video.
  const [videoOpen, setVideoOpen] = useState(false);
  useEffect(() => {
    if (!videoOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVideoOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [videoOpen]);

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-16">
      <HeroGlow />
      <HeroStarfield />

      {/* Soft top-left radial wash, à la tailark — pure visual, no layout cost */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[2] hidden opacity-50 lg:block"
        style={{ contain: "strict" }}
      >
        <div
          className="absolute left-0 top-0 h-[80rem] w-[35rem] -translate-y-[350px] -rotate-45 rounded-full"
          style={{
            background:
              "radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(212,80%,55%,0.10) 0, hsla(212,80%,55%,0.03) 50%, hsla(212,80%,55%,0) 80%)",
          }}
        />
        <div
          className="absolute left-0 top-0 h-[80rem] w-56 -rotate-45 rounded-full"
          style={{
            translate: "5% -50%",
            background:
              "radial-gradient(50% 50% at 50% 50%, hsla(212,80%,55%,0.08) 0, hsla(212,80%,55%,0.02) 80%, transparent 100%)",
          }}
        />
        <div
          className="absolute left-0 top-0 h-[80rem] w-56 -translate-y-[350px] -rotate-45"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 50%, hsla(212,80%,55%,0.05) 0, hsla(212,80%,55%,0.02) 80%, transparent 100%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-10 px-4 py-20 sm:px-6 sm:py-28">
        {/* Badge → headline → sub, one stagger group, delayed so the page
            settles before content reveals. */}
        <AnimatedGroup
          className="flex flex-col items-center gap-7"
          variants={{
            container: {
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.12, delayChildren: 0.6 },
              },
            },
            item: heroItemVariants,
          }}
        >
          <a
            href="#features"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector("#features")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex items-center gap-2 rounded-full border border-[#002147]/15 bg-[#002147]/5 px-3.5 py-1.5 text-sm font-medium text-[#002147] transition hover:bg-[#002147]/10"
          >
            <i className="bi bi-stars text-amber-500 text-xs" />
            Excel Add-In Now Available
            <i className="bi bi-arrow-right text-xs text-[#002147]/45" />
          </a>

          <h1
            className="max-w-4xl text-center text-5xl font-black leading-[1.02] text-gray-950 sm:text-6xl lg:text-7xl"
            style={{ letterSpacing: "-0.035em" }}
          >
            Aviation Finance{" "}
            <span className="text-[#002147]">Intelligence,</span>{" "}
            Engineered for <RotatingRole />
          </h1>

          <p className="max-w-2xl text-balance text-center text-lg leading-relaxed text-gray-600">
            Portfolio analytics, scenario modelling, risk &amp; ECL, and AI-powered deal
            intelligence in one platform, purpose-built for aviation finance teams.
          </p>
        </AnimatedGroup>

        {/* CTAs — separate group with its own faster cadence so they tail
            the headline reveal rather than block on it. */}
        <AnimatedGroup
          className="flex flex-wrap items-center justify-center gap-2"
          variants={{
            container: {
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.05, delayChildren: 0.85 },
              },
            },
            item: heroItemVariants,
          }}
        >
          {/* Inner-bordered primary, à la tailark */}
          <div className="rounded-[14px] border border-[#002147]/15 bg-[#002147]/8 p-0.5">
            <a
              href={DEMO_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-[#002147] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#002147]/25 transition hover:bg-[#001a38]"
            >
              <i className="bi bi-calendar-event text-sm" />
              Book a Demo
            </a>
          </div>
          <a
            href="#platform"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector("#platform")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-[#002147] transition hover:bg-[#002147]/5"
          >
            <i className="bi bi-play-circle text-[#002147]/55" />
            See How It Works
          </a>
        </AnimatedGroup>

        {/* Mockup card: outer ring + inner shadow + top-fade gradient (so the
            mockup blends into the page rather than ending in a hard edge). */}
        <AnimatedGroup
          className="relative -mx-4 w-screen max-w-none sm:mx-0 sm:w-full sm:max-w-[min(1320px,calc(100vw-2rem))]"
          variants={{
            container: {
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.05, delayChildren: 0.95 },
              },
            },
            item: heroItemVariants,
          }}
        >
          <div className="relative overflow-hidden rounded-2xl px-2">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10"
              style={{
                background:
                  "linear-gradient(to bottom, transparent 0%, transparent 35%, rgba(244,247,253,0.85) 92%, rgba(244,247,253,1) 100%)",
              }}
            />
            <div className="relative mx-auto overflow-hidden rounded-2xl shadow-2xl shadow-[#002147]/15">
              {/* Real /portfolios screenshot — sits flush, no card chrome.
                  Falls back to the synthetic DashboardMock if the file is
                  missing. */}
              <img
                src="/portfolio-hero.png"
                alt="AeroInsights portfolio dashboard"
                loading="eager"
                className="block w-full rounded-2xl"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const mock = (e.currentTarget as HTMLImageElement)
                    .nextElementSibling as HTMLElement | null;
                  if (mock) mock.style.display = "block";
                }}
              />
              <div style={{ display: "none" }}>
                <DashboardMock />
              </div>

              {/* Play button overlay — opens the launch video modal. Sits
                  above the screenshot and below the bottom-fade gradient
                  (which is z-10 on the outer wrapper); this button is
                  inside the inner clipping box so the rounded corners
                  contain it. */}
              <button
                type="button"
                onClick={() => setVideoOpen(true)}
                aria-label="Play introductory video"
                className="group absolute inset-0 z-20 flex items-center justify-center"
              >
                <span className="flex items-center gap-3 rounded-full bg-[#002147]/92 py-2.5 pl-2.5 pr-5 text-sm font-semibold text-white shadow-2xl shadow-[#002147]/40 ring-1 ring-white/15 backdrop-blur-md transition-all duration-300 group-hover:scale-[1.04] group-hover:bg-[#002147] group-hover:shadow-[#002147]/55">
                  <span className="relative flex size-10 items-center justify-center rounded-full bg-white text-[#002147]">
                    {/* Pulse halo — only animates while the mockup is hovered */}
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-white/55 opacity-0 transition-opacity duration-200 group-hover:opacity-70 motion-safe:group-hover:animate-ping"
                    />
                    <i className="bi bi-play-fill relative ml-0.5 text-lg" />
                  </span>
                  Play video
                </span>
              </button>
            </div>
          </div>
        </AnimatedGroup>
      </div>

      {/* Launch video modal. Renders only when open; click outside the
          video, the close button, or Escape to dismiss. Body scroll is
          locked via the effect above while open. */}
      <AnimatePresence>
        {videoOpen && (
          <motion.div
            key="video-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#001228]/85 p-4 backdrop-blur-md sm:p-8"
            onClick={(e) => {
              if (e.target === e.currentTarget) setVideoOpen(false);
            }}
            role="dialog"
            aria-modal="true"
            aria-label="AeroInsights introductory video"
          >
            <button
              type="button"
              onClick={() => setVideoOpen(false)}
              aria-label="Close video"
              className="absolute right-4 top-4 z-[101] flex size-10 items-center justify-center rounded-full bg-white/10 text-white shadow-lg backdrop-blur transition hover:bg-white/20 sm:right-6 sm:top-6"
            >
              <i className="bi bi-x-lg text-lg" />
            </button>
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <video
                src="/aeroinsights-launch.mp4"
                controls
                autoPlay
                playsInline
                className="block h-full w-full bg-black"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ─── LOGO MARQUEE — revolving rail of demo partners ───────────────────────── */
const PARTNER_LOGOS: { name: string; src: string; h?: number }[] = [
  // Per-brand heights tuned so visual weights match across the rail. The
  // logos with very thin lockups (tgis, aerfin, skyworks) get extra height.
  { name: "Aerfin",                   src: "/logos/aerfin.webp",         h: 84 },
  { name: "Genesis",                  src: "/logos/genesis.webp",        h: 56 },
  { name: "Grant Thornton",           src: "/logos/grant-thornton.webp", h: 50 },
  { name: "ELFC",                     src: "/logos/elfc.png",            h: 42 },
  { name: "KPMG",                     src: "/logos/kpmg.webp",           h: 40 },
  { name: "TGIS Aviation",            src: "/logos/tgis.webp",           h: 88 },
  { name: "TrueNoord",                src: "/logos/truenoord.webp",      h: 70 },
  { name: "Ishka Airglobal Finance",  src: "/logos/ishka.webp",          h: 40 },
  { name: "Skyworks",                 src: "/logos/skyworks.webp",       h: 82 },
  { name: "EY",                       src: "/logos/ey.webp",             h: 50 },
  { name: "Cloudcards",               src: "/logos/cloudcards.png",      h: 38 },
];

function LogoMarquee() {
  // Duplicate the array so the marquee can scroll seamlessly (translateX -50% loops)
  const rail = [...PARTNER_LOGOS, ...PARTNER_LOGOS];
  return (
    <section className="relative py-14">
      <div className="mx-auto mb-10 max-w-7xl px-4 sm:px-6">
        <FadeIn>
          <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-[#002147]/75">
            Demoed with &amp; shaped by aviation finance leaders
          </p>
        </FadeIn>
      </div>
      <div
        className="marquee-pause relative overflow-hidden"
        style={{
          // Mask so the rail feathers into the ambient background at both ends
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
        }}
      >
        <div className="animate-marquee flex w-max items-center gap-16 will-change-transform">
          {rail.map((logo, i) => (
            <div
              key={`${logo.name}-${i}`}
              className="flex h-28 shrink-0 items-center justify-center px-2"
              aria-hidden={i >= PARTNER_LOGOS.length}
            >
              <img
                src={logo.src}
                alt={logo.name}
                loading="lazy"
                draggable={false}
                style={{ height: logo.h ?? 42 }}
                className={cn(
                  "max-w-none select-none object-contain",
                  // Subtle greyscale with hover restoring full colour — keeps the
                  // rail visually quiet but lets each brand pop on inspection.
                  "opacity-70 grayscale transition-all duration-300",
                  "hover:opacity-100 hover:grayscale-0"
                )}
              />
            </div>
          ))}
        </div>
      </div>
      <FadeIn delay={0.15}>
        <p className="mx-auto mt-10 max-w-2xl px-4 text-center text-sm font-medium text-gray-700 sm:px-6">
          Insights, assumptions &amp; frameworks shaped by review sessions with execs at each of
          these firms.
        </p>
      </FadeIn>
    </section>
  );
}

/* ─── STATS ─────────────────────────────────────────────────────────────────── */
const STATS: {
  icon: string;
  to: number;
  decimals: number;
  suffix: string;
  label: string;
  sub: string;
}[] = [
  { icon: "bi-grid-3x3-gap",   to: 6,    decimals: 0, suffix: "",  label: "Core Modules",       sub: "End-to-end lessor workflow" },
  { icon: "bi-airplane",       to: 200,  decimals: 0, suffix: "+", label: "Aircraft Types",     sub: "Narrowbody, widebody & cargo" },
  { icon: "bi-graph-up-arrow", to: 50,   decimals: 0, suffix: "+", label: "Scenario Templates", sub: "Stress-tested & regulatory" },
  { icon: "bi-shield-check",   to: 99.9, decimals: 1, suffix: "%", label: "Platform Uptime",    sub: "SLA-backed reliability" },
];

function Stats() {
  return (
    <section className="py-12 pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {STATS.map((s, i) => (
            <FadeIn key={s.label} delay={i * 0.07}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="group flex h-full flex-col items-center rounded-2xl border border-white/60 bg-white/70 p-7 text-center shadow-sm backdrop-blur-md transition-shadow duration-300 hover:border-[#002147]/18 hover:shadow-lg hover:shadow-[#002147]/10"
              >
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-[#002147]/8 transition-colors duration-300 group-hover:bg-[#002147]">
                  <i
                    className={cn(
                      "group-hover:icon-pop bi text-xl text-[#002147] transition-colors duration-300 group-hover:text-white",
                      s.icon
                    )}
                  />
                </div>
                <p className="text-2xl font-black tracking-tight text-gray-950 tabular-nums">
                  <CountUp to={s.to} duration={1500 + i * 150} decimals={s.decimals} suffix={s.suffix} />
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-700">{s.label}</p>
                <p className="mt-1 text-xs text-gray-400">{s.sub}</p>
              </motion.div>
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
  contentClassName,
  delay = 0,
  children,
}: {
  /** Outer-card classes: grid placement (col-span / row-span), padding override, etc. */
  className?: string;
  /** Inner-content layout: flex / grid / items-* / gap-* / justify-* etc.
   *  Must go on the inner wrapper because the hover-glow overlay forces a
   *  single inner block child — flex set on the outer card never reaches
   *  the actual content. */
  contentClassName?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10 p-6",
        "bg-gradient-to-br from-white/[0.07] to-white/[0.02]",
        "transition-all duration-300 hover:border-white/25 hover:from-white/[0.11]",
        "hover:shadow-2xl hover:shadow-blue-500/10",
        className
      )}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
    >
      {/* soft hover glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(420px circle at 30% 0%, rgba(91,143,216,0.10), transparent 60%)",
        }}
      />
      {/* h-full so flex/grid layouts on the inner can vertically distribute
          inside the card's fixed-height grid cell. */}
      <div className={cn("relative h-full", contentClassName)}>{children}</div>
    </motion.div>
  );
}

/* Typewriter cell for the Excel Add-In bento: types out the formula,
 * pauses, deletes, and loops. Pauses at the full string for a beat so
 * the reader can actually read it. */
function ExcelTypewriter({ text }: { text: string }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text);
      return;
    }
    let i = 0;
    let phase: "type" | "hold" | "delete" | "rest" = "type";
    let holdCount = 0;
    const tick = () => {
      if (phase === "type") {
        if (i < text.length) {
          i++;
          setShown(text.slice(0, i));
        } else {
          phase = "hold";
          holdCount = 0;
        }
      } else if (phase === "hold") {
        holdCount++;
        if (holdCount > 28) phase = "delete";
      } else if (phase === "delete") {
        if (i > 0) {
          i--;
          setShown(text.slice(0, i));
        } else {
          phase = "rest";
          holdCount = 0;
        }
      } else if (phase === "rest") {
        holdCount++;
        if (holdCount > 8) phase = "type";
      }
    };
    const id = setInterval(tick, 65);
    return () => clearInterval(id);
  }, [text]);
  return (
    <span>
      {shown}
      <span className="ml-0.5 inline-block w-[2px] animate-pulse bg-blue-300 align-middle" style={{ height: "0.85em" }} />
    </span>
  );
}

/* Count-up animator. Uses framer-motion's useInView (matches the rest of
 * the page's reveal triggers) plus a mount-time fallback so the numbers
 * always end up at their target value even on browsers that throttle
 * background-tab IO callbacks. */
function CountUp({
  to,
  duration = 1400,
  decimals = 2,
  prefix = "",
  suffix = "",
}: {
  to: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!inView || startedRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      startedRef.current = true;
      return;
    }
    startedRef.current = true;
    let raf = 0;
    let startTs = 0;
    const tick = (ts: number) => {
      if (!startTs) startTs = ts;
      const t = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(to * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

function PortfolioSparkline() {
  // Each bar oscillates between its base height and +/- range, with a
  // staggered delay so the whole sparkline reads as a live-data wave.
  const bars = [42, 58, 71, 55, 89, 62, 78, 93, 67, 85, 74, 96];
  return (
    <div className="mt-4 flex shrink-0 items-end gap-1" style={{ height: 80, minHeight: 80 }}>
      {bars.map((h, i) => {
        const hi = Math.min(h + 14, 100);
        const lo = Math.max(h - 22, 18);
        return (
          <motion.div
            key={i}
            className="flex-1 rounded-t"
            initial={{ height: `${h}%` }}
            animate={{ height: [`${h}%`, `${hi}%`, `${lo}%`, `${h}%`] }}
            transition={{
              duration: 3.4 + (i % 5) * 0.35,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.13,
            }}
            style={{ background: `rgba(91,143,216,${0.4 + (h / 100) * 0.5})` }}
          />
        );
      })}
    </div>
  );
}

/* ─── ADAPTABILITY — “Built for every side of the industry” ─────────────────── */
const ADAPT_SIDES = [
  { icon: "bi-buildings", label: "Lessor", desc: "Portfolio analytics, ECL, re-lease pipelines." },
  { icon: "bi-bank", label: "Financing", desc: "Debt structuring, covenant monitoring, LTV." },
  { icon: "bi-briefcase", label: "Advisory", desc: "Comparable benchmarks, scenario decks." },
  { icon: "bi-airplane-engines", label: "Technical", desc: "Maintenance forecasting, fleet condition." },
  { icon: "bi-arrow-left-right", label: "Trading", desc: "Deal feed, comparable transactions, valuations." },
];
const ADAPT_FIRMS: { name: string; src: string; h: number }[] = [
  { name: "Aerfin",         src: "/logos/aerfin.webp",         h: 48 },
  { name: "ELFC",           src: "/logos/elfc.png",            h: 28 },
  { name: "Grant Thornton", src: "/logos/grant-thornton.webp", h: 34 },
];

function Adaptability() {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div
          className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 p-8 shadow-lg shadow-[#002147]/10 backdrop-blur-md sm:p-12"
        >
          <FadeIn className="flex flex-col items-center text-center">
            <SectionPill>Adaptable by Design</SectionPill>
            <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-gray-950 sm:text-4xl leading-[1.1]">
              Built from scratch. Configurable for{" "}
              <span className="text-[#002147]">every seat at the table.</span>
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600">
              AeroInsights wasn&apos;t bolted onto a legacy system. Because every module is
              purpose-built, the platform can be adapted and configured around the specific
              workflow of any team, whether on the lessor, financing, advisory, technical, or
              trading side of the industry.
            </p>
          </FadeIn>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {ADAPT_SIDES.map((s, i) => (
              <FadeIn key={s.label} delay={i * 0.06}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 280, damping: 22 }}
                  className="group flex h-full flex-col items-center rounded-2xl border border-[#002147]/8 bg-white/80 p-5 text-center shadow-sm backdrop-blur-md transition-colors duration-300 hover:border-[#002147]/22"
                >
                  <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#002147]/8 transition-colors duration-300 group-hover:bg-[#002147]">
                    <i
                      className={cn(
                        "group-hover:icon-pop bi text-lg text-[#002147] transition-colors duration-300 group-hover:text-white",
                        s.icon
                      )}
                    />
                  </div>
                  <p className="text-sm font-bold text-gray-950">{s.label}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{s.desc}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.2} className="mt-12 flex flex-col items-center gap-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Refined with feedback from
            </p>
            {/* Logos in place of names — same greyscale-on-default / colour-on-hover
                treatment as the partner marquee so the visual language is consistent. */}
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
              {ADAPT_FIRMS.map((f) => (
                <img
                  key={f.name}
                  src={f.src}
                  alt={f.name}
                  loading="lazy"
                  draggable={false}
                  style={{ height: f.h }}
                  className="select-none object-contain opacity-75 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0"
                />
              ))}
            </div>
            <p className="mt-1 max-w-xl text-xs text-gray-500">
              Aerfin, ELFC, and Grant Thornton&apos;s aviation team helped refine several of the
              assumptions and risk frameworks within the platform.
            </p>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function SolutionBento() {
  return (
    <section id="solution" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div
          className="relative overflow-hidden rounded-[2rem] p-8 shadow-2xl shadow-[#001228]/25 sm:p-12"
          style={{
            background:
              "linear-gradient(165deg, #0a1a33 0%, #0e2347 60%, #0a1a33 100%)",
          }}
        >
          {/* Top atmospheric glow inside the card */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
            style={{
              width: 1100,
              height: 320,
              background:
                "radial-gradient(ellipse at top, rgba(91,143,216,0.30), rgba(91,143,216,0.06) 45%, transparent 75%)",
            }}
          />
          <div className="relative">
            <SectionHeader
              pill="The Solution"
              heading={<>One platform for every lessor workflow</>}
              sub="From portfolio onboarding to AI-driven deal origination, AeroInsights is the operating system for modern aircraft lessors."
              dark
            />

        <div
          className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3"
          style={{ gridAutoRows: "190px" }}
        >
          {/* Large card — portfolio analytics */}
          <BentoCard
            className="md:col-span-2 md:row-span-2 p-7"
            contentClassName="flex flex-col justify-between"
            delay={0}
          >
            <div>
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-[#002147]">
                <i className="bi bi-bar-chart-fill text-lg text-white" />
              </div>
              <p className="text-lg font-black text-white">Portfolio Analytics</p>
              <p className="mt-1.5 text-sm text-blue-200/65 leading-relaxed">
                Real-time lease register, LTV monitoring, concentration risk, and fleet-level performance, all in one live dashboard.
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
          <BentoCard delay={0.08} contentClassName="flex flex-col gap-3">
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
          <BentoCard delay={0.14} contentClassName="flex flex-col gap-3">
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
          <BentoCard delay={0.2} contentClassName="flex flex-col gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#002147]">
              <i className="bi bi-file-earmark-spreadsheet text-base text-white" />
            </div>
            <p className="font-bold text-white">Excel Add-In</p>
            <p className="text-xs text-blue-200/60 leading-relaxed">
              Pull live portfolio data directly into Excel. No API wrangling required.
            </p>
            <div className="mt-auto rounded-lg border border-white/8 bg-[#001228] px-3 py-2 font-mono text-[10px] text-blue-300">
              <ExcelTypewriter text={'=AI.Portfolio("fleet_size")'} />
            </div>
          </BentoCard>

          {/* Scenario engine — wide, two-column inside */}
          <BentoCard
            delay={0.26}
            className="md:col-span-2"
            contentClassName="flex items-center gap-6"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="mb-3 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#002147]">
                <i className="bi bi-sliders text-base text-white" />
              </div>
              <p className="font-bold text-white">Scenario Engine</p>
              <p className="mt-1.5 text-xs leading-relaxed text-blue-200/60">
                Model base, stress, and upside scenarios across your full portfolio in one click. IFRS 9 aligned, regulatory-ready.
              </p>
            </div>
            <div className="hidden shrink-0 flex-col gap-1.5 sm:flex">
              {[
                { label: "Base", num: 2.41, color: "text-emerald-400" },
                { label: "Stress", num: 1.87, color: "text-amber-400" },
                { label: "Upside", num: 2.74, color: "text-blue-400" },
              ].map((sc, i) => (
                <div key={sc.label} className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/5 px-3 py-1.5">
                  <span className="w-10 text-[10px] text-white/45">{sc.label}</span>
                  <span className={cn("text-xs font-bold tabular-nums", sc.color)}>
                    <CountUp to={sc.num} duration={1400 + i * 200} prefix="$" suffix="B" decimals={2} />
                  </span>
                </div>
              ))}
            </div>
          </BentoCard>
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── PLATFORM FEATURES ─────────────────────────────────────────────────────── */
function PortfolioMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-xl shadow-[#002147]/10 backdrop-blur-md">
      <div className="border-b border-gray-100 bg-[#002147]/4 px-5 py-3 text-xs font-semibold text-[#002147]/70">
        Portfolio Overview · Q2 2025
      </div>
      <div className="p-5 space-y-4">
        {[
          { label: "Narrowbody", pct: 62, val: "$1.49B", color: "#002147" },
          { label: "Widebody", pct: 28, val: "$675M", color: "#334e74" },
          { label: "Regional", pct: 10, val: "$240M", color: "#6b8cbb" },
        ].map((r, i) => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-gray-700">{r.label}</span>
              <span className="text-gray-400">{r.val}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <motion.div
                className="h-2 rounded-full"
                initial={{ width: "0%" }}
                whileInView={{ width: `${r.pct}%` }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 + i * 0.18 }}
                style={{ background: r.color }}
              />
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
    <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-xl shadow-[#002147]/10 backdrop-blur-md">
      <div className="border-b border-gray-100 bg-[#002147]/4 px-5 py-3 text-xs font-semibold text-[#002147]/70">
        AI Intelligence · Lessee Radar
      </div>
      <div className="divide-y divide-gray-100">
        {[
          { name: "AtlanticJet", flag: "🇮🇪", signal: "Covenant breach risk", score: "High", color: "bg-rose-100 text-rose-700" },
          { name: "SkyWave Air", flag: "🇸🇬", signal: "Traffic recovery +18% MoM", score: "Low", color: "bg-emerald-100 text-emerald-700" },
          { name: "Pacific Wings", flag: "🇯🇵", signal: "Fleet expansion · new RFP", score: "Medium", color: "bg-amber-100 text-amber-700" },
          { name: "NordicFly", flag: "🇸🇪", signal: "CAPA restructuring alert", score: "High", color: "bg-rose-100 text-rose-700" },
        ].map((l, i) => (
          <div key={l.name} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">{l.flag}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{l.name}</p>
                <p className="text-[10px] text-gray-400">{l.signal}</p>
              </div>
            </div>
            <motion.span
              className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", l.color)}
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: [0, 1.18, 0.94, 1], opacity: [0, 1, 1, 1] }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.55,
                times: [0, 0.55, 0.8, 1],
                ease: "easeOut",
                delay: 0.25 + i * 0.22,
              }}
            >
              {l.score}
            </motion.span>
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
    sub: "Live lease register, LTV analytics, maturity profiles, and concentration risk heatmaps, all in one place. No more spreadsheets.",
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
    <section id="platform" className="py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          pill="Platform Features"
          heading={<>Everything you need to manage aircraft assets</>}
          sub="From day-one portfolio setup to sophisticated AI-driven origination, AeroInsights covers the full workflow."
        />

        <div className="mt-24 flex flex-col gap-28">
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
                <SectionPill className="self-start">{feat.pill}</SectionPill>
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
                    href="mailto:sethit@tcd.ie?subject=AeroInsights%20%C2%B7%20Platform%20enquiry"
                    className="flex items-center gap-1.5 rounded-xl border border-[#002147]/20 px-5 py-2.5 text-sm font-semibold text-[#002147] transition-colors hover:bg-[#002147]/5"
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
    <section id="features" className="py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          pill="Full Feature Set"
          heading={<>Built for modern aviation finance workflows</>}
          sub="Every module follows aviation finance best practices with real-time data, regulatory alignment, and seamless team collaboration."
        />
        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {EXTRA_FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.06}>
              <motion.div
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-white/60 bg-white/75 p-7 shadow-sm backdrop-blur-md transition-shadow duration-300 hover:border-[#002147]/20 hover:shadow-xl hover:shadow-[#002147]/10"
              >
                {/* gentle hover corner glow */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-[#002147]/0 transition-all duration-500 group-hover:bg-[#002147]/4"
                />
                <div className="relative flex size-11 items-center justify-center rounded-xl bg-[#002147]/8 transition-colors duration-300 group-hover:bg-[#002147]">
                  <i
                    className={cn(
                      "group-hover:icon-pop bi text-lg text-[#002147] transition-colors duration-300 group-hover:text-white",
                      f.icon
                    )}
                  />
                </div>
                <p className="relative font-bold text-gray-950">{f.title}</p>
                <p className="relative text-sm leading-relaxed text-gray-500">{f.desc}</p>
              </motion.div>
            </FadeIn>
          ))}
        </div>
        <FadeIn className="mt-12 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-gray-500">
            <Link
              to="/login"
              className="flex items-center gap-1 font-semibold text-[#002147] underline-offset-2 hover:underline"
            >
              View Documentation <i className="bi bi-arrow-right text-xs" />
            </Link>
            <span>·</span>
            <a
              href="mailto:sethit@tcd.ie?subject=AeroInsights%20%C2%B7%20Talk%20to%20our%20team"
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

/* All three tiers now quote-on-request — every `monthlyPrice` is null so the
 * existing render path resolves to "Custom" for each card. The monthly/annual
 * toggle is hidden below when no plan exposes a numeric price (it would be a
 * no-op). */
const PLANS = [
  {
    name: "Starter",
    desc: "For smaller portfolios and analyst teams getting started.",
    monthlyPrice: null,
    features: ["Up to 25 aircraft", "Portfolio analytics & lease register", "Basic scenario modelling", "PDF & XLSX reporting", "Email support"],
    cta: "Talk to Sales",
    highlight: false,
  },
  {
    name: "Professional",
    desc: "For established lessors managing mid-size fleets.",
    monthlyPrice: null,
    features: ["Up to 150 aircraft", "Full scenario & ECL engine", "AI Intelligence module", "Deal Generator & rack-stack", "Excel Add-In access", "Priority support"],
    cta: "Talk to Sales",
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
  // Toggle only matters if at least one plan exposes a numeric price.
  // While every tier is "Custom" the monthly/annual control is a no-op,
  // so we hide it (and the Save 20% chip) to avoid dead UI.
  const showBillingToggle = PLANS.some((p) => p.monthlyPrice !== null);

  return (
    <section id="pricing" className="py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          pill="Pricing Plans"
          heading="Choose your plan"
          sub="Start with a free pilot, scale as you grow. All plans include our core portfolio analytics."
        />

        {showBillingToggle && (
          <FadeIn delay={0.1} className="mt-10 flex justify-center">
            {/*
              Layout strategy:
                outer:  flex justify-center                 — anchors pill to viewport centre
                pill:   relative (so layoutId can absolute) — stays fixed-width, never shifts
                chip:   absolute, sits to the right of pill — does NOT push the pill off-centre
              Save 20% is ALWAYS rendered; only its colours change.
            */}
            <div className="relative">
              <div className="flex rounded-full border border-gray-200 bg-gray-50 p-1">
                {(["monthly", "annually"] as BillingCycle[]).map((c) => {
                  const active = billing === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setBilling(c)}
                      className="relative z-10 rounded-full px-5 py-1.5 text-sm font-medium transition-colors duration-200"
                      style={{ color: active ? "#0a0a0a" : undefined }}
                    >
                      {active && (
                        <motion.span
                          layoutId="billing-pill-indicator"
                          className="absolute inset-0 -z-10 rounded-full bg-white shadow-sm"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      )}
                      <span className={cn(!active && "text-gray-500 hover:text-gray-700 transition-colors")}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <span
                className={cn(
                  "absolute left-[calc(100%+12px)] top-1/2 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
                  "transition-all duration-300",
                  billing === "annually"
                    ? "scale-100 bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300/60 shadow-sm shadow-emerald-200/60"
                    : "scale-95 bg-emerald-50/60 text-emerald-700/45 ring-1 ring-emerald-100/40"
                )}
              >
                <i className="bi bi-piggy-bank text-[10px]" />
                Save 20%
              </span>
            </div>
          </FadeIn>
        )}

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {PLANS.map((plan, i) => {
            const price =
              plan.monthlyPrice === null
                ? null
                : billing === "annually"
                ? Math.round(plan.monthlyPrice * 0.8)
                : plan.monthlyPrice;
            const isContact = plan.cta === "Contact Us";
            return (
              <FadeIn key={plan.name} delay={i * 0.08}>
                <motion.div
                  whileHover={{ y: plan.highlight ? -6 : -4 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  className={cn(
                    "flex h-full flex-col rounded-2xl border p-7 shadow-sm transition-shadow duration-300",
                    plan.highlight
                      ? "border-[#002147] bg-[#002147] text-white shadow-lg shadow-[#002147]/20 hover:shadow-2xl hover:shadow-[#002147]/30"
                      : "border-white/60 bg-white/80 backdrop-blur-md hover:border-[#002147]/25 hover:shadow-lg hover:shadow-[#002147]/10"
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
                  {isContact ? (
                    <a
                      href="mailto:sethit@tcd.ie?subject=AeroInsights%20Enterprise%20%C2%B7%20Contact"
                      className={cn(
                        "mt-8 block w-full rounded-xl py-2.5 text-center text-sm font-semibold transition",
                        "border border-[#002147]/20 bg-white text-[#002147] hover:bg-[#002147] hover:text-white"
                      )}
                    >
                      {plan.cta}
                    </a>
                  ) : (
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
                  )}
                </motion.div>
              </FadeIn>
            );
          })}
        </div>

        <FadeIn className="mt-8 text-center text-sm text-gray-500">
          Need a custom pilot or have questions?{" "}
          <a
            href="mailto:sethit@tcd.ie?subject=AeroInsights%20%C2%B7%20Custom%20pilot%20enquiry"
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
/*
 * Demo findings — themes that surfaced across review sessions with leadership
 * at the firms listed in the partner marquee above. No fabricated attributions:
 * these are aggregated patterns, not invented quotes from invented people.
 */
const DEMO_FINDINGS: { icon: string; title: string; body: string; tag: string }[] = [
  {
    icon: "bi-file-earmark-spreadsheet",
    title: "Everyone still lives in spreadsheets — and knows it.",
    body: "Across firms of every size, the portfolio still gets stitched together in Excel each quarter. The instinct to consolidate it into one live platform landed in every room.",
    tag: "Universal pain",
  },
  {
    icon: "bi-shield-check",
    title: "IFRS 9 ECL is a shared headache.",
    body: "Staging migration, PD/LGD curves, waterfall reconciliation. The audit-trail burden came up in every session, and the built-in auditable workflow consistently drew the strongest reaction.",
    tag: "Strongest reaction",
  },
  {
    icon: "bi-stars",
    title: "AI counterparty intelligence was the standout moment.",
    body: "Lessee Radar drew the most 'how are you doing this?' questions. Catching covenant and recovery signals weeks ahead of public filings was what people kept circling back to.",
    tag: "Standout",
  },
  {
    icon: "bi-table",
    title: "The Excel add-in clicked instantly with analysts.",
    body: "Same moment in every demo: live portfolio data flowed into a cell, and the room visibly leaned in. Analysts get what they need without ever leaving Excel.",
    tag: "Instant fit",
  },
  {
    icon: "bi-sliders",
    title: "Scenario modelling is rarely joined-up end-to-end.",
    body: "Most teams run base, stress, and upside in disconnected workbooks. One click that pushes them through the live portfolio drew a clear 'we should already be doing this'.",
    tag: "Workflow gap",
  },
  {
    icon: "bi-puzzle",
    title: "Configurability beat features in importance.",
    body: "Every firm operates a little differently. The recurring ask wasn't 'add this feature', it was 'make this configurable to our workflow'. That shaped how the platform was architected.",
    tag: "Design north-star",
  },
];

function Testimonials() {
  return (
    <section className="py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          pill="From the Demos"
          heading="What kept coming up in every conversation"
          sub="Across deep walkthroughs with leadership at the firms in the rail above, the same threads consistently surfaced — pain points the platform was built directly against, and capabilities that drew the strongest reactions."
        />
        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_FINDINGS.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.07}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="group relative flex h-full flex-col gap-4 rounded-2xl border border-white/60 bg-white/75 p-7 shadow-sm backdrop-blur-md transition-shadow duration-300 hover:border-[#002147]/20 hover:shadow-xl hover:shadow-[#002147]/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#002147]/8 transition-colors duration-300 group-hover:bg-[#002147]">
                    <i
                      className={cn(
                        "group-hover:icon-pop bi text-lg text-[#002147] transition-colors duration-300 group-hover:text-white",
                        f.icon
                      )}
                    />
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200/70">
                    {f.tag}
                  </span>
                </div>
                <p className="text-base font-bold leading-snug text-gray-950">{f.title}</p>
                <p className="text-sm leading-relaxed text-gray-600">{f.body}</p>
              </motion.div>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={0.15} className="mt-10 text-center">
          <p className="mx-auto max-w-2xl text-xs text-gray-500">
            Each engagement was a 30–60 minute walkthrough with leadership. Findings above are
            aggregated patterns across those sessions — no live customer attribution implied.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── FAQ ───────────────────────────────────────────────────────────────────── */
const FAQS = [
  {
    q: "What types of aircraft lessors does AeroInsights serve?",
    a: "AeroInsights is designed for commercial aircraft lessors of all sizes, from specialist boutique lessors to the world's largest lessor groups. We support narrowbody, widebody, and regional fleets.",
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
    <section className="py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeader
          pill="FAQ"
          heading="Common questions"
          sub="Everything you need to know about AeroInsights. Can't find the answer? Contact our team."
        />

        <div className="mt-12 flex flex-col divide-y divide-gray-100 overflow-hidden rounded-2xl border border-white/60 bg-white/75 shadow-sm backdrop-blur-md">
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

        <FadeIn delay={0.1} className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Still have questions?{" "}
            <a
              href="mailto:sethit@tcd.ie?subject=AeroInsights%20%C2%B7%20FAQ%20follow-up"
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
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div
          className="group relative overflow-hidden rounded-[2rem] px-6 py-20 shadow-2xl shadow-[#001228]/25 sm:px-12 sm:py-24"
          style={{
            background:
              "linear-gradient(150deg, #0a1a33 0%, #143268 55%, #0a1a33 100%)",
          }}
        >
          {/* Top atmospheric glow inside the card */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
            style={{
              width: 1100,
              height: 300,
              background:
                "radial-gradient(ellipse at top, rgba(91,143,216,0.32), rgba(91,143,216,0.05) 45%, transparent 75%)",
            }}
          />
          {/* Background airplane silhouette — sits behind content, slides
              forward to the right on hover (group:hover on parent box). */}
          <i
            aria-hidden
            className={cn(
              "bi bi-airplane-fill",
              "pointer-events-none absolute -right-16 top-1/2 -translate-y-1/2 select-none",
              "text-[480px] leading-none text-white/[0.06]",
              // Default slight tilt so it reads as "in flight" not "parked"
              "rotate-[-12deg]",
              // Hover: drift right + tilt a touch more, soft easing for glide
              "transition-all duration-[1200ms] ease-out",
              "group-hover:translate-x-24 group-hover:rotate-[-6deg] group-hover:text-white/[0.10]"
            )}
            style={{ filter: "drop-shadow(0 0 60px rgba(91,143,216,0.35))" }}
          />
          <FadeIn className="relative flex flex-col items-center gap-6 text-center">
          <span className="pill-shimmer inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100/85">
            <i className="bi bi-stars text-xs text-amber-300" />
            Purpose-built for aviation lessors
          </span>
          <h2 className="max-w-2xl text-4xl font-black tracking-tight text-white sm:text-5xl leading-[1.08]">
            Ready to transform your aviation finance operation?
          </h2>
          <p className="max-w-lg text-blue-200/65 leading-relaxed">
            Join the aviation finance teams already using AeroInsights to manage portfolios, model
            risk, and close deals faster.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={DEMO_LINK} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-white px-7 py-3 text-sm font-semibold text-[#002147] shadow-lg shadow-black/25 transition-colors hover:bg-blue-50"
            >
              <i className="bi bi-calendar-event text-sm" />
              Book a Demo
              <i className="bi bi-arrow-right text-xs" />
            </a>
            <a
              href="mailto:sethit@tcd.ie?subject=AeroInsights%20%C2%B7%20Demo%20request"
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/8 px-7 py-3 text-sm font-semibold text-white/85 transition-colors hover:bg-white/14"
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
      </div>
    </section>
  );
}

/* ─── CONTACT ───────────────────────────────────────────────────────────────── */
const CONTACT_EMAIL = "sethit@tcd.ie";

function Contact() {
  const [form, setForm] = useState({ name: "", firm: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(
      `AeroInsights%20%C2%B7%20Enquiry from ${form.name || "the website"}${form.firm ? ` (${form.firm})` : ""}`
    );
    const body = encodeURIComponent(
      `Hi,\n\n${form.message}\n\n--\n${form.name}${form.firm ? `\n${form.firm}` : ""}`
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  };

  const cards = [
    {
      icon: "bi-calendar-check",
      title: "Book a Demo",
      desc: "Schedule a 30-minute walkthrough at the same address.",
      action: "Request a slot",
      href: `mailto:${CONTACT_EMAIL}?subject=AeroInsights%20%C2%B7%20Book%20a%20demo&body=Hi%2C%20I%27d%20like%20to%20schedule%20a%2030-minute%20walkthrough.`,
    },
    {
      icon: "bi-chat-square-text",
      title: "Partnerships",
      desc: "Discussing integration, distribution, or co-build.",
      action: "Start a conversation",
      href: `mailto:${CONTACT_EMAIL}?subject=AeroInsights%20%C2%B7%20Partnership`,
    },
  ];

  return (
    <section id="contact" className="py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          pill="Get In Touch"
          heading="Need help or want a demo?"
          sub="Drop a line. Every enquiry goes straight to my inbox and gets a personal reply."
        />

        {/* Builder card — puts a face to the inbox you are about to message.
            Sits above the cards / form grid as a single full-width band so
            the personal context is the first thing the user sees in the
            Contact section. */}
        <FadeIn className="mt-12">
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-white/60 bg-white/80 p-6 shadow-sm backdrop-blur-md sm:flex-row sm:items-stretch sm:gap-7 sm:p-7">
            <div className="relative shrink-0">
              <div
                aria-hidden
                className="absolute -inset-2 rounded-full bg-[radial-gradient(closest-side,rgba(0,33,71,0.18),transparent_70%)] blur-md"
              />
              <div className="relative size-32 overflow-hidden rounded-full ring-4 ring-white shadow-lg shadow-[#002147]/20 sm:size-44">
                <img
                  src="/tanam.png"
                  alt="Tanam Sethi"
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <div className="flex flex-1 flex-col justify-center text-center sm:text-left">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-baseline sm:gap-3">
                <p className="text-xl font-black tracking-tight text-gray-950 sm:text-2xl">
                  Tanam Sethi
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#002147]/15 bg-[#002147]/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#002147]">
                  <i className="bi bi-tools text-[10px]" />
                  Founder &amp; Builder
                </span>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-600">
                I built AeroInsights single-handedly from scratch and operate the platform
                day to day. Every enquiry comes straight to me, and I&apos;m happy to walk
                through methodology, pricing, or how AeroInsights would fit your workflow.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <a
                  href="https://cal.com/tanam-sethi/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#002147] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#001a38]"
                >
                  <i className="bi bi-calendar-event text-[11px]" />
                  Book a 30-min call
                </a>
                <a
                  href="https://www.linkedin.com/in/tanamsethi/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#002147]/15 bg-white px-3.5 py-2 text-xs font-semibold text-[#002147] transition hover:bg-[#002147]/5"
                >
                  <i className="bi bi-linkedin text-[11px]" />
                  LinkedIn
                </a>
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=AeroInsights%20%C2%B7%20Hello`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#002147]/15 bg-white px-3.5 py-2 text-xs font-semibold text-[#002147] transition hover:bg-[#002147]/5"
                >
                  <i className="bi bi-envelope text-[11px]" />
                  {CONTACT_EMAIL}
                </a>
                <Link
                  to="/about"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-[#002147]/70 transition hover:text-[#002147]"
                >
                  About the builder
                  <i className="bi bi-arrow-right text-[10px]" />
                </Link>
              </div>
            </div>
          </div>
        </FadeIn>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <div className="flex flex-col gap-4">
            {cards.map((card, i) => (
              <FadeIn key={card.title} delay={i * 0.05}>
                <motion.a
                  href={card.href}
                  whileHover={{ y: -3 }}
                  transition={{ type: "spring", stiffness: 280, damping: 22 }}
                  className="group flex flex-col gap-2.5 rounded-2xl border border-white/60 bg-white/75 p-5 shadow-sm backdrop-blur-md transition-shadow duration-300 hover:border-[#002147]/22 hover:shadow-lg hover:shadow-[#002147]/10"
                >
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[#002147]/8 transition-colors duration-300 group-hover:bg-[#002147]">
                    <i
                      className={cn(
                        "group-hover:icon-pop bi text-lg text-[#002147] transition-colors duration-300 group-hover:text-white",
                        card.icon
                      )}
                    />
                  </div>
                  <p className="font-semibold text-gray-950">{card.title}</p>
                  <p className="text-sm leading-relaxed text-gray-500">{card.desc}</p>
                  <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#002147]">
                    {card.action}
                    <i className="bi bi-arrow-right text-xs transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </motion.a>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.1} className="sm:col-span-2">
            <div className="rounded-2xl border border-white/60 bg-white/80 p-8 shadow-sm backdrop-blur-md">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <i className="bi bi-envelope-paper" />
                    Send a message
                  </p>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-xs font-medium text-gray-400 hover:text-[#002147]"
                  >
                    or email {CONTACT_EMAIL} ↗
                  </a>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600">Your name</label>
                    <input
                      required
                      type="text"
                      placeholder="Jane Smith"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-950 placeholder-gray-400 transition focus:border-[#002147]/40 focus:outline-none focus:ring-2 focus:ring-[#002147]/15"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600">Firm / Organisation</label>
                    <input
                      type="text"
                      placeholder="AerCap Holdings"
                      value={form.firm}
                      onChange={(e) => setForm({ ...form, firm: e.target.value })}
                      className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-950 placeholder-gray-400 transition focus:border-[#002147]/40 focus:outline-none focus:ring-2 focus:ring-[#002147]/15"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Message</label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Tell us about your portfolio and what you're looking to solve..."
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-950 placeholder-gray-400 transition focus:border-[#002147]/40 focus:outline-none focus:ring-2 focus:ring-[#002147]/15"
                  />
                </div>
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#002147] py-3 text-sm font-semibold text-white shadow-lg shadow-[#002147]/15 transition hover:bg-[#001a38]"
                >
                  Open in mail
                  <i className="bi bi-send text-xs" />
                </motion.button>
                <p className="text-center text-xs text-gray-400">
                  Submitting opens your mail client with this message pre-filled.
                </p>
              </form>
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
    <section className="py-16">
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
type FooterLink = string | { label: string; href: string };
const FOOTER_COLS: { heading: string; links: FooterLink[] }[] = [
  { heading: "Platform", links: ["Portfolio Analytics", "Scenario Engine", "Risk & ECL", "Deal Generator", "Intelligence", "Excel Add-In"] },
  {
    heading: "Company",
    links: [
      { label: "About the builder", href: "/about" },
      { label: "Blog",              href: "/blog" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Help Centre",   href: "/help" },
      { label: "API Reference", href: "/api" },
      { label: "Status Page",   href: "/status" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy",   href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Security",         href: "/security" },
      { label: "Cookie Policy",    href: "/cookies" },
    ],
  },
];

function Footer() {
  return (
    /*
     * Footer is now a part OF the page, not a separate decorative block.
     * No background of its own — sits transparent on top of AmbientBackground
     * like every other section. The only visual separator is a thin top hr.
     * All text uses the same dark palette as the rest of the body.
     */
    <footer className="relative pt-16 pb-10">
      {/* Hairline divider — sits flush with ambient bg, doesn't break it */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px max-w-7xl"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(0,33,71,0.18) 35%, rgba(0,33,71,0.18) 65%, transparent 100%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
          {/* Brand */}
          <div className="flex flex-col gap-4 lg:max-w-xs">
            <Link to="/home" className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#002147] p-1.5">
                <img src="/logo.png" alt="AeroInsights" className="h-full w-full object-contain" />
              </div>
              <span className="text-[1.05rem] font-extrabold tracking-tight text-gray-950">
                AeroInsights
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-700">
              The decision intelligence platform for aircraft lessors. Portfolio analytics,
              scenario modelling, risk &amp; ECL, and AI-powered deal intelligence, all in one place.
            </p>
            <div className="flex gap-2">
              {[
                { icon: "bi-linkedin",       label: "LinkedIn",    href: "https://www.linkedin.com/in/tanamsethi/" },
                { icon: "bi-github",         label: "GitHub",      href: "https://github.com/tanamsethi31/" },
                { icon: "bi-envelope",       label: "Email",       href: CONTACT_MAILTO },
                { icon: "bi-calendar-event", label: "Book a call", href: DEMO_LINK },
              ].map((s) => (
                <a
                  key={s.icon}
                  href={s.href}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  aria-label={s.label}
                  className="flex size-9 items-center justify-center rounded-lg border border-[#002147]/18 bg-white/75 text-gray-700 backdrop-blur-sm transition hover:border-[#002147]/35 hover:bg-white hover:text-[#002147]"
                >
                  <i className={cn("bi text-sm", s.icon)} />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="grid flex-1 grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_COLS.map((col) => (
              <div key={col.heading} className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">
                  {col.heading}
                </p>
                {col.links.map((link) => {
                  const label = typeof link === "string" ? link : link.label;
                  const href = typeof link === "string" ? "#" : link.href;
                  const isInternal = typeof link !== "string" && link.href.startsWith("/");
                  return isInternal ? (
                    <Link
                      key={label}
                      to={href}
                      className="text-sm font-medium text-gray-700 transition hover:text-[#002147]"
                    >
                      {label}
                    </Link>
                  ) : (
                    <a
                      key={label}
                      href={href}
                      className="text-sm font-medium text-gray-700 transition hover:text-[#002147]"
                    >
                      {label}
                    </a>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[#002147]/15 pt-6 sm:flex-row">
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} AeroInsights Ltd. All rights reserved.
          </p>
          <p className="text-xs text-gray-600">
            Built for aviation finance professionals worldwide.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── PAGE ──────────────────────────────────────────────────────────────────── */
export default function Landing() {
  // Restore scroll position when the user comes back to /home (e.g. from a
  // footer link or About). Mounts at top on first ever visit; thereafter
  // snaps back to wherever they left off in the same session.
  useScrollRestore("/home");
  return (
    <div className="relative min-h-screen font-sans text-gray-950 antialiased">
      {/* One continuous animated colour-blob layer behind everything */}
      <AmbientBackground />

      <Navbar />
      <main className="relative">
        <Hero />
        <LogoMarquee />
        <Stats />
        <Adaptability />
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
