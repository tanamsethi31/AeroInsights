import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { motion, useInView } from "framer-motion";

/* ─── helpers ──────────────────────────────────────────────────────────────── */
function cn(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

function useScrolled(threshold = 10) {
  const [s, set] = useState(false);
  useEffect(() => {
    const h = () => set(window.scrollY > threshold);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, [threshold]);
  return s;
}

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
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ─── contact constants (mirror of Landing) ────────────────────────────────── */
const EMAIL = "sethit@tcd.ie";
const EMAIL_HREF = `mailto:${EMAIL}?subject=Hello%20Tanam`;
const LINKEDIN = "https://www.linkedin.com/in/tanam-sethi/";
const DEMO_LINK = "https://cal.com/tanam-sethi/30min";

/* ─── AMBIENT BLOB BACKGROUND ───────────────────────────────────────────────
 * Same atmospheric layer as the home page so /about feels part of the family.
 * ─────────────────────────────────────────────────────────────────────────── */
function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #fafcff 0%, #f4f7fd 38%, #f6f8fd 72%, #f0f4fb 100%)",
        }}
      />
      <div
        className="animate-blob-a absolute -left-32 top-[6%] h-[640px] w-[640px] rounded-full opacity-[0.55] mix-blend-multiply blur-[140px]"
        style={{ background: "radial-gradient(circle, #b7d0ff 0%, transparent 70%)" }}
      />
      <div
        className="animate-blob-b absolute -right-40 top-[28%] h-[720px] w-[720px] rounded-full opacity-[0.50] mix-blend-multiply blur-[150px]"
        style={{ background: "radial-gradient(circle, #d8caff 0%, transparent 70%)" }}
      />
      <div
        className="animate-blob-c absolute -left-32 top-[58%] h-[680px] w-[680px] rounded-full opacity-[0.55] mix-blend-multiply blur-[140px]"
        style={{ background: "radial-gradient(circle, #b8e3ff 0%, transparent 70%)" }}
      />
      <div
        className="animate-blob-a absolute -right-20 bottom-[4%] h-[560px] w-[560px] rounded-full opacity-[0.45] mix-blend-multiply blur-[130px]"
        style={{ background: "radial-gradient(circle, #c5d9ff 0%, transparent 70%)" }}
      />
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

