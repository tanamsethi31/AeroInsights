import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useScrollRestore } from "../hooks/useScrollRestore";

/* ─── helpers ──────────────────────────────────────────────────────────────── */
function cn(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

function FadeIn({
  children,
  delay = 0,
  className,
  y = 22,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ─── contact constants ────────────────────────────────────────────────────── */
const EMAIL = "sethit@tcd.ie";
const EMAIL_HREF = `mailto:${EMAIL}?subject=Hello%20Tanam`;
const LINKEDIN = "https://www.linkedin.com/in/tanamsethi/";
const DEMO_LINK = "https://cal.com/tanam-sethi/30min";

/* ─── AMBIENT BLOB BACKGROUND (mirror of Landing) ──────────────────────────── */
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
        className="animate-blob-a absolute -left-32 top-[6%] h-[640px] w-[640px] rounded-full opacity-[0.65] mix-blend-multiply blur-[140px]"
        style={{ background: "radial-gradient(circle, #6fa6ff 0%, transparent 70%)" }}
      />
      <div
        className="animate-blob-b absolute -right-40 top-[28%] h-[720px] w-[720px] rounded-full opacity-[0.60] mix-blend-multiply blur-[150px]"
        style={{ background: "radial-gradient(circle, #4f7fd6 0%, transparent 70%)" }}
      />
      <div
        className="animate-blob-c absolute -left-32 top-[58%] h-[680px] w-[680px] rounded-full opacity-[0.65] mix-blend-multiply blur-[140px]"
        style={{ background: "radial-gradient(circle, #6fcdf2 0%, transparent 70%)" }}
      />
      <div
        className="animate-blob-a absolute -right-20 bottom-[4%] h-[560px] w-[560px] rounded-full opacity-[0.55] mix-blend-multiply blur-[130px]"
        style={{ background: "radial-gradient(circle, #8ab4f0 0%, transparent 70%)" }}
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

/* ─── NAVBAR (floating dark pill, mirror of Landing) ───────────────────────── */
const NAV_LINKS: { label: string; href: string; route?: true }[] = [
  { label: "Home", href: "/home", route: true },
  { label: "About", href: "/about", route: true },
  { label: "Contact", href: "#contact" },
];

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Full-width blur band fading into page (same as Landing) */}
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
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-7 rounded-full border border-white/15 px-5 py-2.5 shadow-2xl shadow-[#001228]/35 backdrop-blur-[36px] backdrop-saturate-150",
              "bg-[#0a1a33]/92"
            )}
          >
            <Link to="/home" className="flex items-center gap-2.5 pl-1">
              <div className="flex size-7 items-center justify-center rounded-md bg-white/12 p-1">
                <img src="/logo.png" alt="AeroInsights" className="h-full w-full object-contain" />
              </div>
              <span className="text-[0.95rem] font-extrabold tracking-tight text-white">
                AeroInsights
              </span>
            </Link>

            <nav className="hidden items-center gap-3 md:flex">
              {NAV_LINKS.map((l) =>
                l.route ? (
                  <Link
                    key={l.label}
                    to={l.href}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-white/10 hover:text-white",
                      l.href === "/about" ? "bg-white/10 text-white" : "text-white/75"
                    )}
                  >
                    {l.label}
                  </Link>
                ) : (
                  <a
                    key={l.label}
                    href={l.href}
                    onClick={(e) => {
                      if (l.href.startsWith("#")) {
                        e.preventDefault();
                        document.querySelector(l.href)?.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    className="rounded-full px-3.5 py-1.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {l.label}
                  </a>
                )
              )}
            </nav>

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

            <button
              className="ml-1 flex size-8 items-center justify-center rounded-lg border border-white/12 text-white/80 transition-colors hover:bg-white/10 hover:text-white md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              <i className={cn("bi text-base", mobileOpen ? "bi-x-lg" : "bi-list")} />
            </button>
          </div>

          {/* Secondary pill: LinkedIn shortcut so users can reach Tanam directly */}
          <a
            href={LINKEDIN}
            target="_blank"
            rel="noopener noreferrer"
            className="auth-pill-btn hidden h-[54px] items-center gap-2 rounded-full border border-white/15 bg-[#0a1a33]/92 px-5 text-sm font-semibold text-white shadow-2xl shadow-[#001228]/35 backdrop-blur-[36px] backdrop-saturate-150 md:flex"
          >
            <i className="bi bi-linkedin text-sm" />
            LinkedIn
          </a>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="absolute left-3 right-3 top-[58px] md:hidden"
            >
              <div className="rounded-2xl border border-white/15 bg-[#0a1a33]/96 p-3 shadow-2xl backdrop-blur-[36px]">
                <div className="flex flex-col gap-1">
                  {NAV_LINKS.map((l) =>
                    l.route ? (
                      <Link
                        key={l.label}
                        to={l.href}
                        onClick={() => setMobileOpen(false)}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white"
                      >
                        {l.label}
                      </Link>
                    ) : (
                      <a
                        key={l.label}
                        href={l.href}
                        onClick={(e) => {
                          if (l.href.startsWith("#")) {
                            e.preventDefault();
                            document.querySelector(l.href)?.scrollIntoView({ behavior: "smooth" });
                          }
                          setMobileOpen(false);
                        }}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white"
                      >
                        {l.label}
                      </a>
                    )
                  )}
                  <a
                    href={DEMO_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#0a1a33]"
                  >
                    <i className="bi bi-calendar-event text-xs" />
                    Book a Demo
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}

/* ─── eyebrow + section-heading helpers (same chrome as Landing) ───────────── */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#002147]/20 bg-[#002147]/5 px-3.5 py-1 text-xs font-semibold tracking-wide text-[#002147]">
      {children}
    </span>
  );
}

