import { useEffect, useState } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "framer-motion";

/* Shared chrome for static info pages (Legal, Resources, etc.).
 * Same floating dark pill nav, ambient blue blob bg, and quiet footer
 * as the rest of the marketing site, so every static page reads as the
 * same surface as Landing and About. */

function cn(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const EMAIL = "sethit@tcd.ie";
const EMAIL_HREF = `mailto:${EMAIL}?subject=AeroInsights%20enquiry`;
const DEMO_LINK = "https://cal.com/tanam-sethi/30min";
const LINKEDIN = "https://www.linkedin.com/in/tanamsethi/";

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
        style={{ background: "radial-gradient(circle, #6fa6ff 0%, transparent 70%)" }}
      />
      <div
        className="animate-blob-b absolute -right-40 top-[28%] h-[720px] w-[720px] rounded-full opacity-[0.50] mix-blend-multiply blur-[150px]"
        style={{ background: "radial-gradient(circle, #4f7fd6 0%, transparent 70%)" }}
      />
      <div
        className="animate-blob-c absolute -left-32 top-[58%] h-[680px] w-[680px] rounded-full opacity-[0.55] mix-blend-multiply blur-[140px]"
        style={{ background: "radial-gradient(circle, #6fcdf2 0%, transparent 70%)" }}
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

const NAV_LINKS: { label: string; href: string; route?: true }[] = [
  { label: "Home", href: "/home", route: true },
  { label: "About", href: "/about", route: true },
  { label: "Contact", href: `mailto:${EMAIL}` },
];

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <>
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
              "flex items-center gap-7 rounded-full border border-white/15 py-2.5 pl-5 pr-3.5 shadow-2xl shadow-[#001228]/35 backdrop-blur-[36px] backdrop-saturate-150",
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
                    className="rounded-full px-3.5 py-1.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {l.label}
                  </Link>
                ) : (
                  <a
                    key={l.label}
                    href={l.href}
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
              <i className={cn("bi text-lg", mobileOpen ? "bi-x" : "bi-list")} />
            </button>
          </div>

          <Link
            to="/login"
            className="auth-pill-btn hidden h-[54px] items-center gap-2 rounded-full border border-white/12 bg-[#0a1a33]/92 px-5 text-sm font-semibold text-white shadow-2xl shadow-[#001228]/35 backdrop-blur-[36px] backdrop-saturate-150 md:inline-flex"
          >
            <i className="bi bi-box-arrow-in-right text-base" />
            Sign In | Dashboard
          </Link>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="absolute left-3 right-3 top-[58px] rounded-2xl border border-white/15 bg-[#0a1a33]/96 p-3 shadow-2xl backdrop-blur-[36px] md:hidden"
            >
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
                      onClick={() => setMobileOpen(false)}
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
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}

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
        <div className="flex flex-col items-center gap-5 text-center">
          <Link to="/home" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#002147] p-1.5">
              <img src="/logo.png" alt="AeroInsights" className="h-full w-full object-contain" />
            </div>
            <span className="text-[1.05rem] font-extrabold tracking-tight text-gray-950">
              AeroInsights
            </span>
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-gray-600">
            <Link to="/docs" className="hover:text-[#002147]">Documentation</Link>
            <Link to="/help" className="hover:text-[#002147]">Help Centre</Link>
            <Link to="/api" className="hover:text-[#002147]">API Reference</Link>
            <Link to="/status" className="hover:text-[#002147]">Status</Link>
            <Link to="/privacy" className="hover:text-[#002147]">Privacy</Link>
            <Link to="/terms" className="hover:text-[#002147]">Terms</Link>
            <Link to="/security" className="hover:text-[#002147]">Security</Link>
            <Link to="/cookies" className="hover:text-[#002147]">Cookies</Link>
            <a href={LINKEDIN} target="_blank" rel="noopener noreferrer" className="hover:text-[#002147]">
              LinkedIn
            </a>
            <a href={EMAIL_HREF} className="hover:text-[#002147]">Contact</a>
          </div>
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} AeroInsights, built by Tanam Sethi.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── section primitives reusable by every info page ───────────────────────── */
export function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="mt-12 text-xl font-black tracking-tight text-gray-950 sm:text-2xl"
    >
      {children}
    </h2>
  );
}

export function H3({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h3
      id={id}
      className="mt-8 text-base font-bold tracking-tight text-gray-950"
    >
      {children}
    </h3>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-[15px] leading-relaxed text-gray-700">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-4 ml-5 list-disc space-y-2 text-[15px] leading-relaxed text-gray-700 marker:text-[#002147]/45">
      {children}
    </ul>
  );
}

export function Callout({
  icon = "bi-info-circle",
  children,
}: {
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 flex gap-3 rounded-xl border border-[#002147]/15 bg-[#002147]/5 p-4 text-[14px] leading-relaxed text-[#002147]/85">
      <i className={cn("bi shrink-0 text-base text-[#002147]/70", icon)} />
      <div>{children}</div>
    </div>
  );
}

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-xl border border-[#002147]/15 bg-[#0a1a33] p-4 text-[12.5px] leading-relaxed text-white shadow-sm">
      <code>{children}</code>
    </pre>
  );
}

/* ─── the shell ────────────────────────────────────────────────────────────── */
export function InfoPageShell({
  eyebrow,
  title,
  updated,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  updated?: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="relative min-h-screen font-sans text-gray-950 antialiased">
      <AmbientBackground />
      <Navbar />
      <main className="relative pt-32 sm:pt-40">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Link
            to="/home"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#002147]/70 transition hover:text-[#002147]"
          >
            <i className="bi bi-arrow-left text-[10px]" />
            Back to home
          </Link>

          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.25em] text-[#002147]/60">
            {eyebrow}
          </p>
          <h1
            className="mt-3 text-4xl font-black leading-[1.05] tracking-tight text-gray-950 sm:text-5xl"
            style={{ letterSpacing: "-0.025em" }}
          >
            {title}
          </h1>
          {updated ? (
            <p className="mt-4 text-sm text-gray-500">Last updated: {updated}</p>
          ) : null}

          <div className="mt-10 rounded-2xl border border-white/60 bg-white/80 p-7 shadow-sm backdrop-blur-md sm:p-10">
            <div className="text-[15px] leading-relaxed text-gray-700">{intro}</div>
            {children}
          </div>

          <p className="mt-8 text-xs text-gray-500">
            Questions? Email{" "}
            <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href={EMAIL_HREF}>
              {EMAIL}
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export const LAST_UPDATED = "21 June 2026";
export const SHELL_EMAIL = EMAIL;
export const SHELL_EMAIL_HREF = EMAIL_HREF;
export const SHELL_DEMO_LINK = DEMO_LINK;
