"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { sf3, tick } from "@/lib/format";
import { hand } from "@/lib/fonts";
import { PALETTE as p } from "@/lib/theme";
import { timeline } from "@/lib/timeline";

export interface Series {
  name: string;
  data: Record<string, number>[];
  color: string;
  /** Pencil-dashed line, e.g. the ghost of the previous run. */
  dashed?: boolean;
}

// Plot-area insets inside the ResponsiveContainer. They must match the
// LineChart margins + axis sizes below: left = 6 + YAxis width 58,
// bottom = 26 + XAxis height 30.
const PLOT = { left: 64, right: 14, top: 18, bottom: 56 };

const PRINT_FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";
const HAND_FONT = hand.style.fontFamily;

/**
 * A graph drawn as a printout taped into the notebook.
 *
 * - The title sits above the printout in handwriting, as if labelled by hand.
 * - Inside the printout, axes and ticks use plain printer type.
 * - Annotations (surface line, current-drop dot, "inside Vulcan") are in
 *   handwriting and red pen / pencil, as if added after printing.
 * - `rock` shades an x-range with pencil hatching, the same hatching used on
 *   the planet in the cross-section.
 * - `note` is a handwritten remark under the printout.
 *
 * Each series carries its own data array, so series with different x values
 * (e.g. different fall times) share one numeric x-axis.
 *
 * Linked to the shared timeline (needs `xDomain`):
 * - `timeAxis`: x is time. Hovering sets the shared hover time (the
 *   cross-section shows a ghost probe there), clicking moves the probe
 *   there, and while the probe falls the part of the graph it hasn't
 *   reached yet is faded, so the line traces itself.
 * - `followX(t)`: x is something else (e.g. distance from centre); a red
 *   line shows where the probe is at the current time.
 * The overlay is moved with CSS transforms straight from the store, so
 * Recharts never re-renders during playback.
 */
