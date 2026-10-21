import type { Metadata } from "next";
import "./login.css";

export const metadata: Metadata = { title: "Sign in — GhostInTheCodebase" };

export default function LoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  const error = searchParams?.error;
  return (
    <main className="login-main">
      <h1 className="login-title">Ghost</h1>
      <p className="login-note">Agent accountability for AI-built codebases.</p>
      {error ? <p className="login-error">✗ {decodeURIComponent(error)}</p> : null}
      <a className="login-btn" href="/api/auth/github">
        Sign in with GitHub
      </a>
      <p className="login-hint">
        Only humans sign in here. Agents connect via device pairing — <code>ghost setup</code>.
      </p>
    </main>
  );
}
