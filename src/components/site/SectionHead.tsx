import type { ReactNode } from "react";
import Reveal from "./Reveal";

interface Props {
  eyebrow: string;
  title: ReactNode;
  aside?: ReactNode;
  id?: string;
  className?: string;
}

export default function SectionHead({
  eyebrow,
  title,
  aside,
  id,
  className = "",
}: Props) {
  return (
    <div className={`section-head ${className}`}>
      <Reveal>
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="section-head__title" id={id}>
          {title}
        </h2>
      </Reveal>
      {aside && (
        <Reveal delay={90}>
          <div className="section-head__aside">{aside}</div>
        </Reveal>
      )}
    </div>
  );
}
