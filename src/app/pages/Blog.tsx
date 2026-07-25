import { Link } from "react-router";
import {
  InfoPageShell,
  H2,
  P,
  UL,
} from "../components/site/InfoPageShell";

/* Blog page — an aviation finance industry news and commentary blog.
 * Posts are editorial pieces written by the founder, based on publicly
 * observable industry dynamics. No fabricated quotes, no fabricated
 * statistics, no claims of insider knowledge. Posts cover what is
 * happening in the lessor / financier / advisor space and what it
 * means for portfolio analytics, risk, and decision tooling. */

type Category = "Market" | "Risk & Regulation" | "Capital" | "Technology";

type Post = {
  slug: string;
  title: string;
  date: string;
  readTime: string;
  category: Category;
  excerpt: string;
};

const POSTS: Post[] = [
  {
    slug: "narrowbody-scarcity",
    title: "Narrowbody scarcity is no longer a 2024 story",
    date: "20 June 2026",
    readTime: "5 min read",
    category: "Market",
    excerpt:
      "OEM delivery delays and engine-shop turnaround times have kept narrowbody supply tight for a third year. Lease rates, residual values, and re-lease conversations are all responding.",
  },
  {
    slug: "ifrs9-this-cycle",
    title: "IFRS 9 ECL: what auditors are pushing on this cycle",
    date: "8 June 2026",
    readTime: "8 min read",
    category: "Risk & Regulation",
    excerpt:
      "Three areas are coming up in nearly every aviation lessor audit this cycle: staging triggers, macro overlays, and the documentation trail behind scenario weighting. None are new requirements. All are being asked about with sharper teeth.",
  },
  {
    slug: "consolidation-portfolio-effects",
    title: "Lessor consolidation: portfolio-side effects the analytics teams feel first",
    date: "29 May 2026",
    readTime: "6 min read",
    category: "Capital",
    excerpt:
      "Every major lessor combination of the past five years has reshaped concentration, jurisdiction exposure, and counterparty overlap. The analytics teams inherit those changes long before the legal entities finish merging.",
  },
  {
    slug: "spreadsheet-risk",
    title: "The spreadsheet problem in aviation finance is a model-risk problem",
    date: "15 May 2026",
    readTime: "5 min read",
    category: "Technology",
    excerpt:
      "Spreadsheets are still the dominant analytical surface for lease economics, IFRS 9 staging, and deal sketches. They are also the most common source of avoidable model errors. Treating spreadsheet risk as a model-risk discipline changes the conversation.",
  },
  {
    slug: "sustainability-linked-leases",
    title: "Sustainability-linked lease structures: an emerging product category",
    date: "30 April 2026",
    readTime: "4 min read",
    category: "Capital",
    excerpt:
      "A handful of lessors are quietly experimenting with rent adjustments tied to fuel-burn, emissions reporting, or SAF uptake. The structures are still ad hoc, but the direction of travel is clear.",
  },
];

const CAT_COLOR: Record<Category, string> = {
  Market: "bg-blue-100 text-blue-800",
  "Risk & Regulation": "bg-amber-100 text-amber-800",
  Capital: "bg-emerald-100 text-emerald-800",
  Technology: "bg-violet-100 text-violet-800",
};

function CategoryChip({ c }: { c: Category }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CAT_COLOR[c]}`}
    >
      {c}
    </span>
  );
}

function PostCard({ post }: { post: Post }) {
  return (
    <a
      href={`#${post.slug}`}
      onClick={(e) => {
        e.preventDefault();
        document.getElementById(post.slug)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }}
      className="group flex flex-col rounded-2xl border border-white/60 bg-white/75 p-5 shadow-sm backdrop-blur-md transition hover:border-[#002147]/25 hover:shadow-lg hover:shadow-[#002147]/10"
    >
      <div className="flex items-center gap-2">
        <CategoryChip c={post.category} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#002147]/55">
          {post.date} · {post.readTime}
        </p>
      </div>
      <p className="mt-2.5 text-base font-bold leading-snug tracking-tight text-gray-950">
        {post.title}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-gray-600">{post.excerpt}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#002147]">
        Read post
        <i className="bi bi-arrow-right text-[10px] transition-transform duration-300 group-hover:translate-x-1" />
      </span>
    </a>
  );
}

function PostHeading({ post }: { post: Post }) {
  return (
    <>
      <H2 id={post.slug}>{post.title}</H2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <CategoryChip c={post.category} />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#002147]/55">
          {post.date} · {post.readTime} · By Tanam Sethi
        </p>
      </div>
    </>
  );
}

