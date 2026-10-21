"use client";

import { ArrowLeft, ArrowUpRight } from "@phosphor-icons/react";
import Link from "next/link";

export default function NotFoundActions() {
  return (
    <div className="not-found__actions">
      <Link className="btn btn--primary" href="/">
        <span className="btn__inner">
          <ArrowLeft size={16} weight="light" aria-hidden="true" />
          Back to the landing
        </span>
      </Link>
      <Link className="btn btn--secondary" href="/playground">
        <span className="btn__inner">
          Open playground
          <ArrowUpRight size={16} weight="light" aria-hidden="true" />
        </span>
      </Link>
    </div>
  );
}
