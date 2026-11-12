"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { R, type Interior, type Sample } from "@/lib/physics";
import { sf3 } from "@/lib/format";
import { timeline } from "@/lib/timeline";

/** Linearly interpolate the sample list at time t (binary search). */
export function sampleAt(samples: Sample[], t: number): Sample {
  if (t <= samples[0].t) return samples[0];
  const last = samples[samples.length - 1];
  if (t >= last.t) return last;
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const f = (t - a.t) / (b.t - a.t);
  const mix = (p: number, q: number) => p + (q - p) * f;
  return { t, r: mix(a.r, b.r), v: mix(a.v, b.v), a: mix(a.a, b.a), x: mix(a.x, b.x) };
}

const SPEEDS = [25, 50, 100, 250, 500, 1000];

/** "12000" -> "12 000" (thin-space thousands, as in a lab notebook). */
const km = (x: number) =>
  Math.round(x).toLocaleString("en-US").replace(/,/g, " ").replace("-", "−");

// SVG layout (viewBox units)
const W = 540;
const H = 520;
const PAD = 26;
const CX = 205; // planet centre x
const RULER_X = 425; // depth ruler x
const MAX_PLANET_PX = 175;

/** Don't hijack keys while someone is typing or using a control. */
const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.closest("input, select, textarea, button, [role='slider'], [role='button']") !== null || el.isContentEditable);

/**
 * Cross-section of Vulcan with a borehole-style depth ruler drawn at the
 * same vertical scale, so the probe on the shaft and its marker on the
 * ruler always sit on one horizontal line.
 *
 * Time comes from the shared `timeline` store, so hovering any time graph
 * shows a pencil "ghost" probe at that moment, and clicking a graph moves
 * the real probe there.
 */
