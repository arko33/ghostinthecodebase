"use client";

import {
  ArrowUpRight,
  GithubLogo,
  List,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GITHUB_URL, NAV_LINKS, PLAYGROUND_URL } from "@/src/data/site";
import GhostMark from "./GhostMark";

export default function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const lastY = useRef(0);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 24);
        setHidden(y > 160 && y > lastY.current + 4);
        lastY.current = y;
        frame = 0;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (drawerRef.current) drawerRef.current.inert = !open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header
        className="site-nav"
        data-scrolled={scrolled ? "true" : "false"}
        data-hidden={hidden && !open ? "true" : "false"}
        data-open={open ? "true" : "false"}
      >
        <div className="site-nav__inner container">
          <Link
            href="/"
            className="wordmark"
            aria-label="GhostInTheCodebase home"
            onClick={() => setOpen(false)}
          >
            <GhostMark />
            <span className="wordmark__type">
              Ghost <small>in the codebase</small>
            </span>
          </Link>

          <nav aria-label="Primary">
            <ul className="site-nav__links">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a className="site-nav__link" href={link.href}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="site-nav__actions">
            <a
              className="site-nav__github"
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="View the project on GitHub"
            >
              <GithubLogo size={16} weight="light" aria-hidden="true" />
            </a>
            <Link className="btn btn--secondary btn--sm" href={PLAYGROUND_URL}>
              <span className="btn__inner">
                Open playground
                <ArrowUpRight size={16} weight="light" aria-hidden="true" />
              </span>
            </Link>
            <button
              ref={menuButton}
              type="button"
              className="site-nav__menu"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? (
                <X size={20} weight="light" aria-hidden="true" />
              ) : (
                <List size={20} weight="light" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>

      <div
        ref={drawerRef}
        id="mobile-menu"
        className="mobile-menu"
        data-open={open ? "true" : "false"}
        aria-hidden={!open}
      >
        <nav aria-label="Mobile">
          <ul className="mobile-menu__links">
            {NAV_LINKS.map((link, index) => (
              <li key={link.href}>
                <a
                  className="mobile-menu__link"
                  href={link.href}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                  <span>0{index + 1}</span>
                </a>
              </li>
            ))}
            <li>
              <a
                className="mobile-menu__link"
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer noopener"
                onClick={() => setOpen(false)}
              >
                GitHub
                <ArrowUpRight size={16} weight="light" aria-hidden="true" />
              </a>
            </li>
          </ul>
        </nav>
        <div className="mobile-menu__foot">
          <Link
            className="btn btn--primary btn--lg"
            href={PLAYGROUND_URL}
            onClick={() => setOpen(false)}
          >
            <span className="btn__inner">
              Open playground
              <ArrowUpRight size={16} weight="light" aria-hidden="true" />
            </span>
          </Link>
          <p className="mono" style={{ color: "var(--fg-3)" }}>
            Built for TestSprite Season 4
          </p>
        </div>
      </div>
    </>
  );
}
