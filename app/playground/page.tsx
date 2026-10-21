import type { Metadata } from "next";
import { demoSession } from "@/src/data/fixture";
import PlaygroundClient from "@/src/components/PlaygroundClient";

export const metadata: Metadata = {
  title: "Playground — GhostInTheCodebase",
  description:
    "Replay a recorded agent session: timeline, code diff, runtime metrics and the 3D code city. Drop in your own session.json to replay it instead.",
};

// Server component: ships the recorded demo session to the client, which can
// swap it for a session.json the user recorded locally.
export default function PlaygroundPage() {
  return <PlaygroundClient initial={demoSession} />;
}
