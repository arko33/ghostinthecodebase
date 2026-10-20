"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import GithubIcon from "./GithubIcon";

const REPO = "https://github.com/arko33/ghostinthecodebase";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "/playground", label: "Playground" },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-md border border-accent/30 bg-gradient-to-br from-accent/25 to-human/10">
            <img src="/ghost-192.png" alt="GhostInTheCodebase" width={32} height={32} className="h-6 w-6 object-contain" />
          </span>
          <span className="text-[13.5px] font-semibold tracking-tight">
            GhostInTheCodebase
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map((l) =>
            l.href.startsWith("#") ? (
              <a
                key={l.href}
                href={l.href}
                className="rounded-md px-2.5 py-1.5 text-[12.5px] text-dim transition-colors hover:bg-elev hover:text-[#e6edf3]"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-2.5 py-1.5 text-[12.5px] text-dim transition-colors hover:bg-elev hover:text-[#e6edf3]"
              >
                {l.label}
              </Link>
            ),
          )}
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="ml-1 grid h-8 w-8 place-items-center rounded-md border border-line text-dim transition-colors hover:border-accent/40 hover:text-[#e6edf3]"
            aria-label="GitHub repository"
          >
            <GithubIcon className="h-4 w-4" />
          </a>
          <Link
            href="/playground"
            className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/15 px-3 py-1.5 text-[12.5px] font-medium text-accent transition-colors hover:bg-accent/25"
          >
            Open playground
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto grid h-8 w-8 place-items-center rounded-md border border-line text-dim md:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-ink/95 px-4 py-2 md:hidden">
          {LINKS.map((l) =>
            l.href.startsWith("#") ? (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-2 py-2 text-[13px] text-dim hover:bg-elev"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-2 py-2 text-[13px] text-dim hover:bg-elev"
              >
                {l.label}
              </Link>
            ),
          )}
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md px-2 py-2 text-[13px] text-dim hover:bg-elev"
          >
            <GithubIcon className="h-3.5 w-3.5" />
            GitHub
          </a>
        </div>
      )}
    </header>
  );
}
