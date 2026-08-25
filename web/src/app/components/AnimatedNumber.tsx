"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  minimumIntegerDigits?: number;
  duration?: number;
  className?: string;
}

const easeOutQuart = (progress: number) => 1 - Math.pow(1 - progress, 4);

export default function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  minimumIntegerDigits = 1,
  duration = 1100,
  className = "",
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const valueRef = useRef(0);
  const numberRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const node = numberRef.current;
    if (!node) return;

    let frame = 0;
    let observer: IntersectionObserver | null = null;

    const update = (nextValue: number) => {
      valueRef.current = nextValue;
      setDisplayValue(nextValue);
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      frame = window.requestAnimationFrame(() => update(value));
      return () => window.cancelAnimationFrame(frame);
    }

    const animate = () => {
      const startValue = valueRef.current;
      const difference = value - startValue;
      const startTime = performance.now();

      const step = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1);
        update(Math.round(startValue + difference * easeOutQuart(progress)));
        if (progress < 1) frame = window.requestAnimationFrame(step);
      };

      frame = window.requestAnimationFrame(step);
    };

    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animate();
          observer?.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);

    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [duration, value]);

  const formatted = displayValue.toLocaleString("en-US", { minimumIntegerDigits });
  const accessibleValue = `${prefix}${value.toLocaleString("en-US", { minimumIntegerDigits })}${suffix}`;

  return (
    <span
      ref={numberRef}
      className={`animated-number ${className}`.trim()}
      aria-label={accessibleValue}
    >
      <span aria-hidden="true">{prefix}{formatted}{suffix}</span>
    </span>
  );
}