export function BlogPage() {
  return (
    <InfoPageShell
      eyebrow="Industry Blog"
      title="Aviation Finance, Read Twice"
      intro={
        <>
          News, commentary, and analysis on the dynamics shaping aviation
          finance. Written for lessors, financiers, and advisors who want
          a second pass on the headlines, with a view toward what the
          numbers and structures actually mean for portfolios. Posts are
          editorial perspective drawn from publicly observable industry
          dynamics; nothing here is insider information or a quote from a
          named third party.
        </>
      }
    >
      <H2 id="latest">Latest posts</H2>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {POSTS.map((p) => (
          <PostCard key={p.slug} post={p} />
        ))}
      </div>

      {/* ───────────────────────── POST 1 ───────────────────────── */}
      <PostHeading post={POSTS[0]} />
      <P>
        The narrative around narrowbody scarcity has moved from a
        post-pandemic anomaly to a structural feature of the market.
        Three pressures have stacked on top of each other and have not
        eased: OEM delivery delays on the 737 and A320neo programmes,
        long engine shop-visit turnaround times that pull aircraft out
        of service for longer than fleet plans assume, and operator
        appetite that has not given up on growth despite higher rates.
      </P>
      <P>
        For a lessor portfolio that signals through to three places at
        once:
      </P>
      <UL>
        <li>
          <strong>Lease rate factors</strong> on new placements are
          firmer than the cycle-on-cycle base would suggest. Renewal
          conversations open from a stronger position than two years
          ago.
        </li>
        <li>
          <strong>Residual values</strong> on mid-life narrowbodies are
          holding more weight in stress scenarios than originally
          modelled at lease origination. The Stage&nbsp;2 conversation
          gets shorter when underlying asset values are flat-to-up
          versus the baseline curve.
        </li>
        <li>
          <strong>Re-lease pipelines</strong> are clearing faster, with
          shorter idle gaps. Modelling re-lease assumptions with the
          historical idle-gap mean is probably leaving value on the
          table; pulling assumptions toward the recent observed tail
          looks more defensible right now.
        </li>
      </UL>
      <P>
        None of this guarantees the trend continues. OEMs are working
        hard to clear delays, and the moment supply meaningfully eases,
        every one of the lines above reverses. The point is that, for
        the moment, &quot;narrowbody scarcity&quot; should be a base-case
        assumption rather than an upside surprise.
      </P>

      {/* ───────────────────────── POST 2 ───────────────────────── */}
      <PostHeading post={POSTS[1]} />
      <P>
        Audit feedback this reporting cycle has been remarkably
        consistent across firms. Three themes are coming up in nearly
        every aviation lessor engagement, none of them new but all
        being pressed harder than in prior cycles.
      </P>

      <P>
        <strong>1. Staging triggers need to be defensible, not
        discretionary.</strong> The most common comment is on the
        threshold logic that moves an exposure from Stage&nbsp;1 to
        Stage&nbsp;2. Where the threshold is &quot;a significant
        increase in credit risk&quot; without a written quantitative
        anchor, expect a follow-up. A documented PD-delta threshold
        (e.g. lifetime PD up X% versus origination), paired with manual
        triggers tied to specific events, is the configuration that
        survives review. Symmetric cure logic on the way back to
        Stage&nbsp;1 matters just as much.
      </P>

      <P>
        <strong>2. Macro overlays need a paper trail.</strong>
        Forward-looking macro overlays are part of the standard, but
        the documentation trail behind them is often thin. Auditors
        this cycle want to see: which macro variables drive which PD
        shifts, who approved the calibration, what changed since the
        last reporting date, and what the scenario weights are. A
        scenario weighting that has not moved in eighteen months
        through a turbulent macro environment is itself a question.
      </P>

      <P>
        <strong>3. The waterfall has to tie out.</strong> The ECL
        movement waterfall between two reporting dates is the artifact
        that gets the most scrutiny. Movements attributable to staging
        migration, parameter updates, macro overlays, and new business
        each need to reconcile back to the moves in the underlying
        portfolio register. Where they do not, the ask is to show the
        bridge. Modelling tools that produce the waterfall as a
        first-class output, not as a downstream report, save a meaningful
        amount of cycle time. The Risk &amp; ECL module documented under{" "}
        <Link to="/docs#ecl-methodology" className="font-semibold text-[#002147] underline-offset-4 hover:underline">
          methodology
        </Link>{" "}
        is built around exactly this expectation.
      </P>

      {/* ───────────────────────── POST 3 ───────────────────────── */}
      <PostHeading post={POSTS[2]} />
      <P>
        Every major lessor combination of the past five years has
        triggered a quieter, longer-tail body of work on the analytics
        side. Legal close happens on a date. Concentration metrics,
        jurisdiction exposure, and counterparty overlap rebalance
        immediately. The analytical teams that have to make sense of
        the combined portfolio inherit the rebalancing the morning
        after.
      </P>

      <P>
        Three portfolio-side effects show up almost every time:
      </P>

      <UL>
        <li>
          <strong>Concentration ceilings get tested.</strong> Pre-merger
          single-lessee and single-jurisdiction limits often get
          breached on day one of the combined portfolio. Decisions then
          have to be made between selling down exposure, renegotiating
          internal limits, or running with a documented exception.
        </li>
        <li>
          <strong>Rating master overlap creates duplication.</strong>
          Two firms with different internal rating frameworks rarely
          produce the same rating for the same lessee. Reconciling and
          choosing the canonical rating is a real chunk of work, and
          while it is being done the ECL output is genuinely uncertain.
        </li>
        <li>
          <strong>Reporting templates diverge.</strong> The board pack
          format, the auditor template, and the regulatory submission
          format are rarely identical pre-merger. Picking the surviving
          template, mapping the legacy fields, and reproducing the
          historical run for comparability is a six-month project
          dressed up as a one-week ask.
        </li>
      </UL>

      <P>
        None of these are blockers. They are the kind of work that
        comes up because the modelling pipeline was not designed for
        portfolios that change shape overnight. Building the pipeline
        so it scales smoothly with combined portfolios, rather than
        being rebuilt for each combination, is the underlying lesson.
      </P>

      {/* ───────────────────────── POST 4 ───────────────────────── */}
      <PostHeading post={POSTS[3]} />
      <P>
        Aviation finance still runs on spreadsheets. That is not a
        complaint, it is a fact. Lease economics, IFRS&nbsp;9 staging,
        deal sketches, sensitivity analysis: most teams open Excel for
        all of them, every day. Spreadsheets are flexible, transparent,
        and immediately auditable by anyone in the team. They are also
        the most common single source of avoidable analytical errors
        across the industry.
      </P>
      <P>
        Treating spreadsheet risk as a model-risk discipline, rather
        than as an unspoken team habit, changes the conversation. A
        spreadsheet that drives a real decision is a model. It needs:
      </P>
      <UL>
        <li>An owner who is responsible for its calculations.</li>
        <li>A change log: who changed what, when, and why.</li>
        <li>A challenge: an independent re-implementation that produces the same number.</li>
        <li>An expiry: a date by which it needs to be either rebuilt or retired.</li>
      </UL>
      <P>
        Most spreadsheets in the industry today fail at least two of
        those four criteria. Tooling can help with three of them
        (change log, challenge, owner), and the AeroInsights Excel
        add-in is one attempt to push in that direction: keep Excel as
        the surface, and let the platform behind it be the source of
        truth for the inputs and the calculations. Read more about how
        the add-in works under{" "}
        <Link to="/docs#excel-functions" className="font-semibold text-[#002147] underline-offset-4 hover:underline">
          Documentation
        </Link>
        .
      </P>

      {/* ───────────────────────── POST 5 ───────────────────────── */}
      <PostHeading post={POSTS[4]} />
      <P>
        A small number of lessors have begun experimenting with lease
        structures whose rent steps up or down based on operational
        sustainability metrics. The variants seen publicly so far have
        included: rent adjustments tied to year-on-year fuel-burn per
        ASK, step-downs linked to SAF uptake commitments, and incentive
        rebates tied to verified emissions reporting against an
        agreed baseline.
      </P>
      <P>
        These structures are still ad hoc. The metric definitions
        differ between lessors, the verification mechanisms are still
        being designed, and the financial impact in any given year is
        usually small enough that they read as relationship-building
        gestures rather than material economics. That is exactly what
        early-stage product categories look like.
      </P>
      <P>
        For analytics teams, the implication is not urgent but it is
        worth pre-empting. As the structures mature, sustainability
        adjustments will start to appear as a recurring line item in
        the rent waterfall, alongside step-ups, MR offsets, and
        contingent rent. Treating them as a first-class field in the
        lease model now, rather than retrofitting them after the
        structures become standard, will save time later.
      </P>

      <H2 id="contribute">A note on this blog</H2>
      <P>
        This blog is editorial commentary, not breaking news. Posts
        appear when there is something worth saying, not on a publishing
        schedule. If you would like to flag a topic you think deserves
        coverage, or if you think any of the pieces above misreads the
        industry, please write in. The address is on the{" "}
        <Link to="/about" className="font-semibold text-[#002147] underline-offset-4 hover:underline">
          About
        </Link>{" "}
        page.
      </P>
    </InfoPageShell>
  );
}
