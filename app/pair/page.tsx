import type { Metadata } from "next";
import PairClient from "./pair-client";
import "./pair.css";

export const metadata: Metadata = { title: "Pair device — GhostInTheCodebase" };

export default function PairPage({ searchParams }: { searchParams?: { code?: string } }) {
  const code = (searchParams?.code ?? "").trim();
  return (
    <main className="pair-main">
      <h1 className="pair-title">Ghost — device pairing</h1>
      <PairClient code={code} />
    </main>
  );
}
