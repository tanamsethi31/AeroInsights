import { Link } from "react-router";
import {
  InfoPageShell,
  H2,
  P,
  UL,
  LAST_UPDATED,
  SHELL_EMAIL,
  SHELL_EMAIL_HREF,
} from "../components/site/InfoPageShell";

/* Legal pages — Privacy, Terms, Security, Cookies. All four share the same
 * marketing-site chrome (floating dark pill nav, ambient blob bg, glass
 * content card) via InfoPageShell. Content is honest about the early-access,
 * single-builder state of the platform: no fake compliance certifications,
 * no fake customer counts. */

const EMAIL = SHELL_EMAIL;
const EMAIL_HREF = SHELL_EMAIL_HREF;
const PRIVACY_EMAIL_HREF = `mailto:${EMAIL}?subject=AeroInsights%20Privacy%20Request`;
const SECURITY_EMAIL_HREF = `mailto:${EMAIL}?subject=AeroInsights%20Security%20Report`;

/* ─── PRIVACY POLICY ───────────────────────────────────────────────────────── */
export function PrivacyPage() {
  return (
    <InfoPageShell
      eyebrow="Legal"
      title="Privacy Policy"
      updated={LAST_UPDATED}
      intro={
        <>
          AeroInsights (&quot;we&quot;, &quot;us&quot;) is an aviation finance
          decision intelligence platform built and operated independently by
          Tanam Sethi from Dublin, Ireland. This policy explains what personal
          information we collect, why we collect it, how we use it, and the
          rights you have over it. We follow the principles of the EU General
          Data Protection Regulation (GDPR) and the Irish Data Protection Act
          2018.
        </>
      }
    >
      <H2 id="who-we-are">1. Who we are</H2>
      <P>
        AeroInsights is operated by Tanam Sethi, an individual based in Dublin,
        Ireland. We are the data controller for any personal information
        described in this policy. You can reach us at{" "}
        <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href={PRIVACY_EMAIL_HREF}>{EMAIL}</a>.
      </P>

      <H2 id="what-we-collect">2. Information we collect</H2>
      <P>We only collect information that is needed to operate the platform and to respond to people who reach out to us.</P>
      <UL>
        <li>
          <strong>Account information</strong> when you sign in: your name, email
          address, and profile picture, supplied by our identity provider (Auth0
          by Okta).
        </li>
        <li>
          <strong>Demo or contact information</strong> you submit voluntarily: name,
          email, company, role, and anything you write in the message field.
        </li>
        <li>
          <strong>Usage data</strong>: pages visited, features used, approximate
          location derived from IP, browser type, and similar diagnostic data.
        </li>
        <li>
          <strong>Portfolio data you upload</strong>: aircraft register fields,
          lease economics, and scenario inputs. This data stays in your
          workspace and is not used for any other purpose.
        </li>
      </UL>
      <P>
        We do not knowingly collect data from children under 16. We do not
        process special categories of personal data (health, biometrics,
        political views, etc.).
      </P>

      <H2 id="how-we-use">3. How we use your information</H2>
      <UL>
        <li>Authenticate you and keep your session secure.</li>
        <li>Provide, maintain, and improve the platform&apos;s features.</li>
        <li>Respond to demo requests, support questions, and feedback.</li>
        <li>Detect, prevent, and respond to abuse or security incidents.</li>
        <li>Send infrequent transactional emails (e.g. account, security).</li>
      </UL>
      <P>
        We do not sell your personal information. We do not use your portfolio
        data to train AI models, and we do not share it with third parties for
        their own marketing.
      </P>

      <H2 id="legal-bases">4. Legal bases for processing</H2>
      <UL>
        <li>
          <strong>Contract</strong>: to give you access to the platform when you
          have signed up or requested a demo.
        </li>
        <li>
          <strong>Legitimate interests</strong>: to keep the platform secure, to
          improve it, and to communicate with people who contact us.
        </li>
        <li>
          <strong>Consent</strong>: for non-essential cookies and any marketing
          communications you have opted into. See our{" "}
          <Link to="/cookies" className="font-semibold text-[#002147] underline-offset-4 hover:underline">Cookie Policy</Link>.
        </li>
        <li>
          <strong>Legal obligation</strong>: where we have to retain certain
          records (e.g. tax, accounting, or legal requests).
        </li>
      </UL>

      <H2 id="processors">5. Service providers</H2>
      <P>
        We rely on a small number of trusted infrastructure providers. Each
        operates as a data processor under our instructions and a written data
        processing agreement.
      </P>
      <UL>
        <li><strong>Vercel Inc.</strong> — hosting, edge delivery, deployment.</li>
        <li><strong>Auth0 by Okta</strong> — authentication and session management.</li>
        <li><strong>Supabase</strong> — database hosting for application data.</li>
        <li><strong>Google Workspace</strong> — email and calendar.</li>
        <li><strong>Cal.com</strong> — demo booking scheduler.</li>
      </UL>
      <P>
        Some of these providers are based in or transfer data to the United
        States. Where that happens we rely on the EU Standard Contractual
        Clauses or the EU&ndash;US Data Privacy Framework as the transfer
        mechanism.
      </P>

      <H2 id="retention">6. How long we keep data</H2>
      <UL>
        <li>Account data: kept for the lifetime of your account, plus 30 days after deletion request.</li>
        <li>Demo and contact messages: kept for 24 months, then deleted.</li>
        <li>Usage logs and diagnostics: kept for 90 days, then aggregated or deleted.</li>
        <li>Records we are legally required to retain: kept for the period required by Irish law.</li>
      </UL>

      <H2 id="rights">7. Your rights</H2>
      <P>Under GDPR you can ask us, at any time, to:</P>
      <UL>
        <li>Confirm whether we hold information about you and get a copy of it.</li>
        <li>Correct information that is wrong or incomplete.</li>
        <li>Delete your account and the personal information we hold about you.</li>
        <li>Restrict or object to certain types of processing.</li>
        <li>Receive a portable copy of the data you provided to us.</li>
        <li>Withdraw consent at any time where consent is the basis for processing.</li>
      </UL>
      <P>
        To exercise any of these rights, email{" "}
        <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href={PRIVACY_EMAIL_HREF}>{EMAIL}</a>.
        We will respond within 30 days. If you believe we have not handled your
        request properly, you can lodge a complaint with the Irish Data
        Protection Commission (dataprotection.ie).
      </P>

      <H2 id="security-link">8. How we protect your data</H2>
      <P>
        Read the{" "}
        <Link to="/security" className="font-semibold text-[#002147] underline-offset-4 hover:underline">Security</Link>{" "}
        page for the controls we have in place, including encryption in transit,
        least-privilege access, dependency auditing, and incident response.
      </P>

      <H2 id="changes">9. Changes to this policy</H2>
      <P>
        We may update this policy as the platform evolves. When we make
        material changes, we will update the &quot;Last updated&quot; date and,
        where appropriate, notify you in-app or by email.
      </P>
    </InfoPageShell>
  );
}

