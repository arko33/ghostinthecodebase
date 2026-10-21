"use client";

import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  Circle,
  Clock,
  GithubLogo,
  GitCommit,
  Scan,
  ShieldWarning,
  Sparkle,
  Stack,
  Terminal as TerminalIcon,
} from "@phosphor-icons/react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { demoSession } from "@/src/data/fixture";
import { GITHUB_URL, HERO_BADGE, PLAYGROUND_URL } from "@/src/data/site";
import Badge from "./Badge";
import Button from "./Button";
import CopyButton from "./CopyButton";
import CountUp from "./CountUp";
import GhostMark from "./GhostMark";
import { clamp, useMotionReady, useReducedMotion } from "./hooks";
import Marquee from "./Marquee";
import MetricsSvg from "./MetricsSvg";
import Preloader from "./Preloader";
import SceneLayer from "./SceneLayer";
import ScrollProgress from "./ScrollProgress";
import SectionHead from "./SectionHead";
import SiteFooter from "./SiteFooter";
import SiteNav from "./SiteNav";
import Terminal from "./Terminal";
import TiltCard from "./TiltCard";
import { createScrollSignals } from "./scroll";

const turns = demoSession.turns;
const metrics = demoSession.metrics;
const autopsy = demoSession.autopsies[0];
const anomaly = demoSession.anomalies[0];

const peakMemory = Math.max(...metrics.map((sample) => sample.mem));
const peakCpu = Math.max(...metrics.map((sample) => sample.cpu));
const blamedTurn = turns.find((turn) => turn.id === "t4");
const blamedDiff = blamedTurn?.diff[0];

const LOOP_STEPS = [
  {
    kicker: "Record",
    title: "Record",
    body: "A shadow git commit per change burst. Runtime metrics sampled from /api/health. An HTTP probe for latency and errors.",
    facts: ["Shadow commit", "HEAD untouched", "7 turns · 28 samples"],
    hot: false,
  },
  {
    kicker: "Attribute",
    title: "Attribute",
    body: "Threshold check. Trend slope. A per-turn bisect. Ghost names the exact turn that introduced the regression.",
    facts: ["Turn 4 · invoices.ts", "+38 MB per sample", "leak · high"],
    hot: true,
  },
  {
    kicker: "Reverse",
    title: "Reverse",
    body: "Roll the blamed file back to the pre-regression commit. Re-measure. Watch the curve flatten.",
    facts: ["One click", "Re-measured", "healed"],
    hot: false,
  },
];

