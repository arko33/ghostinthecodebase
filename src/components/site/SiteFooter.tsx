import Link from "next/link";
import GithubIcon from "./GithubIcon";

const REPO = "https://github.com/arko33/ghostinthecodebase";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Playground", href: "/playground" },
      { label: "How it works", href: "/#how" },
      { label: "Features", href: "/#features" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "GitHub", href: REPO },
      { label: "README", href: `${REPO}#readme` },
      { label: "Test suite", href: `${REPO}#what-the-suite-covers` },
    ],
  },
  {
    title: "Built with",
    links: [
      { label: "Next.js 14", href: "https://nextjs.org" },
      { label: "three.js", href: "https://threejs.org" },
      { label: "Tailwind CSS", href: "https://tailwindcss.com" },
      { label: "TestSprite", href: "https://testsprite.com" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-panel/40">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-md border border-accent/30 bg-gradient-to-br from-accent/25 to-human/10">
                <img src="/ghost-192.png" alt="" width={32} height={32} className="h-6 w-6 object-contain" />
              </span>
              <span className="text-[13px] font-semibold">GhostInTheCodebase</span>
            </div>
            <p className="mt-3 max-w-xs text-[12px] leading-relaxed text-dim">
              See what the AI builds. Know when it breaks it. A black-box recorder
              and time-travel autopsy for AI coding agents.
            </p>
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11.5px] text-dim transition-colors hover:border-accent/40 hover:text-[#e6edf3]"
            >
              <GithubIcon className="h-3.5 w-3.5" />
              Star on GitHub
            </a>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-[10.5px] font-semibold uppercase tracking-wider text-dim/80">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-[12px] text-dim transition-colors hover:text-[#e6edf3]"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-5 text-[11px] text-dim/70 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 GhostInTheCodebase</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-ok animate-pulseGlow" />
            Built for TestSprite Season 4
          </span>
        </div>
      </div>
    </footer>
  );
}
