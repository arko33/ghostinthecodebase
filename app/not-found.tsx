import type { Metadata } from "next";
import GhostMark from "@/src/components/site/GhostMark";
import NotFoundActions from "@/src/components/site/NotFoundActions";

export const metadata: Metadata = {
  title: "404 — Signal lost",
};

export default function NotFound() {
  return (
    <main className="not-found">
      <div className="not-found__glow" aria-hidden="true" />
      <div className="not-found__inner container">
        <span className="eyebrow">404 / signal lost</span>
        <GhostMark size={54} className="not-found__mark" />
        <h1>
          The ghost is not <em>here.</em>
        </h1>
        <p>
          This route has no recording. The city is still where you left it.
        </p>
        <NotFoundActions />
      </div>
    </main>
  );
}