/* ─── TERMS OF SERVICE ─────────────────────────────────────────────────────── */
export function TermsPage() {
  return (
    <InfoPageShell
      eyebrow="Legal"
      title="Terms of Service"
      updated={LAST_UPDATED}
      intro={
        <>
          These Terms govern your access to and use of AeroInsights. By using
          the platform, booking a demo, creating an account, or otherwise
          interacting with the service, you agree to be bound by these Terms.
          If you do not agree, please do not use the platform.
        </>
      }
    >
      <H2 id="who">1. Who these terms are with</H2>
      <P>
        The platform is operated by Tanam Sethi, an individual based in Dublin,
        Ireland (&quot;AeroInsights&quot;, &quot;we&quot;, &quot;us&quot;).
        Contact:{" "}
        <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href={EMAIL_HREF}>{EMAIL}</a>.
      </P>

      <H2 id="service">2. The service</H2>
      <P>
        AeroInsights is a decision intelligence platform for aircraft lessors,
        financiers, and advisors. It provides portfolio analytics, scenario
        modelling, IFRS&nbsp;9 ECL workflows, deal generation tools, and an
        Excel add-in. The platform is offered &quot;as-is&quot; while it is in
        its current early access stage. Features may change, be added, or be
        removed without prior notice.
      </P>

      <H2 id="account">3. Accounts and access</H2>
      <UL>
        <li>You are responsible for maintaining the confidentiality of your sign-in credentials.</li>
        <li>You must give accurate information when registering or requesting a demo.</li>
        <li>You may not share your account with others or attempt to access another user&apos;s account.</li>
        <li>We can suspend or terminate accounts that violate these Terms or applicable law.</li>
      </UL>

      <H2 id="acceptable">4. Acceptable use</H2>
      <P>You agree not to:</P>
      <UL>
        <li>Use the platform for unlawful purposes or to violate any third party&apos;s rights.</li>
        <li>Reverse engineer, copy, or resell any part of the platform without written permission.</li>
        <li>Upload malicious code, scan for vulnerabilities without authorisation, or attempt to disrupt the service.</li>
        <li>Use scraping or automated tools to extract data beyond what the platform&apos;s features expose.</li>
        <li>Use the platform to build a competing product.</li>
      </UL>
      <P>
        Coordinated security research is welcome under our responsible
        disclosure programme on the{" "}
        <Link to="/security" className="font-semibold text-[#002147] underline-offset-4 hover:underline">Security</Link>{" "}
        page.
      </P>

      <H2 id="content">5. Your content</H2>
      <P>
        You retain all rights in the portfolio, scenario, and reference data you
        upload (&quot;Your Content&quot;). You grant us a limited licence to
        host, process, and display Your Content solely to operate and improve
        the platform for you. We do not use Your Content to train AI models and
        we do not share it with other customers.
      </P>

      <H2 id="ip">6. Our intellectual property</H2>
      <P>
        AeroInsights, the platform&apos;s name, logo, designs, source code,
        documentation, methodology, scenario templates, and underlying models
        remain the exclusive property of Tanam Sethi. Nothing in these Terms
        transfers any intellectual property rights to you beyond the limited
        right to use the platform as intended.
      </P>

      <H2 id="advice">7. Not investment, legal, or accounting advice</H2>
      <P>
        AeroInsights provides tooling and analytics. It does not provide
        investment, legal, tax, accounting, audit, or regulatory advice. All
        figures, scenarios, ECL outputs, and projections are estimates produced
        from inputs you provide. You are solely responsible for the decisions
        you make using the platform and for ensuring any reporting based on its
        outputs is reviewed and signed off by qualified professionals.
      </P>

      <H2 id="warranty">8. Disclaimer of warranties</H2>
      <P>
        The platform is provided on an &quot;as-is&quot; and &quot;as
        available&quot; basis. We do not warrant that it will be uninterrupted,
        error-free, free from defects, or that any specific result will be
        achieved. We disclaim all implied warranties to the maximum extent
        permitted by law, including fitness for a particular purpose and
        non-infringement.
      </P>

      <H2 id="liability">9. Limitation of liability</H2>
      <P>
        To the maximum extent permitted by law, AeroInsights will not be liable
        for any indirect, incidental, special, consequential, or punitive
        damages, or for any loss of profits, revenue, data, or goodwill,
        whether based in contract, tort, or any other legal theory. Our total
        aggregate liability for any claim arising out of or relating to the
        platform will not exceed the greater of the fees you paid in the 12
        months preceding the claim, or one hundred euro (&euro;100). Nothing in
        these Terms limits liability for fraud, gross negligence, or for any
        liability that cannot be limited by law.
      </P>

      <H2 id="indemnity">10. Indemnity</H2>
      <P>
        You agree to indemnify and hold us harmless from any third-party claim
        arising from your misuse of the platform, your violation of these Terms,
        or your violation of any applicable law.
      </P>

      <H2 id="termination">11. Termination</H2>
      <P>
        You may stop using the platform at any time. We may suspend or terminate
        your access if you breach these Terms or if we discontinue the service.
        On termination, the provisions of sections 5 to 10 survive.
      </P>

      <H2 id="law">12. Governing law</H2>
      <P>
        These Terms are governed by the laws of Ireland. Any dispute will be
        subject to the exclusive jurisdiction of the courts of Ireland, except
        where applicable consumer law gives you the right to use your local
        courts.
      </P>

      <H2 id="changes-terms">13. Changes to these terms</H2>
      <P>
        We may update these Terms from time to time. When we make material
        changes we will revise the &quot;Last updated&quot; date and, where
        appropriate, notify you in-app or by email. Continued use of the
        platform after a change means you accept the updated Terms.
      </P>
    </InfoPageShell>
  );
}

