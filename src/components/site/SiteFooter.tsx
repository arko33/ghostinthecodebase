"use client";

import { ArrowUpRight, GithubLogo } from "@phosphor-icons/react";
import Link from "next/link";
import { GITHUB_URL, NAV_LINKS, PLAYGROUND_URL } from "@/src/data/site";
import Badge from "./Badge";
import GhostMark from "./GhostMark";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <Link href="/" className="wordmark" aria-label="Ghost home">
              <GhostMark />
              <span className="wordmark__type">
                Ghost <small>in the codebase</small>
              </span>
            </Link>
            <p>
              A black-box recorder and time-travel autopsy for AI coding agents.
              See what the AI builds. Know when it breaks it.
            </p>
            <div style={{ marginTop: 18 }}>
              <Badge tone="violet">Built for TestSprite Season 4</Badge>
            </div>
          </div>

          <div className="site-footer__col">
            <h3>Product</h3>
            <ul>
              <li>
                <Link href={PLAYGROUND_URL}>Playground</Link>
              </li>
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer__col">
            <h3>Project</h3>
            <ul>
              <li>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <GithubLogo size={14} weight="light" aria-hidden="true" />
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  Source <ArrowUpRight size={14} weight="light" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a href="#proof">TestSprite proof</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="site-footer__bottom">
          <span>
            <i className="badge__dot" aria-hidden="true" />
            (c) 2026 GhostInTheCodebase
          </span>
          <span>No telemetry. No third-party calls.</span>
        </div>
      </div>
    </footer>
  );
}
