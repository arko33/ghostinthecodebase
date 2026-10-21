const AGENTS = ["Cursor", "Claude Code", "Codex", "OpenCode"];

function Group({ hidden }: { hidden?: boolean }) {
  return (
    <div className="marquee__group" aria-hidden={hidden ? true : undefined}>
      {AGENTS.map((agent) => (
        <span className="marquee__item" key={agent}>
          {agent}
          <i aria-hidden="true" />
        </span>
      ))}
      <span className="marquee__item">
        or a human with a keyboard
        <i aria-hidden="true" />
      </span>
    </div>
  );
}

export default function Marquee() {
  return (
    <section className="agent-strip" aria-label="Agent-agnostic by design">
      <p className="agent-strip__label">Agent-agnostic by design</p>
      <div className="marquee">
        <div className="marquee__track">
          <Group />
          <Group hidden />
        </div>
      </div>
    </section>
  );
}