/* ─── SECURITY ─────────────────────────────────────────────────────────────── */
export function SecurityPage() {
  return (
    <InfoPageShell
      eyebrow="Trust"
      title="Security"
      updated={LAST_UPDATED}
      intro={
        <>
          We treat the security of the platform and your data as a first-class
          concern, not a checkbox at the end. This page summarises the controls
          currently in place and how to report a security issue. AeroInsights is
          built and operated by a single engineer, so the controls below favour
          modern managed infrastructure over bespoke systems wherever that
          choice reduces risk.
        </>
      }
    >
      <H2 id="architecture">1. Architecture and hosting</H2>
      <UL>
        <li>Hosted on Vercel, with edge delivery and automatic TLS for every domain.</li>
        <li>Application database hosted on Supabase (managed PostgreSQL).</li>
        <li>Authentication delegated to Auth0 by Okta, with email and social sign-in.</li>
        <li>Static assets and the marketing site are served over HTTPS with HSTS.</li>
      </UL>

      <H2 id="encryption">2. Encryption</H2>
      <UL>
        <li>All traffic between your browser and our servers is encrypted using TLS&nbsp;1.2 or higher.</li>
        <li>Data at rest in our database and object storage is encrypted with AES-256 by the underlying provider.</li>
        <li>Secrets and API keys are stored in Vercel encrypted environment variables and never committed to source.</li>
      </UL>

      <H2 id="access">3. Access control</H2>
      <UL>
        <li>Production access is restricted to authorised maintainers. SSO with a hardware-backed second factor is required.</li>
        <li>Access to user data follows least privilege. Logs are kept of administrative actions.</li>
        <li>Customer accounts are protected by the authentication policy you configure in Auth0 (e.g. MFA, password rules).</li>
        <li>Session tokens are short-lived and rotated on sensitive actions.</li>
      </UL>

      <H2 id="sdlc">4. Secure development</H2>
      <UL>
        <li>All code is reviewed before deployment. Every change ships through a Vercel preview environment first.</li>
        <li>Dependencies are scanned automatically; high or critical vulnerabilities trigger a fix before the next release.</li>
        <li>Static analysis and type checking run on every pull request.</li>
        <li>We avoid storing more user data than we need, and never log full request bodies that may contain personal information.</li>
      </UL>

      <H2 id="data">5. Customer data isolation</H2>
      <P>
        Each workspace&apos;s data is scoped by an organisation identifier at
        the database layer. Application queries enforce this scoping in every
        read and write. We do not use customer portfolio data to train AI models
        and we do not share it across customers.
      </P>

      <H2 id="incident">6. Incident response</H2>
      <UL>
        <li>We monitor uptime, error rates, and authentication anomalies.</li>
        <li>If we identify an incident that affects customer data, we will investigate, contain it, and notify affected customers without undue delay (and in line with GDPR Art. 33 for personal data).</li>
        <li>Post-incident, we publish an internal write-up and address the root cause.</li>
      </UL>

      <H2 id="backup">7. Backups and continuity</H2>
      <UL>
        <li>The application database is backed up daily with point-in-time recovery enabled.</li>
        <li>Backups are encrypted and stored in a separate region.</li>
        <li>We exercise restore procedures periodically to verify they work.</li>
      </UL>

      <H2 id="disclosure">8. Responsible disclosure</H2>
      <P>
        If you believe you have found a security vulnerability, please email{" "}
        <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href={SECURITY_EMAIL_HREF}>{EMAIL}</a>{" "}
        with the subject line &quot;Security Report&quot;. We commit to
        acknowledging valid reports within 72 hours and to keeping you updated
        as we triage and remediate. Please do not test for vulnerabilities in a
        way that disrupts service, exfiltrates data, or affects other users.
      </P>

      <H2 id="not-yet">9. What we are still building</H2>
      <P>
        AeroInsights is in early access. We are working towards a formal SOC 2
        Type II report and a documented penetration testing programme. Until
        those are available we are happy to walk prospective customers through
        our current controls in detail, share architecture diagrams, and answer
        security questionnaires. Email{" "}
        <a className="font-semibold text-[#002147] underline-offset-4 hover:underline" href={EMAIL_HREF}>{EMAIL}</a>.
      </P>
    </InfoPageShell>
  );
}

