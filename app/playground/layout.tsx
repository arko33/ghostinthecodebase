import type { Metadata } from "next";
import "./playground.css";

export const metadata: Metadata = {
  title: "Playground",
  description:
    "Replay a recorded agent session: tape rail, 3D code city, autopsy verdict, runtime metrics and rollback.",
};

export default function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="dashboard-page">{children}</div>;
}
