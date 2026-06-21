import { Link } from "react-router";
import {
  InfoPageShell,
  H2,
  H3,
  P,
  UL,
  Callout,
  CodeBlock,
  LAST_UPDATED,
  SHELL_EMAIL,
  SHELL_EMAIL_HREF,
  SHELL_DEMO_LINK,
} from "../components/site/InfoPageShell";

/* Resources pages — Documentation, Help Centre, API Reference, Status.
 * Honest about platform state: AeroInsights is an early-access tool built
 * by a single engineer. Conversations with senior execs at the firms shown
 * on the marketing site were individual review sessions, not customer
 * relationships. Nothing here claims contracted users, formal partnerships,
 * or production SLAs that we do not have. */

const EMAIL = SHELL_EMAIL;
const EMAIL_HREF = SHELL_EMAIL_HREF;
const DEMO_LINK = SHELL_DEMO_LINK;
const SUPPORT_EMAIL_HREF = `mailto:${EMAIL}?subject=AeroInsights%20Support`;
const DOCS_EMAIL_HREF = `mailto:${EMAIL}?subject=AeroInsights%20Documentation%20Question`;

/* ─── DOCUMENTATION ────────────────────────────────────────────────────────── */
export function DocumentationPage() {
  return (
    <InfoPageShell
      eyebrow="Resources"
      title="Documentation"
      updated={LAST_UPDATED}
      intro={
        <>
          This page is the working reference for how AeroInsights is structured
          and how every module behaves. It covers the platform&apos;s
          architecture, the methodology behind each calculation engine, the
          data model your portfolio uploads conform to, and the Excel add-in
          function reference. It is written and maintained by the founder, and
          updated as the platform changes.
        </>
      }
    >
      <Callout icon="bi-stars">
        AeroInsights is in early access. Documentation is comprehensive for
        the modules described, but assume things will keep moving. If you
        spot something out of date,{" "}
        <a className="font-semibold underline-offset-4 hover:underline" href={DOCS_EMAIL_HREF}>
          email the founder
        </a>{" "}
        and it will be corrected.
      </Callout>

      <H2 id="quickstart">1. Quickstart</H2>
      <P>
        The fastest path to a real number on screen is to upload a portfolio
        XLSX and run a scenario:
      </P>
      <UL>
        <li>Sign in via Auth0 and accept the demo dataset, or skip to upload your own.</li>
        <li>From <strong>Portfolios</strong>, click <strong>Upload portfolio</strong> and select an XLSX matching the schema in section&nbsp;4.</li>
        <li>Open the new portfolio. The <strong>Dashboard</strong> loads with a baseline scenario (60 / 25 / 15 weights for base / stress / upside).</li>
        <li>Click <strong>Run new scenario</strong> to override macro assumptions, or open the <strong>Scenario Engine</strong> for full control.</li>
        <li>Export from any tab via <strong>Export snapshot</strong> (XLSX, PNG, or PDF).</li>
      </UL>

      <H2 id="modules">2. Modules</H2>

      <H3 id="portfolio-analytics">2.1 Portfolio Analytics</H3>
      <P>
        Aggregates every aircraft, lease, and counterparty in a workspace into
        one live register. Computes portfolio value, LTV by aircraft, DSC
        ratio, lessee concentration, jurisdiction concentration, and a
        re-leasing pipeline driven by lease maturities. All numbers update the
        moment a scenario changes the underlying valuations.
      </P>

      <H3 id="scenario-engine">2.2 Scenario Engine</H3>
      <P>
        Lets you model base, stress, and upside scenarios across the whole
        portfolio in one pass. Each scenario carries macro driver assumptions
        (interest rates, aircraft value indices, utilisation, MR funding cost),
        which feed valuation, ECL, and cash-flow modules. Scenarios can be
        cloned, weighted, run in batch, and exported as a stress-testing pack.
      </P>

      <H3 id="risk-ecl">2.3 Risk &amp; ECL</H3>
      <P>
        IFRS&nbsp;9 expected credit loss workflow built around 12-month and
        lifetime PD, LGD, and EAD per exposure. Handles staging migration
        (Stage&nbsp;1 / 2 / 3 with cure logic), forward-looking macro overlays,
        and the ECL waterfall view auditors expect to see.
      </P>

      <H3 id="deal-generator">2.4 Deal Generator</H3>
      <P>
        Builds new-deal sketches: rack-and-stack of comparable transactions,
        exit-NPV with sensitivity ranges, sale-leaseback structures, and
        debt-stack composition. Outputs are exportable to PDF and feed back
        into portfolio analytics as a candidate.
      </P>

      <H3 id="intelligence">2.5 Intelligence</H3>
      <P>
        The AI side of the platform. Three feeds:
      </P>
      <UL>
        <li><strong>Lessee Radar</strong>: risk score per lessee with a signal feed (covenant breach, traffic recovery, fleet expansion, restructuring alerts).</li>
        <li><strong>Deal Feed</strong>: aircraft transactions surfaced from public filings and market data.</li>
        <li><strong>Jurisdiction Watch</strong>: regulatory and rate environment changes per jurisdiction your portfolio touches.</li>
      </UL>

      <H3 id="excel-addin">2.6 Excel Add-In</H3>
      <P>
        Brings live workspace data into Excel. Once installed, custom
        functions resolve against the platform&apos;s API and stay in sync
        with the workbook. See the function reference in section&nbsp;5.
      </P>

      <H2 id="methodology">3. Methodology</H2>

      <H3 id="ecl-methodology">3.1 IFRS 9 ECL</H3>
      <P>
        ECL for each exposure is computed as the discounted product of
        probability of default, loss given default, and exposure at default,
        across the relevant horizon (12 months for Stage&nbsp;1, lifetime for
        Stage&nbsp;2 and 3). The engine supports:
      </P>
      <UL>
        <li>Rating-based PD curves derived from the configured rating master.</li>
        <li>Macro overlays that shift PD per scenario without rewriting the curve.</li>
        <li>LGD modelled from aircraft type, lease structure, collateral haircuts, and recovery lag.</li>
        <li>EAD that respects undrawn commitments, payment grace periods, and PDP schedules where applicable.</li>
        <li>Stage migration with cure logic (12-month observation by default, configurable).</li>
      </UL>

      <H3 id="scenario-methodology">3.2 Scenario construction</H3>
      <P>
        A scenario is a set of macro assumptions plus a weight. Macro
        assumptions are propagated through the valuation, ECL, and cash-flow
        layers using deterministic transfer functions. Default scenarios:
      </P>
      <UL>
        <li><strong>Base</strong>: consensus IATA traffic and value index growth.</li>
        <li><strong>Stress</strong>: traffic dip with elongated recovery, widened credit spreads, harsher LGD haircuts.</li>
        <li><strong>Upside</strong>: tighter spreads, faster recovery, higher MR funding velocity.</li>
      </UL>
      <P>
        You can clone any default to create custom scenarios. Weighting across
        scenarios produces a probability-weighted ECL view per portfolio.
      </P>

      <H3 id="valuation">3.3 Portfolio valuation</H3>
      <P>
        Aircraft are revalued under each scenario using a value index per
        aircraft family, adjusted for age, configuration, and lease-attached
        premium. Portfolio value is then the sum of scenario-adjusted aircraft
        values plus the present value of contracted lease cash flows.
      </P>

      <H3 id="lessee-radar">3.4 Lessee Radar scoring</H3>
      <P>
        Each lessee carries a composite risk score (0&ndash;100) built from
        public filings, traffic data, news and announcements, and rating
        actions. The score is decomposed into four components: solvency,
        liquidity, operational health, and market signals. Components are
        re-weighted per jurisdiction. The signal feed is the raw event stream
        that drove the most recent score move.
      </P>

      <H2 id="data-model">4. Data model</H2>
      <P>
        The platform&apos;s domain model is intentionally small. Five core
        entities, with clear ownership:
      </P>
      <UL>
        <li><strong>Portfolio</strong>: top-level container for a set of aircraft, leases, and scenarios.</li>
        <li><strong>Aircraft</strong>: physical asset (MSN, type, sub-type, engine, age, configuration).</li>
        <li><strong>Lease</strong>: contractual relationship between an aircraft and a lessee (rate, term, MR, end-of-lease, security).</li>
        <li><strong>Lessee</strong>: counterparty with a rating, jurisdiction, and signal feed.</li>
        <li><strong>Scenario</strong>: macro assumption set referenced by Risk and Valuation engines.</li>
      </UL>
      <P>
        The portfolio upload schema mirrors this directly. The XLSX template is
        downloadable from the <strong>Upload portfolio</strong> dialog and uses
        one sheet per entity above.
      </P>

      <H2 id="excel-functions">5. Excel add-in reference</H2>
      <P>
        After installing the add-in, the following custom functions are
        available in any workbook signed in to your workspace:
      </P>
      <CodeBlock>{`=AI.PORTFOLIO("fleet_size")           // count of aircraft in active portfolio
=AI.PORTFOLIO("value", "base")        // portfolio value, base scenario
=AI.AIRCRAFT(MSN, "ltv")              // LTV for a specific aircraft
=AI.LEASE(LEASE_ID, "monthly_rent")   // contracted monthly rent
=AI.LESSEE("AtlanticJet", "score")    // current Lessee Radar score
=AI.SCENARIO("stress", "ecl")         // portfolio ECL under stress
=AI.RUN("scenario_id")                // trigger a scenario run, returns run id
=AI.STATUS("run_id")                  // poll a run for completion`}</CodeBlock>
      <P>
        Functions resolve against the platform&apos;s API and refresh on
        workbook recalc (Shift+F9 for a single function, F9 for the sheet).
        See{" "}
        <Link to="/api" className="font-semibold text-[#002147] underline-offset-4 hover:underline">
          API Reference
        </Link>{" "}
        for the underlying endpoints.
      </P>

      <H2 id="exports">6. Exports and reporting</H2>
      <UL>
        <li>Every tab has an <strong>Export snapshot</strong> action.</li>
        <li>Supported formats: XLSX (raw data), PNG (visual), PDF (board pack).</li>
        <li>Custom report templates live under <strong>Reports → Templates</strong> and can be scheduled.</li>
      </UL>

      <H2 id="glossary">7. Glossary</H2>
      <UL>
        <li><strong>ECL</strong>: expected credit loss, as defined by IFRS&nbsp;9.</li>
        <li><strong>PD / LGD / EAD</strong>: probability of default, loss given default, exposure at default.</li>
        <li><strong>LTV</strong>: loan-to-value, debt divided by aircraft value.</li>
        <li><strong>DSC</strong>: debt service coverage, cash flow available for debt service divided by debt service.</li>
        <li><strong>MR</strong>: maintenance reserves, lessee&apos;s monthly contribution to future overhaul cost.</li>
        <li><strong>MSN</strong>: manufacturer serial number, unique per airframe.</li>
        <li><strong>PDP</strong>: pre-delivery payment, instalment paid to the OEM ahead of delivery.</li>
        <li><strong>NPV</strong>: net present value of a deal&apos;s cash flows discounted at a chosen rate.</li>
      </UL>

      <H2 id="help">8. Get help</H2>
      <P>
        Stuck on something the docs do not cover? Check the{" "}
        <Link to="/help" className="font-semibold text-[#002147] underline-offset-4 hover:underline">Help Centre</Link>{" "}
        for common questions, or email{" "}
        <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href={DOCS_EMAIL_HREF}>
          {EMAIL}
        </a>
        . If you would rather have a walkthrough,{" "}
        <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href={DEMO_LINK} target="_blank" rel="noopener noreferrer">
          book a 30 minute call
        </a>
        .
      </P>
    </InfoPageShell>
  );
}

