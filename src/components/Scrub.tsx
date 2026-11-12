"use client";

import { useRef } from "react";

/**
 * A number inside a sentence that you drag left/right to change
 * (after Bret Victor's Tangle and Red Blob Games' scrubbable numbers).
 * Keyboard: focus it, then arrow keys (Shift = ×10), Home / End.
 */
export function Scrub({
  value,
  min,
  max,
  step,
  pxPerStep = 1,
  format,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  pxPerStep?: number;
  format: (v: number) => string;
  label: string;
  onChange: (v: number) => void;
}) {
  const start = useRef<{ x: number; v: number } | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));

  return (
    <span
      className="scrub-num"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      title="Drag left or right"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, v: value };
        document.body.classList.add("is-scrubbing");
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const steps = Math.round((e.clientX - start.current.x) / pxPerStep);
        const next = clamp(start.current.v + steps * step);
        if (next !== value) onChange(next);
      }}
      onPointerUp={() => {
        start.current = null;
        document.body.classList.remove("is-scrubbing");
      }}
      onPointerCancel={() => {
        start.current = null;
        document.body.classList.remove("is-scrubbing");
      }}
      onKeyDown={(e) => {
        const big = e.shiftKey ? 10 : 1;
        let next: number | null = null;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") next = value + step * big;
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = value - step * big;
        if (e.key === "Home") next = min;
        if (e.key === "End") next = max;
        if (next !== null) {
          e.preventDefault();
          onChange(clamp(next));
        }
      }}
    >
      {format(value)}
    </span>
  );
}
