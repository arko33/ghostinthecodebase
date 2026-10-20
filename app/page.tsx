import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Check,
  Cpu,
  GitBranch,
  Layers,
  Microscope,
  Radar,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";
import SiteFooter from "@/src/components/site/SiteFooter";
import SiteNav from "@/src/components/site/SiteNav";

const STEPS = [
  {
    n: "01",
    icon: Radar,
    title: "Record",
    body: "A shadow git commit per change burst. Runtime metrics sampled straight from the app. Nothing is installed into your agent.",
    tag: "passive",
  },
  {
    n: "02",
    icon: Microscope,
    title: "Attribute",
    body: "Thresholds catch the spike, trend slope separates a leak from a busy minute, and a per-turn bisect names the prompt that introduced it.",
    tag: "autopsy",
  },
  {
    n: "03",
    icon: RotateCcw,
    title: "Reverse",
    body: "Roll the blamed turn back, re-measure, and watch the curve flatten. The fix prompt is one click from the clipboard.",
    tag: "time travel",
  },
];

const FEATURES = [
  {
    icon: Radar,
    title: "Black-box recorder",
    body: "Shadow git commits every change burst, so the timeline is built from what actually landed on disk — not from what an agent says it did.",
  },
  {
    icon: Microscope,
    title: "Autopsy engine",
    body: "Four signal types — memory, CPU, latency, error rate — plus a slope test that tells a leak from a load spike, attributed to a single turn.",
  },
  {
    icon: Boxes,
    title: "3D code city",
    body: "Modules become districts, files become towers, imports become arcs. AI-written code glows amber, unreviewed code sits under fog.",
  },
  {
    icon: RotateCcw,
    title: "One-click rollback",
    body: "Restore the blamed file to the commit before the regression, then watch the metric line drop back to baseline in the same view.",
  },
  {
    icon: GitBranch,
    title: "Agent-agnostic",
    body: "Cursor, Claude Code, Codex, OpenCode, or a human with a keyboard. Ghost watches the filesystem and the process, so it never needs an integration.",
  },
  {
    icon: ShieldCheck,
    title: "TestSprite-native",
    body: "The live API is covered by a TestSprite suite that runs on every pull request, so the regression guard keeps working after the demo ends.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(31,41,55,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(31,41,55,0.35)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
          </div>

          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:py-24 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <span className="chip border-accent/30 bg-accent/10 text-accent">
                <Sparkles className="h-2.5 w-2.5" />
                TestSprite Season 4 · Project track
              </span>

              <h1 className="mt-5 text-[34px] font-semibold leading-[1.12] tracking-tight sm:text-[44px]">
                Your agent shipped a bug.
                <br />
                <span className="bg-gradient-to-r from-accent to-human bg-clip-text text-transparent">
                  Ghost shows you which prompt did it.
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-dim">
                GhostInTheCodebase is a black-box recorder for AI coding agents. It
                captures every turn, watches the app at runtime, attributes the
                regression to the exact prompt — then rewinds the file in one click.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Link
                  href="/playground"
                  className="inline-flex items-center gap-1.5 rounded-md border border-accent/50 bg-accent/20 px-4 py-2 text-[13px] font-medium text-accent transition-colors hover:bg-accent/30"
                >
                  Open the playground
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#how"
                  className="inline-flex items-center gap-1.5 rounded-md border border-line bg-elev px-4 py-2 text-[13px] text-[#e6edf3] transition-colors hover:border-accent/40"
                >
                  <Layers className="h-4 w-4 text-dim" />
                  See the loop
                </a>
              </div>

              <p className="mt-4 font-mono text-[10.5px] text-dim/70">
                agent-agnostic · no SDK · no agent cooperation required
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-[420px]">
              <div className="pointer-events-none absolute inset-6 -z-10 rounded-full bg-accent/25 blur-3xl" />
              <div className="overflow-hidden rounded-2xl border border-line bg-panel/60 p-3 shadow-panel">
                <img
                  src="/ghost-512.png"
                  alt="GhostInTheCodebase"
                  width={512}
                  height={512}
                  className="h-auto w-full rounded-xl"
                />
              </div>

              <div className="absolute -bottom-6 -left-3 w-[248px] rounded-lg border border-danger/35 bg-ink/95 p-3 shadow-panel backdrop-blur sm:-left-6">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-danger">
                  <Microscope className="h-3 w-3" />
                  Autopsy · leak
                </div>
                <div className="mt-1 font-mono text-[10px] text-dim">
                  turn 04 · src/store/invoices.ts
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-[#dfe7f1]">
                  Module-level Map cache with no eviction policy.
                </p>
                <div className="mt-2 inline-flex items-center gap-1 rounded border border-ok/40 bg-ok/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-ok">
                  <Check className="h-2.5 w-2.5" /> healed
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-panel/30">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-6 sm:grid-cols-4">
            {[
              { v: "0", l: "integrations to install" },
              { v: "3", l: "lenses: timeline · diff · city" },
              { v: "4", l: "runtime signals tracked" },
              { v: "1", l: "click to roll back" },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-mono text-[22px] font-semibold text-[#e6edf3]">
                  {s.v}
                </div>
                <div className="mt-0.5 text-[11px] text-dim">{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-line bg-panel/50 p-5">
              <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-dim">
                <ShieldCheck className="h-3.5 w-3.5" />
                The checker
              </div>
              <h2 className="mt-3 text-[18px] font-semibold">
                TestSprite tells you the PR is red.
              </h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
                Every pull request gets a verdict. It catches the regression before
                it merges — but the verdict is a symptom, not a cause.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded border border-danger/40 bg-danger/10 px-2 py-1 text-[10.5px] text-danger">
                <X className="h-3 w-3" /> 1 test failed · who broke it?
              </div>
            </div>

            <div className="rounded-lg border border-accent/30 bg-accent/[0.06] p-5">
              <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-accent">
                <Microscope className="h-3.5 w-3.5" />
                The black box
              </div>
              <h2 className="mt-3 text-[18px] font-semibold">
                Ghost tells you which prompt turned it red.
              </h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
                The turn, the diff, the metric that moved, and the file to roll back.
                Different layer of the same loop — behind the maker, not the merge.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded border border-accent/40 bg-accent/10 px-2 py-1 text-[10.5px] text-accent">
                <Check className="h-3 w-3" /> turn 04 · cache leak · rollback ready
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="border-t border-line bg-panel/20">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="max-w-2xl">
              <span className="section-title">
                <Terminal className="h-3.5 w-3.5 text-accent" />
                The loop
              </span>
              <h2 className="mt-3 text-[26px] font-semibold tracking-tight">
                Three verbs. One repeat.
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-dim">
                Record what happened, attribute the regression, reverse the damage.
                Then the agent tries again — with the autopsy in hand.
              </p>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className="rounded-lg border border-line bg-panel/60 p-5 transition-colors hover:border-accent/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-8 w-8 place-items-center rounded-md border border-accent/30 bg-accent/10 text-accent">
                      <s.icon className="h-4 w-4" />
                    </span>
                    <span className="font-mono text-[10px] text-dim/60">{s.n}</span>
                  </div>
                  <h3 className="mt-3 text-[14px] font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-dim">{s.body}</p>
                  <span className="mt-3 inline-block rounded border border-line px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-dim/80">
                    {s.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-16">
          <div className="max-w-2xl">
            <span className="section-title">
              <Cpu className="h-3.5 w-3.5 text-human" />
              What is inside
            </span>
            <h2 className="mt-3 text-[26px] font-semibold tracking-tight">
              Built to be trusted when the agent is not.
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-dim">
              Every claim in the dashboard comes from something Ghost observed —
              files on disk, memory in the process, responses from the app.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-line bg-panel/50 p-4 transition-colors hover:border-line/80 hover:bg-panel"
              >
                <span className="grid h-7 w-7 place-items-center rounded-md border border-line bg-elev text-dim">
                  <f.icon className="h-3.5 w-3.5" />
                </span>
                <h3 className="mt-3 text-[13px] font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-dim">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="relative overflow-hidden rounded-xl border border-accent/30 bg-gradient-to-br from-accent/10 via-panel to-human/10 p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[20px] font-semibold tracking-tight">
                  Replay a real autopsy.
                </h2>
                <p className="mt-1.5 max-w-lg text-[12.5px] leading-relaxed text-dim">
                  Seven turns, one unbounded cache, one heal. Scrub the timeline,
                  read the diff, rotate the city, and copy the fix prompt.
                </p>
              </div>
              <Link
                href="/playground"
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-accent/50 bg-accent/25 px-4 py-2 text-[13px] font-medium text-accent transition-colors hover:bg-accent/35"
              >
                Open playground
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