/* ─── NAVBAR ───────────────────────────────────────────────────────────────── */
function Navbar() {
  const scrolled = useScrolled();
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-md"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/home" className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#002147] p-1.5">
            <img src="/logo.png" alt="AeroInsights" className="h-full w-full object-contain" />
          </div>
          <span className="text-[1.05rem] font-extrabold tracking-tight text-gray-950">
            AeroInsights
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            to="/home"
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-950"
          >
            Home
          </Link>
          <Link
            to="/about"
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-gray-950"
          >
            About
          </Link>
          <a
            href={EMAIL_HREF}
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-950"
          >
            Contact
          </a>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href={LINKEDIN}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:border-[#002147]/30 hover:text-[#002147]"
            aria-label="LinkedIn"
          >
            <i className="bi bi-linkedin text-sm" />
          </a>
          <a
            href={DEMO_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-[#002147] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-85"
          >
            Book a Demo
            <i className="bi bi-arrow-right text-xs" />
          </a>
        </div>
      </div>
    </header>
  );
}

/* ─── HERO ─────────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden pt-16">
      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-7 px-4 py-20 text-center sm:px-6 sm:py-28">
        <motion.span
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="inline-flex items-center gap-2 rounded-full border border-[#002147]/15 bg-[#002147]/5 px-3.5 py-1.5 text-sm font-medium text-[#002147]"
        >
          <i className="bi bi-person-circle text-xs" />
          The Builder
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          className="text-5xl font-black leading-[1.04] tracking-tight text-gray-950 sm:text-6xl lg:text-7xl"
          style={{ letterSpacing: "-0.035em" }}
        >
          Hi, I&apos;m <span className="text-[#002147]">Tanam Sethi.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16 }}
          className="max-w-2xl text-lg leading-relaxed text-gray-600"
        >
          I built AeroInsights single-handedly from scratch — a complete aviation finance
          intelligence platform purpose-built for the workflow lessors, financiers, and
          advisors actually use every day.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.24 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <a
            href={DEMO_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-[#002147] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#002147]/20 transition hover:bg-[#001a38]"
          >
            <i className="bi bi-calendar-event" />
            Book a 30-min call
          </a>
          <a
            href={LINKEDIN}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-[#002147]/18 bg-white/80 px-6 py-3 text-sm font-semibold text-[#002147] backdrop-blur-md transition hover:bg-[#002147]/5"
          >
            <i className="bi bi-linkedin" />
            Connect on LinkedIn
          </a>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── STORY ────────────────────────────────────────────────────────────────── */
function Story() {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <FadeIn>
          <div className="rounded-2xl border border-white/60 bg-white/75 p-8 shadow-sm backdrop-blur-md sm:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#002147]/60">
              Why I built this
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-gray-950 sm:text-4xl">
              Aviation finance deserved better than a stack of spreadsheets.
            </h2>
            <div className="mt-7 flex flex-col gap-5 text-[15px] leading-relaxed text-gray-600">
              <p>
                I started AeroInsights after spending time inside aviation finance teams and
                noticing the same pattern everywhere: brilliant analysts spending the bulk of
                their week fighting fragmented spreadsheets, version-control nightmares, and
                disconnected models — instead of doing real analytical work.
              </p>
              <p>
                The industry runs on aircraft worth tens of millions, leases that span decades,
                and credit decisions that move billions — yet the tooling underneath was, in
                most firms, brittle and bespoke. It didn&apos;t take long to convince myself a
                purpose-built decision-intelligence platform would change how the work feels day
                to day.
              </p>
              <p>
                So I built it. From the IFRS&nbsp;9 ECL engine to the scenario builder, the deal
                generator, the AI lessee radar, and the live Excel add-in — every module is
                written from scratch around how aviation finance teams actually operate, not
                grafted onto a generic SaaS shell.
              </p>
              <p>
                Along the way, I&apos;ve been lucky to sit with executives at{" "}
                <span className="font-semibold text-gray-800">Aerfin</span>,{" "}
                <span className="font-semibold text-gray-800">ELFC</span>, and{" "}
                <span className="font-semibold text-gray-800">Grant Thornton&apos;s aviation team</span>,
                whose feedback shaped the risk frameworks and assumptions baked into the
                platform today. The demo conversations were long — often 30–60 minutes of
                whiteboarding edge cases — and every one of them sharpened the product.
              </p>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── DEMOED WITH ──────────────────────────────────────────────────────────── */
const DEMOED_WITH = [
  "Aerfin", "Grant Thornton", "ELFC", "KPMG",
  "TGIS Aviation", "Ishka Airglobal Finance",
  "Skyworks", "EY", "Cloudcards",
];

function DemoedWith() {
  return (
    <section className="relative py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            Demoed with &amp; shaped by execs at
          </p>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-base font-bold text-gray-500">
            {DEMOED_WITH.map((f, i) => (
              <span key={f} className="flex items-center gap-8">
                {f}
                {i < DEMOED_WITH.length - 1 && (
                  <span className="text-gray-300" aria-hidden>·</span>
                )}
              </span>
            ))}
          </div>
        </FadeIn>
        <FadeIn delay={0.18}>
          <p className="mx-auto mt-6 max-w-xl text-xs text-gray-400">
            Each engagement was a ≥10-minute review session, often longer — assumptions,
            frameworks, and module priorities were refined directly from that feedback.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── WHAT I'M BUILDING NEXT ───────────────────────────────────────────────── */
const FOCUS_AREAS = [
  {
    icon: "bi-shield-check",
    title: "Audit-grade IFRS 9",
    desc: "Continually refining the ECL engine, staging migration, and PD/LGD curves with feedback from external auditors.",
  },
  {
    icon: "bi-stars",
    title: "AI deal intelligence",
    desc: "Expanding lessee radar, deal-feed comparables, and jurisdiction watch — surfacing signals before they hit public filings.",
  },
  {
    icon: "bi-puzzle",
    title: "Configurability",
    desc: "Every firm runs slightly differently — pushing harder on per-team configuration so the platform fits each workflow, not the other way around.",
  },
  {
    icon: "bi-file-earmark-spreadsheet",
    title: "Live Excel bridge",
    desc: "The Excel add-in keeps growing — analysts get live portfolio data inside their models without ever leaving Excel.",
  },
];

function FocusAreas() {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <FadeIn className="mb-12 flex flex-col items-center text-center">
          <span className="inline-flex items-center rounded-full border border-[#002147]/20 bg-[#002147]/5 px-3.5 py-1 text-xs font-semibold tracking-wide text-[#002147]">
            What&apos;s on the roadmap
          </span>
          <h2 className="mt-4 max-w-2xl text-3xl font-black tracking-tight text-gray-950 sm:text-4xl leading-[1.1]">
            What I&apos;m building next
          </h2>
        </FadeIn>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {FOCUS_AREAS.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.06}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-white/60 bg-white/75 p-7 shadow-sm backdrop-blur-md transition-shadow duration-300 hover:border-[#002147]/22 hover:shadow-xl hover:shadow-[#002147]/10"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-[#002147]/8 transition-colors duration-300 group-hover:bg-[#002147]">
                  <i
                    className={cn(
                      "group-hover:icon-pop bi text-lg text-[#002147] transition-colors duration-300 group-hover:text-white",
                      f.icon
                    )}
                  />
                </div>
                <p className="font-bold text-gray-950">{f.title}</p>
                <p className="text-sm leading-relaxed text-gray-500">{f.desc}</p>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CONTACT ──────────────────────────────────────────────────────────────── */
function Contact() {
  const cards = [
    {
      icon: "bi-envelope",
      title: "Email",
      desc: "Drop me a line — I read and reply to every message personally.",
      action: EMAIL,
      href: EMAIL_HREF,
    },
    {
      icon: "bi-linkedin",
      title: "LinkedIn",
      desc: "Connect and follow what I'm building.",
      action: "Visit profile",
      href: LINKEDIN,
      external: true,
    },
    {
      icon: "bi-calendar-check",
      title: "Book a call",
      desc: "30 minutes — walk through the platform, share your workflow, or just chat.",
      action: "Pick a slot",
      href: DEMO_LINK,
      external: true,
    },
  ];

  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <FadeIn className="mb-12 flex flex-col items-center text-center">
          <span className="inline-flex items-center rounded-full border border-[#002147]/20 bg-[#002147]/5 px-3.5 py-1 text-xs font-semibold tracking-wide text-[#002147]">
            Get in touch
          </span>
          <h2 className="mt-4 max-w-xl text-3xl font-black tracking-tight text-gray-950 sm:text-4xl leading-[1.1]">
            Let&apos;s talk aviation finance.
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-gray-600">
            Whether you want a demo, a chat about your workflow, or just to swap notes on the
            industry — pick whichever channel works for you.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cards.map((c, i) => (
            <FadeIn key={c.title} delay={i * 0.06}>
              <motion.a
                href={c.href}
                target={c.external ? "_blank" : undefined}
                rel={c.external ? "noopener noreferrer" : undefined}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-white/60 bg-white/75 p-6 shadow-sm backdrop-blur-md transition-shadow duration-300 hover:border-[#002147]/22 hover:shadow-xl hover:shadow-[#002147]/10"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-[#002147]/8 transition-colors duration-300 group-hover:bg-[#002147]">
                  <i
                    className={cn(
                      "group-hover:icon-pop bi text-lg text-[#002147] transition-colors duration-300 group-hover:text-white",
                      c.icon
                    )}
                  />
                </div>
                <p className="font-bold text-gray-950">{c.title}</p>
                <p className="flex-1 text-sm leading-relaxed text-gray-500">{c.desc}</p>
                <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#002147]">
                  {c.action}
                  <i className="bi bi-arrow-right text-xs transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </motion.a>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FOOTER (lightweight) ─────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="relative overflow-hidden pb-14 pt-56">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(200,212,236,0) 0%, rgba(184,200,228,0.55) 18%, rgba(120,142,184,0.70) 32%, rgba(45,72,116,0.85) 46%, rgba(15,33,62,0.96) 60%, #0a1a33 72%, #0a1a33 100%)",
        }}
      />
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-6 text-center">
          <Link to="/home" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#002147] p-1.5">
              <img src="/logo.png" alt="AeroInsights" className="h-full w-full object-contain" />
            </div>
            <span className="text-[1.05rem] font-extrabold tracking-tight text-white">
              AeroInsights
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <a
              href={EMAIL_HREF}
              className="flex size-9 items-center justify-center rounded-lg border border-white/10 text-white/60 transition hover:bg-white/8 hover:text-white"
              aria-label="Email"
            >
              <i className="bi bi-envelope text-sm" />
            </a>
            <a
              href={LINKEDIN}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-9 items-center justify-center rounded-lg border border-white/10 text-white/60 transition hover:bg-white/8 hover:text-white"
              aria-label="LinkedIn"
            >
              <i className="bi bi-linkedin text-sm" />
            </a>
            <a
              href={DEMO_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-9 items-center justify-center rounded-lg border border-white/10 text-white/60 transition hover:bg-white/8 hover:text-white"
              aria-label="Book a demo"
            >
              <i className="bi bi-calendar-event text-sm" />
            </a>
          </div>
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} AeroInsights — built by Tanam Sethi.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── PAGE ─────────────────────────────────────────────────────────────────── */
export default function About() {
  return (
    <div className="relative min-h-screen font-sans text-gray-950 antialiased">
      <AmbientBackground />
      <Navbar />
      <main className="relative">
        <Hero />
        <Story />
        <DemoedWith />
        <FocusAreas />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