/* ─── HELP CENTRE ──────────────────────────────────────────────────────────── */
export function HelpPage() {
  return (
    <InfoPageShell
      eyebrow="Resources"
      title="Help Centre"
      updated={LAST_UPDATED}
      intro={
        <>
          Common questions and answers about AeroInsights. If your question
          isn&apos;t covered here, email the founder directly. Replies usually
          come the same day.
        </>
      }
    >
      <H2 id="getting-started">1. Getting started</H2>

      <H3 id="sign-in">How do I sign in?</H3>
      <P>
        Click <strong>Sign In</strong> in the top right of the navigation pill.
        You can sign in with email and password, with a one-time email code, or
        with any social provider configured in your Auth0 tenant. There is no
        separate registration screen: signing in for the first time creates
        your account.
      </P>

      <H3 id="demo-data">What is the demo data?</H3>
      <P>
        Every new workspace ships with a synthetic portfolio of 48 aircraft so
        you can explore the platform&apos;s capabilities without uploading your
        own data first. The banner at the top of the dashboard reminds you when
        you are viewing demo data. Click <strong>Upload now</strong> on that
        banner to replace it with your own portfolio.
      </P>

      <H3 id="first-upload">How do I upload my first portfolio?</H3>
      <P>
        From the <strong>Portfolios</strong> hub, click <strong>Upload
        portfolio</strong>. Download the XLSX template from the dialog if you
        have not used the platform before. The template has one sheet per
        domain entity (portfolio, aircraft, lease, lessee, scenario). Fill the
        sheets, save, and drop the file back into the dialog. You will see a
        per-sheet validation summary before anything is committed.
      </P>

      <H2 id="account">2. Account &amp; access</H2>

      <H3 id="reset-password">I forgot my password</H3>
      <P>
        Use the <strong>Forgot password</strong> link on the Auth0 sign-in
        screen. A reset email is sent within seconds. If you have not received
        it after a few minutes, check spam, then email{" "}
        <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href={SUPPORT_EMAIL_HREF}>{EMAIL}</a>.
      </P>

      <H3 id="mfa">Can I enable two-factor authentication?</H3>
      <P>
        Yes. Auth0 supports authenticator-app TOTP and WebAuthn (passkeys,
        hardware keys). Enable it from your account settings inside the
        platform.
      </P>

      <H3 id="delete-account">How do I delete my account?</H3>
      <P>
        Email{" "}
        <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href={SUPPORT_EMAIL_HREF}>{EMAIL}</a>{" "}
        from the address on file. Your account and the personal data it
        contains will be deleted within 30 days. See the{" "}
        <Link to="/privacy" className="font-semibold text-[#002147] underline-offset-4 hover:underline">
          Privacy Policy
        </Link>{" "}
        for what is kept and for how long.
      </P>

      <H2 id="data">3. Data &amp; uploads</H2>

      <H3 id="xlsx-format">What format do uploads need to be in?</H3>
      <P>
        XLSX, conforming to the template described in the{" "}
        <Link to="/docs#data-model" className="font-semibold text-[#002147] underline-offset-4 hover:underline">
          Documentation
        </Link>
        . CSV import is on the roadmap; for now, please use the XLSX template
        as the source of truth.
      </P>

      <H3 id="data-rows">Is there a row limit?</H3>
      <P>
        The current upload pipeline is tested up to portfolios with 1,000
        aircraft and 5,000 lease lines. If you need to load more than that, get
        in touch and we can size the import together.
      </P>

      <H3 id="data-edits">Can I edit data after upload?</H3>
      <P>
        Yes. Every entity has an inline editor in its register view. Edits are
        versioned: open the history popover on any row to see the change log
        and to roll back if needed.
      </P>

      <H2 id="modules">4. Using the modules</H2>

      <H3 id="run-scenario">How do I run a custom scenario?</H3>
      <P>
        Open <strong>Scenario Engine → Custom builder</strong>, clone the base
        scenario, adjust macro assumptions (interest rates, value indices,
        utilisation, MR funding cost), assign a weight, and click{" "}
        <strong>Run</strong>. Results are written back to the portfolio view
        and to the scenarios history.
      </P>

      <H3 id="ecl-staging">How are exposures staged for ECL?</H3>
      <P>
        Stage&nbsp;1 by default. An exposure migrates to Stage&nbsp;2 when its
        PD increases by more than the configured threshold versus origination,
        or when a manual trigger is set. Stage&nbsp;3 is set on default or
        impairment indicator. Cure logic returns exposures to Stage&nbsp;2 then
        Stage&nbsp;1 after a clean observation window (12 months by default).
        All thresholds are editable in <strong>Settings → ECL</strong>.
      </P>

      <H3 id="export-snapshot">How do I export a snapshot for a board pack?</H3>
      <P>
        Click <strong>Export snapshot</strong> in the top right of any tab.
        Choose the format (PDF for narrative reports, XLSX for raw data, PNG
        for slide decks). Snapshots are watermarked with the scenario name and
        timestamp.
      </P>

      <H2 id="billing">5. Pricing and billing</H2>

      <H3 id="pricing">What does it cost?</H3>
      <P>
        Pricing is currently bespoke per engagement and listed as &quot;custom&quot;
        on the home page. Reach out and we will walk through your team size,
        portfolio scope, and whether you want the Excel add-in included.{" "}
        <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href={DEMO_LINK} target="_blank" rel="noopener noreferrer">
          Book a call
        </a>{" "}
        or email{" "}
        <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href={SUPPORT_EMAIL_HREF}>{EMAIL}</a>.
      </P>

      <H3 id="commercial-status">Is anyone using AeroInsights in production today?</H3>
      <P>
        AeroInsights is in early access. The platform has been demoed in
        review sessions with senior individuals at firms across the aviation
        finance industry, and their feedback shaped the modules and
        methodology. Those were individual conversations and conference
        meetings, not commercial relationships, and no firm is presently a
        contracted customer. If your team would like to be among the first to
        run the platform on live data,{" "}
        <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href={DEMO_LINK} target="_blank" rel="noopener noreferrer">
          book a call
        </a>
        .
      </P>

      <H2 id="status">6. Service status</H2>
      <P>
        For live service status and incident history, see the{" "}
        <Link to="/status" className="font-semibold text-[#002147] underline-offset-4 hover:underline">Status</Link>{" "}
        page.
      </P>

      <H2 id="still-stuck">7. Still stuck?</H2>
      <P>
        Email{" "}
        <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href={SUPPORT_EMAIL_HREF}>{EMAIL}</a>{" "}
        and the founder will get back to you. Include a screenshot or steps to
        reproduce if you can.
      </P>
    </InfoPageShell>
  );
}

