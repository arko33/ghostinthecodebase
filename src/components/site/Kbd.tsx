import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

export default function Kbd({ children, className = "" }: Props) {
  return <kbd className={`kbd ${className}`}>{children}</kbd>;
}