export default function LandingPage() {
  const reduced = useReducedMotion();
  useMotionReady();

  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [sceneActive, setSceneActive] = useState(true);

  const signals = useRef(createScrollSignals());
  const loopRef = useRef<HTMLElement>(null);
  const finalRef = useRef<HTMLElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const onPreloaderDone = useCallback(() => setReady(true), []);

  useEffect(() => {
    const signalsRef = signals.current;
    let frame = 0;
    let lastY = window.scrollY;

    const update = () => {
      const doc = document.documentElement;
      const y = window.scrollY;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);

      signalsRef.page = clamp(y / max, 0, 1);
      signalsRef.velocity = y - lastY;
      lastY = y;

      const loopEl = loopRef.current;
      if (loopEl) {
        const total = Math.max(
          1,
          loopEl.offsetHeight - window.innerHeight,
        );
        const local = reduced
          ? 1
          : clamp((y - loopEl.offsetTop) / total, 0, 1);
        signalsRef.loop = local;
        const record = reduced ? 1 : clamp(local / 0.32, 0, 1);
        loopEl.style.setProperty("--loop", local.toFixed(4));
        loopEl.style.setProperty("--record", record.toFixed(4));

        const next = local < 0.33 ? 0 : local < 0.66 ? 1 : 2;
        setStep((current) => (current === next ? current : next));
      }

      const loopBottom = loopEl
        ? loopEl.offsetTop + loopEl.offsetHeight
        : 0;
      const finalTop = finalRef.current
        ? finalRef.current.offsetTop
        : Number.POSITIVE_INFINITY;
      const active =
        y < loopBottom + 80 ||
        y + window.innerHeight > finalTop + 40;
      setSceneActive((current) => (current === active ? current : active));
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        update();
        frame = 0;
      });
    };

    const onPointer = (event: PointerEvent) => {
      if (reduced) return;
      signalsRef.mouseX =
        (event.clientX / window.innerWidth - 0.5) * 2;
      signalsRef.mouseY =
        (event.clientY / window.innerHeight - 0.5) * 2;
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pointermove", onPointer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduced]);

  return (
    <>
      <Preloader onDone={onPreloaderDone} />
      <ScrollProgress />
      <SceneLayer signals={signals} active={sceneActive} reduced={reduced} />
      <div className="page-noise" aria-hidden="true" />
      <div ref={glowRef} className="cursor-glow" aria-hidden="true" />
      <SiteNav />

      <main id="main" className="page-main">
        {/* ---------------------------------------------------------------- */}
        {/* Hero                                                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="hero" data-enter={ready ? "true" : "false"}>
          <div className="hero__scrim" aria-hidden="true" />
          <div className="container hero__content">
            <div className="hero__eyebrow-row">
              <Badge tone="violet">{HERO_BADGE}</Badge>
              <Badge dot={false}>
                {turns.length} turns · {metrics.length} samples
              </Badge>
            </div>

            <h1 className="hero__title">
              <span className="hero__line">
                <span
                  className="hero__line-inner"
                  style={{ "--line": 0 } as CSSProperties}
                >
                  See what the AI builds.
                </span>
              </span>
              <span className="hero__line">
                <span
                  className="hero__line-inner"
                  style={{ "--line": 1 } as CSSProperties}
                >
                  Know when it <em>breaks it.</em>
                </span>
              </span>
            </h1>

            <div className="hero__bottom">
              <div>
                <p className="hero__sub">
                  Ghost records every agent turn,{" "}
                  <strong>blames the exact prompt</strong> that introduced the
                  regression, and rolls the file back in one click.
                </p>
                <div className="hero__actions">
                  <Button
                    href={PLAYGROUND_URL}
                    size="lg"
                    icon={
                      <ArrowUpRight
                        size={16}
                        weight="light"
                        className="btn__arrow"
                        aria-hidden="true"
                      />
                    }
                  >
                    Open playground
                  </Button>
                  <Button
                    href={GITHUB_URL}
                    variant="secondary"
                    size="lg"
                    icon={<GithubLogo size={16} weight="light" aria-hidden="true" />}
                  >
                    View on GitHub
                  </Button>
                </div>
              </div>

              <dl className="hero__telemetry">
                <dt>Session</dt>
                <dd>{demoSession.id}</dd>
                <dt>Agent</dt>
                <dd>{demoSession.agent}</dd>
                <dt>Turns</dt>
                <dd>07</dd>
                <dt>Memory</dt>
                <dd data-hot="true">+38 MB / sample</dd>
                <dt>Blame</dt>
                <dd data-hot="true">turn 4</dd>
              </dl>
            </div>
          </div>

          <span className="hero__ghost-label" aria-hidden="true">
            ghost / session 001
          </span>

          <a className="hero__scroll" href="#problem">
            <span>Scroll to record</span>
            <span className="hero__scroll-line" aria-hidden="true" />
          </a>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Problem                                                          */}
        {/* ---------------------------------------------------------------- */}
        <section className="section problem" id="problem">
          <div className="container">
            <SectionHead
              eyebrow="The bottleneck"
              title={
                <>
                  AI moved the bottleneck from writing code to{" "}
                  <em>understanding it.</em>
                </>
              }
              aside={
                <>
                  <p>
                    A pull request can be green on types and still leak memory,
                    spin the CPU, or add 400ms to p95 latency. Existing tools
                    each answer one question.
                  </p>
                  <p style={{ marginTop: 12 }}>
                    <strong>Ghost answers the one that matters after the fact.</strong>
                  </p>
                </>
              }
            />

            <div className="problem__grid">
              <div>
                <article className="problem-card glass">
                  <div className="problem-card__top">
                    <span className="mono">01 / CI · types</span>
                    <Check size={14} weight="light" aria-hidden="true" />
                  </div>
                  <h3>Does it compile?</h3>
                  <p>Green. The regression still ships.</p>
                  <div className="problem-card__note">
                    <span className="signal" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    Types · lint · build
                  </div>
                </article>
              </div>

              <div>
                <article className="problem-card glass">
                  <div className="problem-card__top">
                    <span className="mono">02 / TestSprite</span>
                    <ShieldWarning size={16} weight="light" aria-hidden="true" />
                  </div>
                  <h3>Does the PR break the app?</h3>
                  <p>Red. You know something broke. The suite stops the merge.</p>
                  <div className="problem-card__note">
                    <span className="signal" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    Required check · deployed URL
                  </div>
                </article>
              </div>

              <div>
                <article className="problem-card problem-card--ghost glass">
                  <div className="problem-card__top">
                    <span className="mono">03 / Ghost</span>
                    <Scan size={16} weight="light" aria-hidden="true" />
                  </div>
                  <h3>Which turn broke it — and how do I undo it?</h3>
                  <p>The prompt, the diff, and the rollback. In one recording.</p>
                  <div className="problem-card__note">
                    <span className="signal" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    Blamed on turn 4 · healed
                  </div>
                </article>
              </div>
            </div>

            <p className="problem__foot">
              One tower flickers. That is the regression.
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Loop                                                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="loop" id="loop" ref={loopRef}>
          <div className="loop__sticky">
            <div className="loop__scrim" aria-hidden="true" />

            <div className="container loop__head">
              <div>
                <span className="eyebrow">The loop</span>
                <h2>
                  Record. Attribute.
                  <br />
                  <em>Reverse.</em>
                </h2>
              </div>
              <p className="loop__count" aria-hidden="true">
                <b>{String(step + 1).padStart(2, "0")}</b> / 03
              </p>
            </div>

            <div className="container loop__body">
              <div className="loop__copy">
                {LOOP_STEPS.map((panel, index) => (
                  <article
                    className="loop-panel"
                    data-active={step === index ? "true" : "false"}
                    key={panel.title}
                  >
                    <span className="loop-panel__num">
                      0{index + 1} / {panel.kicker}
                    </span>
                    <h3>{panel.title}</h3>
                    <p>{panel.body}</p>
                    <ul className="loop-panel__facts">
                      {panel.facts.map((fact, factIndex) => (
                        <li
                          key={fact}
                          data-hot={
                            panel.hot && factIndex === 1 ? "true" : "false"
                          }
                        >
                          {fact}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>

              <div className="loop__visual">
                {/* Record */}
                <div
                  className="loop-ui glass"
                  data-active={step === 0 ? "true" : "false"}
                  aria-hidden={step !== 0}
                >
                  <div className="loop-ui__bar">
                    <span>
                      <span className="loop-ui__dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      record / shadow git
                    </span>
                    <span>sess-demo-001</span>
                  </div>
                  <div className="loop-ui__body">
                    <div className="loop-ui__big">
                      <strong>07</strong>
                      <span>
                        turns recorded
                        <br />
                        28 samples · 4 / turn
                      </span>
                    </div>
                    <div className="turn-ticks">
                      {[0, 1, 2, 3, 4, 5, 6].map((index) => (
                        <div
                          className="turn-tick"
                          key={index}
                          data-hot={index === 3 ? "true" : "false"}
                          style={{ "--i": index } as CSSProperties}
                        >
                          <div className="turn-tick__bar" />
                          <span>t{index + 1}</span>
                        </div>
                      ))}
                    </div>
                    <div className="scrubber-line">
                      <span />
                    </div>
                    <div className="scrubber-meta">
                      <span>shadow commits</span>
                      <span>HEAD untouched</span>
                    </div>
                  </div>
                </div>

                {/* Attribute */}
                <div
                  className="loop-ui glass"
                  data-active={step === 1 ? "true" : "false"}
                  aria-hidden={step !== 1}
                >
                  <div className="loop-ui__bar">
                    <span>
                      <span className="loop-ui__dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      autopsy / turn 4
                    </span>
                    <span>leak · high</span>
                  </div>
                  <div className="loop-ui__body">
                    <div className="loop-ui__big">
                      <strong>+38</strong>
                      <span>
                        MB / sample
                        <br />
                        climbing for two turns
                      </span>
                    </div>
                    <MetricsSvg id="loop-attribute" />
                    <div className="blame-beam">
                      blamed on t4 · src/store/invoices.ts
                    </div>
                    <div className="loop-ui__note">
                      <span>threshold + trend slope + per-turn bisect</span>
                      <strong>regression</strong>
                    </div>
                  </div>
                </div>

                {/* Reverse */}
                <div
                  className="loop-ui glass"
                  data-active={step === 2 ? "true" : "false"}
                  aria-hidden={step !== 2}
                >
                  <div className="loop-ui__bar">
                    <span>
                      <span className="loop-ui__dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      reverse / rollback
                    </span>
                    <span>healed</span>
                  </div>
                  <div className="loop-ui__body">
                    <div className="loop-ui__big">
                      <strong>flat</strong>
                      <span>
                        memory after rollback
                        <br />
                        re-measured
                      </span>
                    </div>
                    <MetricsSvg id="loop-reverse" healed />
                    <div className="blame-beam">
                      file rolled back · curve re-sampled
                    </div>
                    <div className="loop-ui__note" data-healed="true">
                      <span>post-regression commit restored</span>
                      <strong>healed</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="container loop__foot">
              <div className="loop__progress">
                <span />
              </div>
              <span className="loop__hint">Scroll to advance</span>
            </div>

            <div className="loop-stepper" aria-hidden="true">
              {["Record", "Attribute", "Reverse"].map((label, index) => (
                <div
                  className="loop-stepper__item"
                  data-active={step === index ? "true" : "false"}
                  key={label}
                >
                  <span>{label}</span>
                  <i />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Autopsy                                                          */}
        {/* ---------------------------------------------------------------- */}
        <section
          className="section section--solid autopsy-section"
          id="autopsy"
        >
          <div className="container">
            <SectionHead
              eyebrow="Autopsy"
              title={
                <>
                  The timeline is the <em>interface.</em>
                </>
              }
              aside={
                <>
                  <p>
                    Seven turns, one red line, one file to roll back. Every
                    number comes from the app, not from what the agent says it
                    did.
                  </p>
                  <p style={{ marginTop: 12 }}>
                    <strong>
                      {turns.length} turns · {metrics.length} samples · blamed on
                      turn 4
                    </strong>
                  </p>
                </>
              }
            />

            <div className="bento">
              <TiltCard
                className="bento__item bento__item--timeline glass"
                max={4.5}
                depth={0.2}
              >
                <div className="bento__head">
                  <span>
                    <Clock size={14} weight="light" aria-hidden="true" />
                    session / {turns.length} turns
                  </span>
                  <span>{demoSession.id}</span>
                </div>
                <div className="bento__body bento__body--flush timeline">
                  {turns.map((turn, index) => {
                    const isHot = turn.id === "t4";
                    return (
                      <div
                        className="timeline__row"
                        data-hot={isHot ? "true" : "false"}
                        key={turn.id}
                      >
                        <span className="timeline__turn">
                          t{index + 1}
                        </span>
                        <span className="timeline__text">{turn.text}</span>
                        <span
                          className={
                            isHot
                              ? "timeline__tag timeline__tag--hot"
                              : turn.role === "assistant"
                                ? "timeline__tag timeline__tag--ai"
                                : "timeline__tag"
                          }
                        >
                          {isHot
                            ? "regression"
                            : turn.role === "assistant"
                              ? "AI"
                              : "user"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="timeline__foot">
                  <div className="timeline__track">
                    <span />
                  </div>
                  <span className="mono">t4 / 7</span>
                </div>
              </TiltCard>

              <TiltCard
                className="bento__item bento__item--metrics glass"
                max={5}
                depth={0.8}
              >
                <div className="bento__head">
                  <span>
                    <Activity size={14} weight="light" aria-hidden="true" />
                    runtime / rss
                  </span>
                  <Badge tone="coral">leak</Badge>
                </div>
                <div className="metrics-panel">
                  <div className="metrics-panel__top">
                    <div>
                      <div className="metrics-panel__value">
                        +38
                        <small>MB / sample</small>
                      </div>
                      <p className="mono" style={{ color: "var(--fg-3)", marginTop: 8 }}>
                        turn 4 · src/store/invoices.ts
                      </p>
                    </div>
                  </div>
                  <MetricsSvg id="bento-metrics" height={128} />
                  <div className="metrics-panel__stats">
                    <div className="metrics-panel__stat">
                      <span>peak rss</span>
                      <strong data-hot="true">{peakMemory} MB</strong>
                    </div>
                    <div className="metrics-panel__stat">
                      <span>peak cpu</span>
                      <strong>{peakCpu}%</strong>
                    </div>
                    <div className="metrics-panel__stat">
                      <span>source</span>
                      <strong>/api/health</strong>
                    </div>
                  </div>
                </div>
              </TiltCard>

              <TiltCard
                className="bento__item bento__item--diff glass"
                max={4.5}
                depth={0.35}
              >
                <div className="bento__head">
                  <span>
                    <Stack size={14} weight="light" aria-hidden="true" />
                    diff / blamed turn
                  </span>
                  <span>+4 −0</span>
                </div>
                <div className="diff-panel">
                  <div className="diff-panel__file">
                    <span>src/store/invoices.ts</span>
                    <span>t4 · assistant</span>
                  </div>
                  <div className="diff-panel__lines">
                    {blamedDiff?.lines.map((line, index) => {
                      const added = line.startsWith("+");
                      const removed = line.startsWith("-");
                      return (
                        <div
                          className={`diff-panel__line${
                            added
                              ? " diff-panel__line--add"
                              : removed
                                ? " diff-panel__line--del"
                                : ""
                          }`}
                          key={index}
                        >
                          <b aria-hidden="true">
                            {added ? "+" : removed ? "−" : " "}
                          </b>
                          <span>{line.slice(1)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TiltCard>

              <TiltCard
                className="bento__item bento__item--fix glass"
                max={5}
                depth={0.9}
              >
                <div className="bento__head">
                  <span>
                    <Sparkle size={14} weight="light" aria-hidden="true" />
                    fix prompt
                  </span>
                  <span>copy / replay</span>
                </div>
                <div className="fix-panel">
                  <p className="fix-panel__prompt">{autopsy.fixPrompt}</p>
                  <div className="fix-panel__meta">
                    <Badge>turn 4 · file restored</Badge>
                    <CopyButton value={autopsy.fixPrompt} label="Copy" />
                  </div>
                  <div className="fix-panel__meta">
                    <span className="mono" style={{ color: "var(--fg-3)" }}>
                      {anomaly.note}
                    </span>
                  </div>
                </div>
              </TiltCard>
            </div>

            <div className="bento__caption">
              <span>
                The same recording, rendered as a city. Height is churn. Color
                is health.
              </span>
              <Button
                href={PLAYGROUND_URL}
                variant="ghost"
                size="sm"
                icon={<ArrowRight size={14} weight="light" aria-hidden="true" />}
              >
                Open the live playground
              </Button>
            </div>
          </div>
        </section>

        <Marquee />

        {/* ---------------------------------------------------------------- */}
        {/* Proof                                                            */}
        {/* ---------------------------------------------------------------- */}
        <section className="section section--solid" id="proof">
          <div className="container">
            <SectionHead
              eyebrow="Proof"
              title={
                <>
                  The check at the merge is not <em>the autopsy.</em>
                </>
              }
              aside={
                <>
                  <p>
                    TestSprite tells you the PR is red. Ghost tells you which
                    prompt turned it red. Both belong in the loop.
                  </p>
                  <p style={{ marginTop: 12 }}>
                    <strong>
                      23 backend tests + 1 integration flow. Every pull request.
                      The deployed URL.
                    </strong>
                  </p>
                </>
              }
            />

            <div className="proof__grid">
              <div className="proof-table glass">
                <table>
                  <caption className="sr-only">
                    Which tool answers which question
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Question</th>
                      <th scope="col">CI / types</th>
                      <th scope="col">TestSprite</th>
                      <th scope="col">Ghost</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Does it compile?</th>
                      <td>
                        <span className="proof-table__answer">
                          <span className="proof-table__icon proof-table__icon--yes">
                            <Check size={14} weight="light" aria-hidden="true" />
                          </span>
                          Green
                        </span>
                      </td>
                      <td>
                        <span className="proof-table__answer">
                          <span className="proof-table__icon proof-table__icon--no">
                            <Circle size={14} weight="light" aria-hidden="true" />
                          </span>
                          Not its job
                        </span>
                      </td>
                      <td data-col="ghost">
                        <span className="proof-table__answer">
                          <span className="proof-table__icon proof-table__icon--yes">
                            <Check size={14} weight="light" aria-hidden="true" />
                          </span>
                          Not the question
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Does the PR break the app?</th>
                      <td>
                        <span className="proof-table__answer">
                          <span className="proof-table__icon">
                            <Circle size={14} weight="light" aria-hidden="true" />
                          </span>
                          Unknown
                        </span>
                      </td>
                      <td>
                        <span className="proof-table__answer">
                          <span className="proof-table__icon proof-table__icon--yes">
                            <Check size={14} weight="light" aria-hidden="true" />
                          </span>
                          Red or green
                        </span>
                      </td>
                      <td data-col="ghost">
                        <span className="proof-table__answer">
                          <span className="proof-table__icon proof-table__icon--yes">
                            <Check size={14} weight="light" aria-hidden="true" />
                          </span>
                          Red or green
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">
                        Which turn broke it — and how do I undo it?
                      </th>
                      <td>
                        <span className="proof-table__answer">
                          <span className="proof-table__icon">
                            <Circle size={14} weight="light" aria-hidden="true" />
                          </span>
                          No
                        </span>
                      </td>
                      <td>
                        <span className="proof-table__answer">
                          <span className="proof-table__icon proof-table__icon--no">
                            <Circle size={14} weight="light" aria-hidden="true" />
                          </span>
                          No
                        </span>
                      </td>
                      <td data-col="ghost">
                        <span className="proof-table__answer">
                          <span className="proof-table__icon proof-table__icon--yes">
                            <Sparkle size={14} weight="light" aria-hidden="true" />
                          </span>
                          The prompt, the diff, the rollback
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="proof-testsprite glass">
                <div className="proof-testsprite__label">
                  <span>TestSprite 3.0</span>
                  <Badge>Required check</Badge>
                </div>
                <div className="proof-testsprite__score">
                  <CountUp target={24} />
                  <small>/24</small>
                </div>
                <div className="proof-testsprite__state">
                  <span className="badge__dot" aria-hidden="true" />
                  Green · suite passes
                </div>
                <ul className="proof-testsprite__facts">
                  <li>24 tests: 23 backend tests + 1 integration flow.</li>
                  <li>
                    The PR check reruns the backend set on every pull request,
                    against the deployed URL.
                  </li>
                  <li>
                    PR #1 shipped a BOLA hole. PR #2 fixed it. Same suite, green.
                  </li>
                </ul>
                <div className="proof__prs">
                  <span className="proof__pr" data-state="red">
                    <GitCommit size={14} weight="light" aria-hidden="true" />
                    PR #1 · BOLA caught
                  </span>
                  <span className="proof__pr" data-state="green">
                    <GitCommit size={14} weight="light" aria-hidden="true" />
                    PR #2 · fixed · suite green
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Quickstart                                                       */}
        {/* ---------------------------------------------------------------- */}
        <section className="section section--solid" id="quickstart">
          <div className="container quickstart__grid">
            <div className="quickstart__copy">
              <span className="eyebrow">Quickstart</span>
              <h2>
                Point it at the repo.
                <br />
                Press <em>record.</em>
              </h2>
              <p>
                No agent SDK. No lock-in. Ghost watches the filesystem and the
                process, so every tool produces the same recording.
              </p>
              <div
                className="quickstart__steps"
                style={{ display: "grid", gap: 14, marginTop: 26 }}
              >
                {[
                  {
                    n: "01",
                    t: "Install the recorder",
                    d: "One curl line (macOS, Linux, Windows) drops the ghost CLI into ~/.ghost without npm. Requires Node \u2265 18.",
                  },
                  {
                    n: "02",
                    t: "Connect OpenCode (Mode A)",
                    d: "Copy the one-file adapter into .opencode/plugins/ghost.ts - OpenCode then reports every turn boundary to the recorder, so the timeline uses real turn ids.",
                  },
                  {
                    n: "03",
                    t: "Record any session",
                    d: "Run ghost watch in your project. With the plugin installed, turns stream live; with any other agent (Cursor, Claude Code, a human) the filesystem watcher + runtime probes record everything from the outside - turns marked estimated, never invented.",
                  },
                  {
                    n: "04",
                    t: "Inspect, blame, heal",
                    d: "Scrub the tape in the playground, read the autopsy verdict naming the turn that broke it, copy the heal prompt to your agent - or roll the file back in one click. ghost setup pairs your device for metadata-only sync to Ghost Cloud.",
                  },
                ].map((s) => (
                  <div key={s.n} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span
                      className="eyebrow"
                      style={{ marginTop: 3, letterSpacing: "0.08em" }}
                    >
                      {s.n}
                    </span>
                    <span style={{ maxWidth: 520 }}>
                      <strong>{s.t}</strong>
                      <br />
                      <span style={{ opacity: 0.72 }}>{s.d}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="quickstart__facts">
                <span>
                  <Check size={14} weight="light" aria-hidden="true" />
                  Facts from /api/health
                </span>
                <span>
                  <Check size={14} weight="light" aria-hidden="true" />
                  Shadow git only
                </span>
                <span>
                  <Check size={14} weight="light" aria-hidden="true" />
                  Local by default
                </span>
                <span>
                  <Check size={14} weight="light" aria-hidden="true" />
                  Metadata-only sync
                </span>
              </div>
              <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Button
                  href={PLAYGROUND_URL}
                  variant="secondary"
                  icon={<TerminalIcon size={14} weight="light" aria-hidden="true" />}
                >
                  Skip setup, open the replay
                </Button>
                <Button
                  href={`${GITHUB_URL}#readme`}
                  variant="secondary"
                >
                  Full setup docs
                </Button>
              </div>
            </div>

            <Terminal />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Final CTA                                                        */}
        {/* ---------------------------------------------------------------- */}
        <section className="final" id="final" ref={finalRef}>
          <div className="final__scrim" aria-hidden="true" />
          <div className="container final__inner">
            <span className="eyebrow eyebrow--plain">
              The layer behind the maker
            </span>
            <h2 className="final__title">
              Every regression
              <br />
              has a <em>turn.</em>
              <br />
              Find it.
            </h2>
            <p className="final__sub">
              See what the AI builds. Know when it breaks it. Then roll the file
              back and watch the curve flatten.
            </p>
            <div className="final__actions">
              <Button
                href={PLAYGROUND_URL}
                size="lg"
                icon={
                      <ArrowUpRight
                        size={16}
                        weight="light"
                        className="btn__arrow"
                        aria-hidden="true"
                      />
                    }
              >
                Open playground
              </Button>
              <Button
                href={GITHUB_URL}
                variant="secondary"
                size="lg"
                icon={<GithubLogo size={16} weight="light" aria-hidden="true" />}
              >
                View on GitHub
              </Button>
            </div>
            <p className="final__note">
              <GhostMark size={12} /> Built for TestSprite Season 4 · 24-test suite
              required check
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
