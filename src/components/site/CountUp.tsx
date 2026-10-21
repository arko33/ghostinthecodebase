"use client";

import { useCountUp, useInView } from "./hooks";

interface Props {
  target: number;
  className?: string;
  suffix?: string;
}

export default function CountUp({ target, className, suffix }: Props) {
  const [ref, inView] = useInView<HTMLSpanElement>("0px 0px -12% 0px", 0.4);
  const value = useCountUp(target, inView);

  return (
    <span ref={ref} className={className} aria-label={`${target}${suffix ?? ""}`}>
      {value}
      {suffix}
    </span>
  );
}
