import type { Metadata } from "next";
import { demoSession } from "@/src/data/fixture";
import Dashboard from "@/src/components/Dashboard";

export const metadata: Metadata = {
  title: "Playground — GhostInTheCodebase",
  description:
    "Replay a recorded agent session: timeline, code diff, runtime metrics and the 3D code city.",
};

// Server component: loads the recorded demo session and hands it to the
// interactive client dashboard.
export default function PlaygroundPage() {
  return <Dashboard session={demoSession} />;
}