/* ─── HERO ─────────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative pt-32 sm:pt-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <FadeIn>
          <Eyebrow>
            <i className="bi bi-person-circle text-xs" />
            The Builder
          </Eyebrow>
        </FadeIn>

        <div className="mt-10 grid grid-cols-1 items-center gap-10 md:mt-14 md:grid-cols-[auto_1fr] md:gap-16">
          <FadeIn delay={0.08}>
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-3 rounded-full bg-[radial-gradient(closest-side,rgba(0,33,71,0.18),transparent_70%)] blur-md"
              />
              <div className="relative size-40 overflow-hidden rounded-full ring-4 ring-white/80 shadow-xl shadow-[#002147]/15 sm:size-52">
                <img
                  src="/tanam.png"
                  alt="Tanam Sethi"
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.14}>
            <h1
              className="text-5xl font-black leading-[1.04] tracking-tight text-gray-950 sm:text-6xl lg:text-7xl"
              style={{ letterSpacing: "-0.035em" }}
            >
              Hi, I&apos;m <span className="text-[#002147]">Tanam Sethi.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600">
              I built AeroInsights single-handedly from scratch: a complete
              aviation finance intelligence platform purpose-built for the
              workflow lessors, financiers, and advisors actually use every day.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={DEMO_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-[#002147] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#002147]/20 transition hover:bg-[#001a38]"
              >
                <i className="bi bi-calendar-event" />
                Book a 30 minute call
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
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* ─── STORY ────────────────────────────────────────────────────────────────── */
function Story() {
  return (
    <section className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <FadeIn>
          <div className="rounded-2xl border border-white/60 bg-white/75 p-8 shadow-sm backdrop-blur-md sm:p-12">
            <Eyebrow>
              <i className="bi bi-book text-xs" />
              Why I built this
            </Eyebrow>
            <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight text-gray-950 sm:text-4xl">
              Aviation finance deserved better than a stack of spreadsheets.
            </h2>
            <div className="mt-7 flex flex-col gap-5 text-[15px] leading-relaxed text-gray-600">
              <p>
                I started AeroInsights after spending time inside aviation
                finance teams and noticing the same pattern everywhere:
                brilliant analysts spending the bulk of their week fighting
                fragmented spreadsheets, version control nightmares, and
                disconnected models, instead of doing real analytical work.
              </p>
              <p>
                The industry runs on aircraft worth tens of millions, leases
                that span decades, and credit decisions that move billions, yet
                the tooling underneath was, in most firms, brittle and bespoke.
                It didn&apos;t take long to convince myself a purpose-built
                decision intelligence platform would change how the work feels
                day to day.
              </p>
              <p>
                So I built it. From the IFRS&nbsp;9 ECL engine to the scenario
                builder, the deal generator, the AI lessee radar, and the live
                Excel add-in: every module is written from scratch around how
                aviation finance teams actually operate, not grafted onto a
                generic SaaS shell.
              </p>
              <p>
                Along the way, I&apos;ve been lucky to sit with executives at{" "}
                <span className="font-semibold text-gray-800">Aerfin</span>,{" "}
                <span className="font-semibold text-gray-800">ELFC</span>, and{" "}
                <span className="font-semibold text-gray-800">
                  Grant Thornton&apos;s aviation team
                </span>
                , whose feedback shaped the risk frameworks and assumptions
                baked into the platform today. The demo conversations were long,
                often 30 to 60 minutes of whiteboarding edge cases, and every
                one of them sharpened the product.
              </p>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── DEMOED WITH ──────────────────────────────────────────────────────────── */
const DEMOED_WITH: { name: string; src: string; h: number }[] = [
  { name: "Aerfin",                   src: "/logos/aerfin.webp",         h: 60 },
  { name: "Genesis",                  src: "/logos/genesis.webp",        h: 40 },
  { name: "Grant Thornton",           src: "/logos/grant-thornton.webp", h: 38 },
  { name: "ELFC",                     src: "/logos/elfc.png",            h: 32 },
  { name: "KPMG",                     src: "/logos/kpmg.webp",           h: 30 },
  { name: "TGIS Aviation",            src: "/logos/tgis.webp",           h: 62 },
  { name: "TrueNoord",                src: "/logos/truenoord.webp",      h: 52 },
  { name: "Ishka Airglobal Finance",  src: "/logos/ishka.webp",          h: 30 },
  { name: "Skyworks",                 src: "/logos/skyworks.webp",       h: 58 },
  { name: "EY",                       src: "/logos/ey.webp",             h: 38 },
  { name: "Cloudcards",               src: "/logos/cloudcards.png",      h: 28 },
];

function DemoedWith() {
  return (
    <section className="relative py-16">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            Demoed with and shaped by execs at
          </p>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {DEMOED_WITH.map((f) => (
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
        </FadeIn>
        <FadeIn delay={0.18}>
          <p className="mx-auto mt-8 max-w-xl text-xs text-gray-500">
            Each engagement was a 30 to 60 minute review session. Assumptions,
            frameworks, and module priorities were refined directly from that
            feedback.
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
    title: "Audit grade IFRS 9",
    desc: "Continually refining the ECL engine, staging migration, and PD/LGD curves with feedback from external auditors.",
  },
  {
    icon: "bi-stars",
    title: "AI deal intelligence",
    desc: "Expanding lessee radar, deal feed comparables, and jurisdiction watch, surfacing signals before they hit public filings.",
  },
  {
    icon: "bi-puzzle",
    title: "Configurability",
    desc: "Every firm runs slightly differently, so I am pushing harder on per team configuration so the platform fits each workflow, not the other way around.",
  },
  {
    icon: "bi-file-earmark-spreadsheet",
    title: "Live Excel bridge",
    desc: "The Excel add-in keeps growing. Analysts get live portfolio data inside their models without ever leaving Excel.",
  },
];

function FocusAreas() {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <FadeIn className="mb-12 flex flex-col items-center text-center">
          <Eyebrow>
            <i className="bi bi-compass text-xs" />
            What&apos;s on the roadmap
          </Eyebrow>
          <h2 className="mt-4 max-w-2xl text-3xl font-black leading-[1.1] tracking-tight text-gray-950 sm:text-4xl">
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
      desc: "Drop me a line. I read and reply to every message personally.",
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
      desc: "30 minutes to walk through the platform, share your workflow, or just chat.",
      action: "Pick a slot",
      href: DEMO_LINK,
      external: true,
    },
  ];

  return (
    <section id="contact" className="relative py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <FadeIn className="mb-12 flex flex-col items-center text-center">
          <Eyebrow>
            <i className="bi bi-chat-dots text-xs" />
            Get in touch
          </Eyebrow>
          <h2 className="mt-4 max-w-xl text-3xl font-black leading-[1.1] tracking-tight text-gray-950 sm:text-4xl">
            Let&apos;s talk aviation finance.
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-gray-600">
            Whether you want a demo, a chat about your workflow, or just to swap
            notes on the industry, pick whichever channel works for you.
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

/* ─── FOOTER (lightweight, matches Landing chrome) ─────────────────────────── */
function Footer() {
  return (
    <footer className="relative pb-10 pt-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px max-w-3xl"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(0,33,71,0.18) 35%, rgba(0,33,71,0.18) 65%, transparent 100%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-6 text-center">
          <Link to="/home" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#002147] p-1.5">
              <img src="/logo.png" alt="AeroInsights" className="h-full w-full object-contain" />
            </div>
            <span className="text-[1.05rem] font-extrabold tracking-tight text-gray-950">
              AeroInsights
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {[
              { icon: "bi-envelope",       label: "Email",       href: EMAIL_HREF,                       external: false },
              { icon: "bi-linkedin",       label: "LinkedIn",    href: LINKEDIN,                          external: true  },
              { icon: "bi-github",         label: "GitHub",      href: "https://github.com/tanamsethi31/", external: true  },
              { icon: "bi-calendar-event", label: "Book a demo", href: DEMO_LINK,                         external: true  },
            ].map((s) => (
              <a
                key={s.icon}
                href={s.href}
                target={s.external ? "_blank" : undefined}
                rel={s.external ? "noopener noreferrer" : undefined}
                aria-label={s.label}
                className="flex size-9 items-center justify-center rounded-lg border border-[#002147]/18 bg-white/75 text-gray-700 backdrop-blur-sm transition hover:border-[#002147]/35 hover:bg-white hover:text-[#002147]"
              >
                <i className={cn("bi text-sm", s.icon)} />
              </a>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} AeroInsights, built by Tanam Sethi.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── PAGE ─────────────────────────────────────────────────────────────────── */
export default function About() {
  // Restore scroll position when the user comes back to /about (e.g. from a
  // footer link or after viewing a Legal/Resources page).
  useScrollRestore("/about");
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