export default function CrossSection({
  samples,
  r0,
  interior,
}: {
  samples: Sample[];
  r0: number;
  interior: Interior;
}) {
  const { time: simTime, hover } = useSyncExternalStore(timeline.subscribe, timeline.get, timeline.get);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(100);
  const endTime = samples[samples.length - 1].t;
  const hatchId = `rock-${useId().replace(/:/g, "")}`;

  // Reset whenever the simulation itself changes.
  useEffect(() => {
    timeline.set({ time: 0, end: endTime });
    setPlaying(false);
  }, [samples, endTime]);

  // requestAnimationFrame loop: advance sim time by (real seconds × speed).
  const lastFrame = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) {
      lastFrame.current = null;
      return;
    }
    let id = 0;
    const frame = (now: number) => {
      const dtReal = lastFrame.current === null ? 0 : (now - lastFrame.current) / 1000;
      lastFrame.current = now;
      const next = Math.min(endTime, timeline.get().time + dtReal * speed);
      timeline.set({ time: next });
      if (next >= endTime) {
        setPlaying(false);
        return;
      }
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [playing, speed, endTime]);

  const onPlay = () => {
    if (timeline.get().time >= endTime) timeline.set({ time: 0 });
    setPlaying((p) => !p);
  };
  const onReset = () => {
    setPlaying(false);
    timeline.set({ time: 0 });
  };

  // Keyboard: space = drop / pause, arrows = step 1 % of the fall, R = reset.
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const step = endTime / 100;
      if (e.key === " ") {
        e.preventDefault();
        onPlayRef.current();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const t = Math.min(endTime, Math.max(0, timeline.get().time + dir * step * (e.shiftKey ? 10 : 1)));
        timeline.set({ time: t });
      } else if (e.key === "r" || e.key === "R") {
        setPlaying(false);
        timeline.set({ time: 0 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [endTime]);

  const s = sampleAt(samples, simTime);
  const ghost = hover !== null ? sampleAt(samples, hover) : null;
  const shown = ghost ?? s; // the readout follows the pointer while hovering

  // --- geometry: fit release point (top) to the bottom of the planet ---
  const span = r0 + R;
  const scale = Math.min((H - 2 * PAD) / span, MAX_PLANET_PX / R);
  const top = (H - span * scale) / 2;
  const cy = top + r0 * scale; // planet centre y
  const P = R * scale; // planet radius in px
  const yOf = (r: number) => cy - r * scale;
  const surfaceY = yOf(R);
  const probeY = yOf(s.r);
  const releaseY = yOf(r0);

  // Ruler ticks: a "nice" step giving at most ~8 labels from release to centre.
  const hTop = (r0 - R) / 1000;
  const totalKm = r0 / 1000;
  const step = [500, 1000, 2000, 2500, 5000].find((st) => totalKm / st <= 8) ?? 5000;
  const ticks: number[] = [];
  for (let h = Math.floor(hTop / step) * step; h > -R / 1000; h -= step) ticks.push(h);

  const whereOf = (r: number) => (r >= R ? "above the surface" : r > 0 ? "in the shaft" : "at the centre");

  return (
    <div className="cross">
      <div className="taped is-settling" style={{ "--tilt": "-0.6deg" } as CSSProperties}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cross-section of Vulcan. The probe is ${whereOf(s.r)}, ${sf3(s.r / 1000)} km from the centre.`}>
          <defs>
            <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" style={{ stroke: "var(--rock-deep)" }} strokeWidth="1.2" />
            </pattern>
          </defs>

          {/* atmosphere: a thin halo */}
          <circle cx={CX} cy={cy} r={P + 4} style={{ fill: "var(--air)" }} />
          {/* the planet, pencil-shaded with an outline */}
          <circle cx={CX} cy={cy} r={P} style={{ fill: "var(--rock)", stroke: "var(--pencil)" }} strokeWidth="1.2" />
          <circle cx={CX} cy={cy} r={P} fill={`url(#${hatchId})`} opacity="0.35" />
          {interior === "dense-core" && (
            <circle cx={CX} cy={cy} r={P * 0.16} style={{ fill: "var(--core)" }} />
          )}

          {/* drilled shaft and the path already travelled */}
          <rect x={CX - 3} y={surfaceY} width="6" height={P} style={{ fill: "var(--shaft)" }} />
          <line x1={CX} x2={CX} y1={releaseY} y2={probeY} style={{ stroke: "var(--red)" }} strokeWidth="2" strokeDasharray="1 5" strokeLinecap="round" />
          <circle cx={CX} cy={cy} r="2.5" style={{ fill: "var(--paper)" }} />

          {/* release point */}
          {r0 > R && (
            <g>
              <line x1={CX - 14} x2={CX + 14} y1={releaseY} y2={releaseY} style={{ stroke: "var(--muted)" }} strokeWidth="1.5" />
              <text x={CX - 20} y={releaseY + 4} textAnchor="end" className="svg-label">released here</text>
            </g>
          )}

          {/* depth ruler */}
          <line x1={RULER_X} x2={RULER_X} y1={releaseY} y2={cy} style={{ stroke: "var(--muted)" }} strokeWidth="1.5" />
          <rect x={RULER_X - 5} y={surfaceY} width="10" height={P} style={{ fill: "var(--rock)" }} />
          <rect x={RULER_X - 5} y={surfaceY} width="10" height={P} fill={`url(#${hatchId})`} opacity="0.6" />
          {interior === "dense-core" && (
            <rect x={RULER_X - 5} y={cy - P * 0.16} width="10" height={P * 0.16} style={{ fill: "var(--core)" }} />
          )}
          {ticks.map((h) => {
            const y = yOf(R + h * 1000);
            if (h === 0) return null;
            return (
              <g key={h}>
                <line x1={RULER_X + 5} x2={RULER_X + 11} y1={y} y2={y} style={{ stroke: "var(--muted)" }} />
                <text x={RULER_X + 15} y={y + 4} className="svg-tick">{h > 0 ? "+" : ""}{km(h)}</text>
              </g>
            );
          })}
          {/* ground symbol at the surface: a line with hatching underneath */}
          <line x1={RULER_X - 12} x2={RULER_X + 26} y1={surfaceY} y2={surfaceY} style={{ stroke: "var(--ink)" }} strokeWidth="1.5" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={i} x1={RULER_X - 10 + i * 6.5} x2={RULER_X - 14 + i * 6.5} y1={surfaceY} y2={surfaceY + 5} style={{ stroke: "var(--ink)" }} />
          ))}
          <text x={RULER_X + 30} y={surfaceY + 4} className="svg-tick strong">0 surface</text>
          <text x={RULER_X + 15} y={cy + 4} className="svg-tick">{km(-R / 1000)}</text>
          <text x={RULER_X + 15} y={cy + 20} className="svg-label">centre</text>
          <text x={RULER_X - 12} y={Math.max(14, releaseY - 12)} className="svg-label">height, km</text>

          {/* Red-matter collapse: when the probe reaches the centre, three
              rings fall inward into the core and leave a dark point.
              Re-keyed per run so it replays on every drop. */}
          {s.r <= 0 && (
            <g className="collapse" key={`collapse-${endTime}`}>
              {[1, 0.7, 0.45].map((k, i) => (
                <circle key={i} cx={CX} cy={cy} r={P * k} style={{ animationDelay: `${i * 140}ms` }} />
              ))}
              <circle className="singularity" cx={CX} cy={cy} r="7" />
            </g>
          )}

          {/* pencil ghost: where the probe is at the hovered moment on a graph */}
          {ghost && (
            <g className="ghost-probe">
              <circle cx={CX} cy={yOf(ghost.r)} r="7" />
              <text x={CX + 14} y={yOf(ghost.r) + 5} className="svg-label">t = {sf3(ghost.t)} s</text>
            </g>
          )}

          {/* probe on the shaft, its twin on the ruler, and the line joining them */}
          <line x1={CX + 8} x2={RULER_X - 8} y1={probeY} y2={probeY} style={{ stroke: "var(--red)" }} strokeWidth="1" strokeDasharray="3 4" opacity="0.7" />
          <path d={`M ${RULER_X - 7} ${probeY} l -8 -5 v 10 z`} style={{ fill: "var(--red)" }} />
          <circle cx={CX} cy={probeY} r="6.5" style={{ fill: "var(--red)", stroke: "var(--paper)" }} strokeWidth="2" />
        </svg>
      </div>

      <div className="transport">
        <button className="btn primary" onClick={onPlay} aria-pressed={playing}>
          {playing ? "Pause" : simTime >= endTime ? "Drop again" : simTime > 0 ? "Resume" : "Drop the probe"}
        </button>
        <button className="btn" onClick={onReset}>Reset</button>
        <label className="speed">
          <span>Playback</span>
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((x) => (
              <option key={x} value={x}>{x}× real time</option>
            ))}
          </select>
        </label>
      </div>
      <input
        type="range"
        className="scrub"
        min={0}
        max={endTime}
        step={endTime / 1000}
        value={simTime}
        onChange={(e) => { setPlaying(false); timeline.set({ time: Number(e.target.value) }); }}
        aria-label="Scrub through the fall"
      />
      <p className="keys">(space bar = drop, arrow keys = step through it)</p>
      <dl className={`readout${ghost ? " is-ghost" : ""}`}>
        <div><dt>{ghost ? "Time (hovering)" : "Time"}</dt><dd>{sf3(shown.t)} s</dd></div>
        <div><dt>Height</dt><dd>{sf3((shown.r - R) / 1000)} km</dd></div>
        <div><dt>Speed</dt><dd>{sf3(shown.v)} m/s</dd></div>
        <div><dt>Acceleration</dt><dd>{sf3(shown.a)} m/s²</dd></div>
      </dl>
      <p className="where">The probe is {whereOf(shown.r)}.</p>
    </div>
  );
}