export function Chart({
  title,
  caption,
  note,
  xKey,
  yKey,
  xLabel,
  yLabel,
  series,
  marker,
  rock,
  dot,
  xDomain,
  height = 250,
  tilt = 0,
  timeAxis = false,
  followX,
}: {
  title: string;
  caption?: string;
  note?: string;
  xKey: string;
  yKey: string;
  xLabel: string;
  yLabel: string;
  series: Series[];
  marker?: { x: number; label: string } | null;
  rock?: { x1: number; x2: number; label: string } | null;
  dot?: { x: number; y: number; label: string } | null;
  xDomain?: [number, number];
  height?: number;
  /** Small rotation (degrees) so taped printouts don't sit perfectly square. */
  tilt?: number;
  timeAxis?: boolean;
  followX?: (t: number) => number | null;
}) {
  const hatchId = `hatch-${useId().replace(/:/g, "")}`;

  // Pen-plotter entrance, once per graph: "waiting" until the printout
  // scrolls into view, then the paper settles under its tape and the lines
  // draw themselves ("plotting"), then "done": later data changes (sliders)
  // update instantly so dragging never replays it. Skipped entirely for
  // reduced motion.
  const figRef = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<"waiting" | "plotting" | "done">("waiting");
  useEffect(() => {
    const el = figRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      setPhase("done");
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase("plotting");
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const linked = (timeAxis || followX) && xDomain;
  const boxRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(followX);
  followRef.current = followX;

  // Position the overlay lines from the shared timeline, without React.
  useEffect(() => {
    if (!linked) return;
    const [x0, x1] = xDomain!;
    const frac = (x: number | null | undefined) =>
      x === null || x === undefined ? null : (x - x0) / (x1 - x0);
    const place = (el: HTMLDivElement | null, f: number | null) => {
      if (!el) return;
      const show = f !== null && f >= 0 && f <= 1;
      el.style.opacity = show ? "1" : "0";
      if (show) el.style.transform = `translateX(${f! * 100}%)`;
    };
    const update = () => {
      const { time, hover, end } = timeline.get();
      const started = time > 0 && time < end;
      if (timeAxis) {
        place(nowRef.current, started ? frac(time) : null);
        place(hoverRef.current, frac(hover));
        place(coverRef.current, started && hover === null ? frac(time) : null);
      } else {
        place(nowRef.current, time > 0 ? frac(followRef.current?.(time)) : null);
      }
    };
    update();
    return timeline.subscribe(update);
  }, [linked, timeAxis, xDomain]);

  const timeAt = (clientX: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || !xDomain) return null;
    const f = (clientX - box.left) / box.width;
    if (f < 0 || f > 1) return null;
    return xDomain[0] + f * (xDomain[1] - xDomain[0]);
  };
  const axisText = { fill: p.print, fontSize: 11, fontFamily: PRINT_FONT };

  return (
    <figure className="chart" ref={figRef}>
      <figcaption className="hand-label">{title}</figcaption>
      <div className={`taped${phase === "waiting" ? " is-waiting" : ""}`} style={{ "--tilt": `${tilt}deg` } as CSSProperties}>
        {(series.length > 1 || caption) && (
          <div className="print-head">
            {series.length > 1 &&
              series.map((s) => (
                <span key={s.name} className="legend-item">
                  <svg width="18" height="10" aria-hidden="true">
                    <line x1="0" x2="18" y1="5" y2="5" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? "4 3" : undefined} />
                  </svg>
                  {s.name}
                </span>
              ))}
            {caption && <span className="print-caption">{caption}</span>}
          </div>
        )}
        <div
          className={`plot${timeAxis ? " is-linked" : ""}`}
          onPointerMove={timeAxis ? (e) => timeline.set({ hover: timeAt(e.clientX) }) : undefined}
          onPointerLeave={timeAxis ? () => timeline.set({ hover: null }) : undefined}
          onClick={timeAxis ? (e) => {
            const t = timeAt(e.clientX);
            if (t !== null) timeline.set({ time: Math.min(t, timeline.get().end) });
          } : undefined}
        >
        <ResponsiveContainer width="100%" height={height}>
          <LineChart margin={{ top: 18, right: 14, bottom: 26, left: 6 }}>
            <defs>
              <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke={p.pencil} strokeWidth="1" />
              </pattern>
            </defs>
            <CartesianGrid stroke={p.grid} />
            {rock && (
              <ReferenceArea
                x1={rock.x1}
                x2={rock.x2}
                fill={`url(#${hatchId})`}
                fillOpacity={0.35}
                strokeOpacity={0}
                label={rock.label ? { value: rock.label, position: "insideTop", fill: p.pencil, fontSize: 16, fontFamily: HAND_FONT } : undefined}
              />
            )}
            <XAxis
              dataKey={xKey}
              type="number"
              domain={xDomain ?? ["dataMin", "dataMax"]}
              allowDuplicatedCategory={false}
              tickFormatter={tick}
              tick={axisText}
              stroke={p.print}
              label={{ value: xLabel, position: "insideBottom", offset: -16, fill: p.print, fontSize: 12, fontFamily: PRINT_FONT }}
            />
            <YAxis
              dataKey={yKey}
              tickFormatter={tick}
              tick={axisText}
              stroke={p.print}
              width={58}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                offset: 4,
                fill: p.print,
                fontSize: 12,
                fontFamily: PRINT_FONT,
                style: { textAnchor: "middle" },
              }}
            />
            <Tooltip
              formatter={(v) => sf3(Number(v))}
              labelFormatter={(l) => `${xLabel.split(" (")[0]}: ${sf3(Number(l))}`}
              contentStyle={{ background: p.sheet, border: `1px solid ${p.print}`, borderRadius: 0, color: p.print, fontSize: 13, fontFamily: PRINT_FONT }}
              cursor={{ stroke: p.pencil, strokeDasharray: "2 3" }}
            />
            {series.map((s) => (
              <Line
                // remount when plotting starts so Recharts runs its draw-in once
                key={`${s.name}-${phase === "waiting" ? "w" : "p"}`}
                name={s.name}
                data={s.data}
                dataKey={yKey}
                stroke={s.color}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                dot={false}
                strokeWidth={2}
                activeDot={{ r: 4, stroke: p.sheet, strokeWidth: 2 }}
                strokeOpacity={phase === "waiting" ? 0 : 1}
                isAnimationActive={phase === "plotting"}
                animationBegin={300}
                animationDuration={1100}
                animationEasing="ease-out"
                onAnimationEnd={() => setPhase("done")}
              />
            ))}
            {marker && (
              <ReferenceLine
                x={marker.x}
                stroke={p.red}
                strokeWidth={1.5}
                label={{ value: marker.label, position: "insideTopLeft", fill: p.red, fontSize: 16, fontFamily: HAND_FONT }}
              />
            )}
            {dot && (
              <ReferenceDot
                x={dot.x}
                y={dot.y}
                r={5}
                fill="none"
                stroke={p.red}
                strokeWidth={2}
                label={{ value: dot.label, position: "top", fill: p.red, fontSize: 16, fontFamily: HAND_FONT }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        {linked && (
          <div className="overlay" ref={boxRef} style={{ left: PLOT.left, right: PLOT.right, top: PLOT.top, bottom: PLOT.bottom }} aria-hidden="true">
            {timeAxis && <div className="track cover" ref={coverRef} />}
            {timeAxis && <div className="track"><div className="hover-line" ref={hoverRef} /></div>}
            <div className="track"><div className="now-line" ref={nowRef} /></div>
          </div>
        )}
        </div>
      </div>
      {note && <p className="margin-note">{note}</p>}
    </figure>
  );
}
