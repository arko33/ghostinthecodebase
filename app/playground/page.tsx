import { demoSession } from "@/src/data/fixture";
import Dashboard from "@/src/components/Dashboard";

export default function Page() {
  return (
    <main className="app">
      <Dashboard session={demoSession} />
    </main>
  );
}
