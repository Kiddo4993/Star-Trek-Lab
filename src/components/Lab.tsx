"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_DROP_HEIGHT,
  DT,
  G0,
  POPULATION,
  R,
  exactSolution,
  gravity,
  rateVsHeight,
  simulate,
  thin,
  type Interior,
} from "@/lib/physics";
import { sf3 } from "@/lib/format";
import { PALETTE as p } from "@/lib/theme";
import CrossSection, { sampleAt } from "./CrossSection";
import { Scrub } from "./Scrub";
import { Chart, type Series } from "./Charts";

/** Percent difference between Euler and exact, or "—" if no exact value. */
const pctDiff = (euler: number | null, exact: number | null) =>
  euler === null || exact === null || exact === 0 ? "—" : `${sf3((100 * (euler - exact)) / exact)} %`;

const MODEL_NAME: Record<Interior, string> = { uniform: "uniform", "dense-core": "dense core" };

/** The value once it has stopped changing for `ms` (so animations don't fire mid-drag). */
function useSettled<T>(value: T, ms = 350): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

/**
 * Underlined words in a sentence that toggle a setting when clicked.
 * A span, not a <button>: Chrome won't wrap a button across lines, and
 * these phrases need to flow like ordinary text. Enter/Space work too.
 */
function WordToggle({ label, onToggle, children }: { label: string; onToggle: () => void; children: React.ReactNode }) {
  return (
    <span
      className="word-toggle"
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {children}
    </span>
  );
}

/** Red-pen marking of the reader's guess against the simulated time. */
function markGuess(guess: number, actual: number): string {
  const pct = (100 * (guess - actual)) / actual;
  if (Math.abs(pct) < 5) return "✓ within 5 %. Nice.";
  return `✗ ${sf3(Math.abs(pct))} % too ${pct > 0 ? "long" : "short"}`;
}