/* ─── COOKIE POLICY ────────────────────────────────────────────────────────── */
export function CookiePage() {
  return (
    <InfoPageShell
      eyebrow="Legal"
      title="Cookie Policy"
      updated={LAST_UPDATED}
      intro={
        <>
          This page explains what cookies and similar technologies AeroInsights
          uses, why we use them, and how you can control them. It complements
          our{" "}
          <Link to="/privacy" className="font-semibold text-[#002147] underline-offset-4 hover:underline">Privacy Policy</Link>.
        </>
      }
    >
      <H2 id="what">1. What are cookies?</H2>
      <P>
        Cookies are small text files that a website places on your device. They
        let the site remember information about your visit, such as your sign-in
        state. We also use related technologies, like browser local storage and
        session storage, which work in a similar way. In this policy we refer
        to all of these as &quot;cookies&quot;.
      </P>

      <H2 id="categories">2. Categories we use</H2>
      <P>We group the cookies on our site into four categories:</P>

      <H2 id="essential">2.1 Strictly necessary</H2>
      <P>
        These cookies are required for the site to work. They cannot be turned
        off. Examples: Auth0 session cookies that keep you signed in, CSRF
        protection tokens, and remembering your portfolio selection for the
        duration of a session.
      </P>

      <H2 id="functional">2.2 Functional</H2>
      <P>
        These cookies remember choices you make so the site behaves the way you
        prefer. Examples: theme (light or dark) preference, sidebar collapsed
        state, last visited section.
      </P>

      <H2 id="analytics">2.3 Analytics</H2>
      <P>
        These cookies help us understand how the platform is used so we can
        improve it. We use Vercel Analytics, which is privacy-friendly,
        cookieless on the marketing site, and does not track you across
        websites. Where it sets a cookie inside the application it is to
        attribute repeat sessions to the same anonymous identifier.
      </P>

      <H2 id="marketing">2.4 Marketing</H2>
      <P>
        We do not currently run advertising campaigns or set third-party
        marketing cookies. If that changes we will update this policy and ask
        for your consent before any marketing cookie is set.
      </P>

      <H2 id="control">3. How to control cookies</H2>
      <UL>
        <li>
          <strong>In the platform</strong>: the cookie banner you saw on first
          visit lets you accept or reject non-essential cookies. You can change
          this choice at any time from the footer link &quot;Cookie
          preferences&quot;.
        </li>
        <li>
          <strong>In your browser</strong>: every modern browser lets you
          delete existing cookies and block new ones. See aboutcookies.org for
          step-by-step instructions per browser.
        </li>
        <li>
          <strong>Do Not Track</strong>: we honour the Global Privacy Control
          signal where your browser sends it.
        </li>
      </UL>
      <P>
        Disabling strictly necessary cookies will prevent core features such as
        sign-in from working. Disabling functional cookies will reset your
        preferences each visit.
      </P>

      <H2 id="changes-cookies">4. Changes</H2>
      <P>
        We may update this policy as the cookies we use change. When we do, we
        will revise the &quot;Last updated&quot; date and, for material
        changes, surface a fresh consent prompt in the application.
      </P>
    </InfoPageShell>
  );
}
