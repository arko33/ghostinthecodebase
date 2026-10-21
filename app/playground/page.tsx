import { demoSession } from "@/src/data/fixture";
import Dashboard from "@/src/components/Dashboard";
import LiveDashboard from "@/src/components/playground/LiveDashboard";

export default function Page({
  searchParams,
}: {
  searchParams?: { live?: string };
}) {
  if (searchParams?.live) {
    // ?live=1 — stream the REAL recording (`ghost watch`) instead of the
    // committed demo session. Same Dashboard, same 3D city, real data.
    return (
      <main className="app">
        <LiveDashboard />
      </main>
    );
  }
  return (
    <main className="app">
      <Dashboard session={demoSession} />
    </main>
  );
}