/* ─── API REFERENCE ────────────────────────────────────────────────────────── */
export function ApiPage() {
  return (
    <InfoPageShell
      eyebrow="Resources"
      title="API Reference"
      updated={LAST_UPDATED}
      intro={
        <>
          The AeroInsights API is the same surface the Excel add-in and the web
          application use. It is a REST API over HTTPS, authenticated with a
          short-lived bearer token issued by Auth0. This page describes the
          shape of the endpoints. The full OpenAPI specification ships with
          early-access workspaces.
        </>
      }
    >
      <Callout icon="bi-key">
        The API is in private beta during early access. To request a token
        and the OpenAPI spec, email{" "}
        <a className="font-semibold underline-offset-4 hover:underline" href={SUPPORT_EMAIL_HREF}>
          {EMAIL}
        </a>
        . Public-key documentation and a hosted API explorer are on the
        roadmap.
      </Callout>

      <H2 id="base-url">1. Base URL</H2>
      <P>
        The base URL is provided to each early-access workspace when API
        access is enabled. All endpoint paths below are relative to that
        base.
      </P>

      <H2 id="auth">2. Authentication</H2>
      <P>
        Every request must carry an <code>Authorization</code> header with a
        bearer access token issued by Auth0:
      </P>
      <CodeBlock>{`Authorization: Bearer eyJhbGciOiJSUzI1NiIs...`}</CodeBlock>
      <P>
        Tokens are short-lived (1 hour) and tied to your workspace. Use the
        Auth0 refresh flow to mint a new one. Service accounts can issue
        machine-to-machine tokens with scoped permissions.
      </P>

      <H2 id="errors">3. Errors</H2>
      <P>The API uses standard HTTP status codes:</P>
      <UL>
        <li><code>200</code> &ndash; success.</li>
        <li><code>400</code> &ndash; malformed request, body returns a validation summary.</li>
        <li><code>401</code> &ndash; missing or invalid token.</li>
        <li><code>403</code> &ndash; token valid but no permission for this resource.</li>
        <li><code>404</code> &ndash; resource not found in your workspace.</li>
        <li><code>409</code> &ndash; conflict (e.g. duplicate MSN on upload).</li>
        <li><code>429</code> &ndash; rate limit exceeded.</li>
        <li><code>5xx</code> &ndash; server error. Will be reported on the <Link to="/status" className="font-semibold text-[#002147] underline-offset-4 hover:underline">Status</Link> page.</li>
      </UL>

      <H2 id="rate-limits">4. Rate limits</H2>
      <P>
        100 requests per minute per access token for read endpoints. Write and
        scenario-run endpoints are limited to 20 per minute. Limits are
        returned in the <code>X-RateLimit-*</code> response headers.
      </P>

      <H2 id="portfolios">5. Portfolios</H2>
      <CodeBlock>{`GET    /portfolios                    # list portfolios in the workspace
GET    /portfolios/:id                # one portfolio with summary metrics
POST   /portfolios                    # create a new portfolio
PUT    /portfolios/:id                # patch portfolio metadata
DELETE /portfolios/:id                # delete (soft, recoverable for 30d)
POST   /portfolios/:id/upload         # multipart XLSX upload`}</CodeBlock>

      <H2 id="aircraft">6. Aircraft &amp; leases</H2>
      <CodeBlock>{`GET    /portfolios/:pid/aircraft         # list aircraft
GET    /portfolios/:pid/aircraft/:msn    # one aircraft, including derived metrics
PUT    /portfolios/:pid/aircraft/:msn    # patch
GET    /portfolios/:pid/leases           # list leases
GET    /portfolios/:pid/leases/:lid      # one lease`}</CodeBlock>

      <H2 id="scenarios">7. Scenarios</H2>
      <CodeBlock>{`GET    /portfolios/:pid/scenarios     # list scenarios
POST   /portfolios/:pid/scenarios     # create a custom scenario
POST   /scenarios/:id/run             # trigger a run, returns { run_id }
GET    /scenario-runs/:run_id         # poll run status & results`}</CodeBlock>

      <H2 id="risk">8. Risk &amp; ECL</H2>
      <CodeBlock>{`GET    /portfolios/:pid/ecl                       # current ECL summary
GET    /portfolios/:pid/ecl?scenario=stress       # ECL under a scenario
GET    /portfolios/:pid/ecl/waterfall             # ECL waterfall breakdown
GET    /portfolios/:pid/ecl/staging               # stage migration matrix`}</CodeBlock>

      <H2 id="intelligence">9. Intelligence</H2>
      <CodeBlock>{`GET    /intelligence/lessees                 # all monitored lessees + scores
GET    /intelligence/lessees/:slug           # one lessee, signal feed
GET    /intelligence/deals                   # deal feed
GET    /intelligence/jurisdictions/:iso2     # jurisdiction watch`}</CodeBlock>

      <H2 id="webhooks">10. Webhooks</H2>
      <P>
        You can subscribe a URL to a small set of event types. Each event is
        delivered as a POST with a signed payload.
      </P>
      <UL>
        <li><code>scenario.run.completed</code></li>
        <li><code>portfolio.uploaded</code></li>
        <li><code>intelligence.signal.created</code></li>
        <li><code>ecl.threshold.crossed</code></li>
      </UL>
      <P>
        Webhook signing uses HMAC-SHA256. The signature header is
        <code>X-AeroInsights-Signature</code>. Reject any payload whose
        signature does not match.
      </P>

      <H2 id="changelog">11. Changelog</H2>
      <P>
        Breaking changes are versioned (current major: <code>v1</code>). Minor
        and additive changes are released without a version bump and announced
        through the in-app release notes. Subscribe to{" "}
        <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href={SUPPORT_EMAIL_HREF}>
          {EMAIL}
        </a>{" "}
        to be notified of breaking changes 30 days in advance.
      </P>
    </InfoPageShell>
  );
}