export default function Lab() {
  // ---- user inputs ----
  const [heightKm, setHeightKm] = useState(DEFAULT_DROP_HEIGHT / 1000);
  const [launchSpeed, setLaunchSpeed] = useState(0);
  const [interior, setInterior] = useState<Interior>("uniform");
  const [drag, setDrag] = useState(false);

  // Deferred copies let the sliders stay responsive while sims recompute.
  const params = {
    heightKm: useDeferredValue(heightKm),
    launchSpeed: useDeferredValue(launchSpeed),
    interior: useDeferredValue(interior),
    drag: useDeferredValue(drag),
  };
  const dropHeight = params.heightKm * 1000;
  const modelColor = params.interior === "uniform" ? p.uniform : p.dense;

  // ---- main simulation (dt = 0.01 s) ----
  const sim = useMemo(
    () => simulate({ dropHeight, launchSpeed: params.launchSpeed, interior: params.interior, drag: params.drag }),
    [dropHeight, params.launchSpeed, params.interior, params.drag]
  );
  const exact = useMemo(
    () => exactSolution(dropHeight, params.launchSpeed, params.interior),
    [dropHeight, params.launchSpeed, params.interior]
  );
  const plotData = useMemo(
    () => thin(sim.samples).map((s) => ({ t: s.t, v: s.v, a: s.a, xKm: s.x / 1000 })),
    [sim]
  );

  // ---- ghost of the previous run, drawn in pencil on the velocity graph ----
  type Run = { data: { t: number; v: number }[]; end: number };
  // Only runs the reader settled on count, not every in-between value
  // passed through while a slider is being dragged.
  const run = useMemo<Run>(
    () => ({ data: plotData.map(({ t, v }) => ({ t, v })), end: sim.totalTime }),
    [plotData, sim.totalTime]
  );
  const settledRun = useSettled(run);
  const [ghost, setGhost] = useState<Run | null>(null);
  const lastRun = useRef<Run | null>(null);
  useEffect(() => {
    if (lastRun.current && lastRun.current !== settledRun) setGhost(lastRun.current);
    lastRun.current = settledRun;
  }, [settledRun]);

  // ---- "guess first" ----
  const [guess, setGuess] = useState("");
  const guessNum = Number(guess);
  const guessMark = guess.trim() !== "" && guessNum > 0 ? markGuess(guessNum, sim.totalTime) : null;

  // The highlighter re-swipes when the answer settles on a new value.
  const settledAnswer = useSettled(`${sf3(sim.totalTime)}|${sf3(sim.rate)}`);

  // ---- both interior models, without and with drag ----
  const comparison = useMemo(() => {
    const run = (interior: Interior, drag: boolean) => {
      const res = simulate({ dropHeight, launchSpeed: params.launchSpeed, interior, drag });
      return {
        data: thin(res.samples, 400).map((s) => ({ t: s.t, v: s.v })),
        surfaceTime: res.surfaceTime,
        end: res.totalTime,
      };
    };
    return {
      noDrag: [run("uniform", false), run("dense-core", false)],
      withDrag: [run("uniform", true), run("dense-core", true)],
    };
  }, [dropHeight, params.launchSpeed]);

  const pair = (runs: typeof comparison.noDrag): Series[] => [
    { name: "Uniform", data: runs[0].data, color: p.uniform },
    { name: "Dense core", data: runs[1].data, color: p.dense },
  ];
  // The fall above ground doesn't depend on the interior, so both runs
  // reach the surface together; shade from there to the later finish.
  const rockFor = (runs: typeof comparison.noDrag) =>
    runs[0].surfaceTime !== null && runs[0].surfaceTime > 0
      ? { x1: runs[0].surfaceTime, x2: Math.max(runs[0].end, runs[1].end), label: "in the shaft" }
      : null;

  // ---- g vs r for both interior models ----
  const gSeries = useMemo<Series[]>(() => {
    const rMax = Math.max(sim.r0, 2 * R);
    const pts = (interior: Interior) =>
      Array.from({ length: 301 }, (_, i) => {
        const r = (rMax * i) / 300;
        return { rKm: r / 1000, g: gravity(r, interior) };
      });
    return [
      { name: "Uniform", data: pts("uniform"), color: p.uniform },
      { name: "Dense core", data: pts("dense-core"), color: p.dense },
    ];
  }, [sim.r0]);

  // ---- rate vs drop height, 0 – 10 000 km ----
  const rateData = useMemo(() => {
    const heights = Array.from({ length: 41 }, (_, i) => i * 250);
    return rateVsHeight(heights, params.launchSpeed, params.interior, params.drag);
  }, [params.launchSpeed, params.interior, params.drag]);

  const hasSurface = sim.surfaceTime !== null && sim.surfaceTime > 0;
  const surfaceMarker = hasSurface ? { x: sim.surfaceTime!, label: "surface" } : null;
  const shaft = hasSurface ? { x1: sim.surfaceTime!, x2: sim.totalTime, label: "" } : null;

  const stale =
    params.heightKm !== heightKm || params.launchSpeed !== launchSpeed ||
    params.interior !== interior || params.drag !== drag;
  const isTextbook = heightKm === DEFAULT_DROP_HEIGHT / 1000 && launchSpeed === 0 && interior === "uniform" && !drag;

  // Red-pen tick when Euler agrees with the exact answer to 3 s.f.
  const checked = !params.drag && exact.total !== null && sf3(exact.total) === sf3(sim.totalTime);

  // Handwritten notes only where they're true for the current settings.
  const velocityNote = params.drag
    ? undefined
    : params.interior === "uniform"
      ? "Fastest right at the centre: g has dropped to zero there, so nothing is left to speed it up."
      : "Still speeding up at the centre, because g stays 13.73 m/s² all the way down.";
  const accelNote = params.drag
    ? undefined
    : params.interior === "uniform"
      ? "Peaks at the surface, then falls to zero at the centre."
      : "Flat at 13.73 m/s² once it's inside.";

  return (
    <main className="notebook">
      <header className="titleblock">
        <div className="tb-cell tb-project">
          <span className="tb-key">project</span>
          <span className="tb-val">Star Trek Lab</span>
        </div>
        <div className="tb-cell tb-problem">
          <span className="tb-key">problem</span>
          <span className="tb-val">Red-matter probe dropped down a shaft to the centre of Vulcan</span>
        </div>
        <div className="tb-cell">
          <span className="tb-key">given</span>
          <span className="tb-val small">
            R = {sf3(R)} m, g₀ = {sf3(G0)} m/s², population {sf3(POPULATION)}
          </span>
        </div>
      </header>

      <section className="entry">
        <h2>Aim</h2>
        <p className="reactive">
          Find how long the probe takes to fall from{" "}
          <Scrub value={heightKm} min={0} max={10000} step={50} format={(v) => `${sf3(v)} km`}
            label="Drop height" onChange={setHeightKm} />{" "}
          above the surface,{" "}
          <Scrub value={launchSpeed} min={0} max={10000} step={50}
            format={(v) => (v === 0 ? "starting from rest" : `launched at ${sf3(v)} m/s`)}
            label="Launch speed toward the centre" onChange={setLaunchSpeed} />
          , down to the centre of a Vulcan that is{" "}
          <WordToggle label="Switch interior model"
            onToggle={() => setInterior(interior === "uniform" ? "dense-core" : "uniform")}>
            {interior === "uniform" ? "the same density all the way through" : "mostly a dense core"}
          </WordToggle>
          ,{" "}
          <WordToggle label="Toggle air drag" onToggle={() => setDrag(!drag)}>
            {drag ? "with air drag" : "ignoring air"}
          </WordToggle>
          . Then work out how many Vulcans per second that is.
        </p>
        <p className="hint">Drag the underlined numbers, click the underlined words.</p>

        <div className="guess">
          <label htmlFor="guess">My guess first:</label>
          <input id="guess" type="number" inputMode="decimal" min={0} placeholder="?" value={guess}
            onChange={(e) => setGuess(e.target.value)} />
          <span>s</span>
          {guessMark && <span className="redpen mark" key={guessMark}>{guessMark}</span>}
        </div>

        <p className="answer" key={settledAnswer}>
          <span className="hl">t = {sf3(sim.totalTime)} s</span>
          <span className="so">so</span>
          <span className="hl hl-2">{sf3(sim.rate)} Vulcans/s</span>
          {checked && <span className="redpen" title="Euler matches the exact formula to 3 s.f.">✓ matches exact</span>}
        </p>
      </section>

      <section className="entry setup">
        <h2>Set-up</h2>
        <div className="setup-grid">
          <CrossSection samples={sim.samples} r0={sim.r0} interior={params.interior} />

          <fieldset className="vars">
            <legend className="hand-label">Things I can change</legend>
            <label className="field">
              <span className="field-row"><span>Drop height</span><output>{sf3(heightKm)} km</output></span>
              <input type="range" min={0} max={10000} step={10} value={heightKm}
                onChange={(e) => setHeightKm(Number(e.target.value))} />
            </label>
            <label className="field">
              <span className="field-row">
                <span>Launch speed (toward centre)</span>
                <output>{launchSpeed === 0 ? "from rest" : `${sf3(launchSpeed)} m/s`}</output>
              </span>
              <input type="range" min={0} max={10000} step={50} value={launchSpeed}
                onChange={(e) => setLaunchSpeed(Number(e.target.value))} />
            </label>
            <label className="field">
              <span className="field-row"><span>Inside Vulcan</span></span>
              <select value={interior} onChange={(e) => setInterior(e.target.value as Interior)}>
                <option value="uniform">uniform density (g = g₀·r/R)</option>
                <option value="dense-core">dense core (g = 13.73 m/s² inside)</option>
              </select>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={drag} onChange={(e) => setDrag(e.target.checked)} />
              <span>
                Air drag
                <small>2000 kg sphere, C<sub>d</sub> = 0.47, ρ = 1.2·e<sup>−h/8500</sup> kg/m³</small>
              </span>
            </label>
            <div className="vars-foot">
              <button className="btn" disabled={isTextbook}
                onClick={() => { setHeightKm(DEFAULT_DROP_HEIGHT / 1000); setLaunchSpeed(0); setInterior("uniform"); setDrag(false); }}>
                Back to the textbook problem
              </button>
              <span className="status" aria-live="polite">{stale ? "working it out…" : ""}</span>
            </div>
          </fieldset>
        </div>
      </section>

      <section className="entry">
        <h2>Results</h2>
        <div className="table-wrap">
          <table className="ruled">
            <thead>
              <tr><th scope="col"></th><th scope="col">Euler</th><th scope="col">Exact{params.drag ? "*" : ""}</th><th scope="col">diff.</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">time to surface, t₁</th><td>{sf3(sim.surfaceTime)} s</td><td>{sf3(exact.t1)} s</td><td>{pctDiff(sim.surfaceTime, exact.t1)}</td></tr>
              <tr>
                <th scope="row">surface to centre, t₂</th>
                <td>{sim.surfaceTime === null ? "—" : `${sf3(sim.totalTime - sim.surfaceTime)} s`}</td>
                <td>{sf3(exact.t2)} s</td>
                <td>{sim.surfaceTime === null ? "—" : pctDiff(sim.totalTime - sim.surfaceTime, exact.t2)}</td>
              </tr>
              <tr className="key"><th scope="row">total time</th><td><span className="hl">{sf3(sim.totalTime)} s</span></td><td>{sf3(exact.total)} s</td><td>{pctDiff(sim.totalTime, exact.total)}</td></tr>
              <tr><th scope="row">speed at surface</th><td>{sf3(sim.surfaceSpeed)} m/s</td><td>{sf3(exact.surfaceSpeed)} m/s</td><td>{pctDiff(sim.surfaceSpeed, exact.surfaceSpeed)}</td></tr>
              <tr><th scope="row">speed at centre</th><td>{sf3(sim.finalSpeed)} m/s</td><td>—</td><td>—</td></tr>
              <tr className="key"><th scope="row">rate (Vulcans/s)</th><td><span className="hl">{sf3(sim.rate)}</span></td><td>{sf3(exact.rate)}</td><td>{pctDiff(sim.rate, exact.rate)}</td></tr>
            </tbody>
          </table>
        </div>
        <ul className="footnotes">
          {params.drag && <li>* The exact formulas ignore drag, so here the difference shows how much drag matters.</li>}
          {!sim.reachedCentre && <li>The simulation hit its time limit before reaching the centre.</li>}
          {exact.t1 === null && <li>Launch speed is above escape speed, so the exact t₁ formula (which assumes a bound fall) doesn&apos;t apply.</li>}
          <li>Euler steps of {DT} s. Everything rounded to 3 significant figures.</li>
        </ul>
      </section>

      <section className="entry">
        <h2>Graphs</h2>
        <p className="aside">
          Velocity and acceleration count as positive toward the centre. Pencil shading is time spent
          inside the rock. Hover a graph to see where the probe was at that moment; click to send it there.
        </p>
        <Chart
          title="velocity vs time"
          xKey="t" yKey="v" xLabel="Time (s)" yLabel="Velocity (m/s)"
          series={[
            { name: "This run", data: plotData, color: modelColor },
            ...(ghost ? [{ name: "Previous settings", data: ghost.data, color: p.pencil, dashed: true }] : []),
          ]}
          marker={surfaceMarker} rock={shaft} height={290} tilt={-0.4}
          timeAxis xDomain={[0, Math.max(sim.totalTime, ghost?.end ?? 0)]}
          note={velocityNote}
        />
        <div className="pair">
          <Chart
            title="acceleration vs time"
            xKey="t" yKey="a" xLabel="Time (s)" yLabel="Acceleration (m/s²)"
            series={[{ name: "Acceleration", data: plotData, color: modelColor }]}
            marker={surfaceMarker} rock={shaft} tilt={0.5}
            timeAxis xDomain={[0, sim.totalTime]}
            note={accelNote}
          />
          <Chart
            title="displacement vs time"
            xKey="t" yKey="xKm" xLabel="Time (s)" yLabel="Displacement (km)"
            series={[{ name: "Displacement", data: plotData, color: modelColor }]}
            marker={surfaceMarker} rock={shaft} tilt={-0.3}
            timeAxis xDomain={[0, sim.totalTime]}
          />
        </div>
        <div className="pair">
          <Chart
            title="g vs distance from centre"
            xKey="rKm" yKey="g" xLabel="Distance from centre, r (km)" yLabel="g (m/s²)"
            series={gSeries}
            rock={{ x1: 0, x2: R / 1000, label: "inside Vulcan" }} tilt={0.3}
            xDomain={[0, Math.max(sim.r0, 2 * R) / 1000]}
            followX={(t) => sampleAt(sim.samples, t).r / 1000}
            note="Outside, both models are the same GM/r² curve. They only split once you're underground."
          />
          <Chart
            title="rate vs drop height"
            caption={`${MODEL_NAME[params.interior]}${params.drag ? ", with drag" : ""}, dt = 0.05 s`}
            xKey="hKm" yKey="rate" xLabel="Drop height (km)" yLabel="Rate (Vulcans/s)"
            series={[{ name: "Rate", data: rateData, color: modelColor }]}
            dot={{ x: params.heightKm, y: sim.rate, label: "this drop" }}
            xDomain={[0, 10000]} tilt={-0.5}
          />
        </div>
      </section>

      <section className="entry">
        <h2>Does the model of Vulcan matter?</h2>
        <p className="aside">
          Same drop, both interiors. Drag gets its own graph: it slows the fall so much that, on one
          time axis, the drag-free lines would be squashed against the left edge.
        </p>
        <div className="pair">
          <Chart
            title="velocity, no drag"
            xKey="t" yKey="v" xLabel="Time (s)" yLabel="Velocity (m/s)"
            series={pair(comparison.noDrag)} rock={rockFor(comparison.noDrag)} tilt={0.4}
          />
          <Chart
            title="velocity, with drag"
            xKey="t" yKey="v" xLabel="Time (s)" yLabel="Velocity (m/s)"
            series={pair(comparison.withDrag)} rock={rockFor(comparison.withDrag)} tilt={-0.4}
          />
        </div>
      </section>

      <section className="entry working">
        <h2>Working</h2>
        <dl>
          <dt>gravity outside</dt><dd>g = GM/r², with GM = g₀R² = {sf3(G0 * R * R)} m³/s²</dd>
          <dt>gravity inside</dt><dd>uniform: g = g₀r/R; dense core: g = g₀</dd>
          <dt>Euler step</dt><dd>a = a(r), then v += a·dt, then r −= v·dt. Repeat until r = 0.</dd>
          <dt>exact, outside</dt><dd>t₁ = √(r₀³/2GM)·[√(x(1−x)) + cos⁻¹√x], x = R/r₀</dd>
          <dt>exact, inside</dt><dd>uniform: t₂ = tan⁻¹(ωR/v<sub>s</sub>)/ω, ω = √(g₀/R)<br />dense core: t₂ = (−v<sub>s</sub> + √(v<sub>s</sub>² + 2g₀R))/g₀</dd>
          <dt>rate</dt><dd>population ÷ total fall time</dd>
        </dl>
        <p className="foot">The physics code is in <code>src/lib/physics.ts</code>.</p>
      </section>
    </main>
  );
}