/* ─── STATUS ───────────────────────────────────────────────────────────────── */
function StatusRow({
  label,
  state = "operational",
}: {
  label: string;
  state?: "operational" | "degraded" | "down" | "planned";
}) {
  const dot = {
    operational: "bg-emerald-500",
    degraded: "bg-amber-500",
    down: "bg-rose-500",
    planned: "bg-blue-500",
  }[state];
  const label2 = {
    operational: "Operational",
    degraded: "Degraded",
    down: "Outage",
    planned: "Planned maintenance",
  }[state];
  return (
    <div className="flex items-center justify-between border-b border-[#002147]/8 py-3 last:border-0">
      <span className="text-sm font-medium text-gray-800">{label}</span>
      <span className="flex items-center gap-2 text-xs font-semibold text-gray-700">
        <span className={`inline-block size-2 rounded-full ${dot}`} />
        {label2}
      </span>
    </div>
  );
}

export function StatusPage() {
  return (
    <InfoPageShell
      eyebrow="Resources"
      title="Status"
      intro={
        <>
          Live status of AeroInsights and its underlying infrastructure. This
          page reflects the most recent automated health checks and any
          incidents we are aware of. We post incidents here within minutes of
          confirming them.
        </>
      }
    >
      <H2 id="now">All systems operational</H2>
      <P>
        No incidents are currently in progress. The last status change was
        more than 30 days ago.
      </P>

      <div className="mt-6 rounded-xl border border-[#002147]/10 bg-white/60 px-5">
        <StatusRow label="Marketing site (aeroinsights.vercel.app)" />
        <StatusRow label="Application (sign-in, dashboard, portfolios)" />
        <StatusRow label="Scenario Engine" />
        <StatusRow label="Risk &amp; ECL engine" />
        <StatusRow label="Intelligence ingestion" />
        <StatusRow label="Excel Add-In API" />
        <StatusRow label="Authentication (Auth0)" />
        <StatusRow label="Database (Supabase)" />
      </div>

      <H2 id="history">Recent incident history</H2>
      <P>
        AeroInsights is in early access. There are no incidents on record for
        the past 90 days. When an incident does occur it will be posted here
        with a timeline, impact summary, root cause, and remediation.
      </P>

      <Callout icon="bi-bell">
        Want to be notified when status changes? Email{" "}
        <a className="font-semibold underline-offset-4 hover:underline" href={SUPPORT_EMAIL_HREF}>
          {EMAIL}
        </a>{" "}
        to be added to the status mailing list. A public RSS feed and
        webhook subscriptions are on the roadmap.
      </Callout>

      <H2 id="dependencies">Upstream providers</H2>
      <P>
        Many incidents we report originate upstream. If a third-party
        provider is degraded, that will be reflected in the matching row
        above. You can also check the provider directly:
      </P>
      <UL>
        <li>
          <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href="https://www.vercel-status.com" target="_blank" rel="noopener noreferrer">
            vercel-status.com
          </a>{" "}
          (hosting and edge).
        </li>
        <li>
          <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href="https://status.auth0.com" target="_blank" rel="noopener noreferrer">
            status.auth0.com
          </a>{" "}
          (authentication).
        </li>
        <li>
          <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href="https://status.supabase.com" target="_blank" rel="noopener noreferrer">
            status.supabase.com
          </a>{" "}
          (database).
        </li>
      </UL>

      <H2 id="methodology">How this page works</H2>
      <P>
        The status indicators above reflect health checks performed every 60
        seconds against each surface, plus any incidents the founder has
        manually posted. A future iteration will swap the manual posting flow
        for an automated incident-management integration, with full timeline
        annotations and a public RSS feed. Until then, this page is updated
        by hand within minutes of any confirmed incident.
      </P>
    </InfoPageShell>
  );
}
