/**
 * Physics for the red-matter probe falling down a hole to the centre of
 * Vulcan.
 *
 * Signs (same in the whole file):
 *   r  = distance from Vulcan's centre (m)
 *   v  = speed TOWARD the centre (m/s)  -> positive while falling in
 *   a  = acceleration TOWARD the centre (m/s²)
 *
 * This module has no imports so it can run both in the browser and in
 * `scripts/verify.mjs` under plain Node.
 */

// ---------------------------------------------------------------------------
// Given constants
// ---------------------------------------------------------------------------

/** Surface gravity of Vulcan (m/s²). */
export const G0 = 13.73;
/** Radius of Vulcan (m). */
export const R = 6.792e6;
/** Population of Vulcan. */
export const POPULATION = 7.0e9;
/** GM from g0 = GM / R²  =>  GM = g0·R²  (m³/s²). */
export const GM = G0 * R * R;
/** Euler time step (s). */
export const DT = 0.01;
/** Default drop height above the surface (m). */
export const DEFAULT_DROP_HEIGHT = 2.0e6;

// Probe / air-drag constants
export const PROBE_MASS = 2000; // kg
export const DRAG_COEFF = 0.47; // sphere
/**
 * The problem gives the mass but not the size of the sphere, so a radius
 * is ASSUMED here. Change it to explore how size affects drag.
 */
export const PROBE_RADIUS = 0.5; // m (assumed)
export const PROBE_AREA = Math.PI * PROBE_RADIUS * PROBE_RADIUS; // m²
export const RHO_SEA_LEVEL = 1.2; // kg/m³
export const SCALE_HEIGHT = 8500; // m

export type Interior = "uniform" | "dense-core";

export const INTERIOR_LABEL: Record<Interior, string> = {
  uniform: "Uniform density (g = g₀·r/R)",
  "dense-core": "Dense core (g = 13.73 m/s² inside)",
};

// ---------------------------------------------------------------------------
// Gravity and air
// ---------------------------------------------------------------------------

/**
 * Gravitational field strength (m/s², pointing toward the centre) at
 * distance r from the centre.
 *
 * Outside (r ≥ R): Newton's law, g = GM / r².
 * Inside, uniform density: only the mass inside radius r pulls
 *   (shell theorem), M(r) ∝ r³, so g = GM(r)/r² = g0·r/R.
 * Inside, dense core: nearly all mass is concentrated at the centre, so
 *   the field stays at its surface value, g = g0.
 */
export function gravity(r: number, interior: Interior): number {
  if (r >= R) return GM / (r * r);
  return interior === "uniform" ? (G0 * r) / R : G0;
}

/**
 * Air density (kg/m³) at altitude h above the surface (h < 0 means the
 * probe is inside the drilled hole).
 *
 * Above ground: exponential atmosphere ρ = 1.2·e^(−h/8500).
 */
export function airDensity(h: number): number {
  if (h >= 0) return RHO_SEA_LEVEL * Math.exp(-h / SCALE_HEIGHT);

  // TODO(you): decide what air is like INSIDE the shaft (h < 0).
  // Note: just continuing the formula blows up — at h = −R it gives
  // 1.2·e^(+799), which is Infinity in floating point.
  // Placeholder for now: sea-level air all the way down.
  return RHO_SEA_LEVEL;
}

/**
 * Drag acceleration magnitude (m/s²) from F = ½·ρ·Cd·A·v², divided by m.
 * Drag always opposes motion, so the caller subtracts it in the direction
 * of v.
 */
export function dragAccel(r: number, v: number): number {
  const rho = airDensity(r - R);
  return (0.5 * rho * DRAG_COEFF * PROBE_AREA * v * v) / PROBE_MASS;
}

/** Net acceleration toward the centre: gravity minus drag (opposing v). */
export function netAccel(
  r: number,
  v: number,
  interior: Interior,
  drag: boolean
): number {
  let a = gravity(r, interior);
  if (drag) a -= Math.sign(v) * dragAccel(r, v);
  return a;
}

// ---------------------------------------------------------------------------
// Euler simulation
// ---------------------------------------------------------------------------

export interface SimOptions {
  /** Height of the release point above the surface (m). */
  dropHeight: number;
  /** Initial speed toward the centre (m/s). 0 = dropped from rest. */
  launchSpeed: number;
  interior: Interior;
  drag: boolean;
  /** Time step (s). Defaults to DT = 0.01 s. */
  dt?: number;
  /** Record a sample every this many seconds of sim time. 0 = don't record. */
  recordEvery?: number;
  /** Safety cap on simulated time (s). */
  maxTime?: number;
}

export interface Sample {
  t: number; // s
  r: number; // m from centre
  v: number; // m/s toward centre
  a: number; // m/s² toward centre
  x: number; // m, displacement from release point (toward centre +)
}

export interface SimResult {
  samples: Sample[];
  r0: number;
  totalTime: number; // s, time to reach r = 0
  reachedCentre: boolean;
  surfaceTime: number | null; // s, time at which r first drops below R
  surfaceSpeed: number | null; // m/s at that moment
  finalSpeed: number; // m/s at the centre
  /** Vulcans per second: population ÷ total fall time. */
  rate: number;
}

/**
 * Euler's method. The acceleration keeps changing, so the fall is cut into
 * tiny steps of dt seconds and a is treated as constant during each one:
 *   1. a = acceleration at the current r (and v, for drag)
 *   2. v = v + a*dt
 *   3. r = r - v*dt   (minus because v points toward the centre)
 * The new v and r are the start of the next step. Stop when r reaches 0.
 *
 * Step 3 uses the new v, not the old one. That small change (called
 * Euler-Cromer) keeps it accurate inside the planet, where the probe
 * moves like a mass on a spring and plain Euler slowly gains energy.
 */
export function simulate(opts: SimOptions): SimResult {
  const dt = opts.dt ?? DT;
  const { interior, drag } = opts;
  const r0 = R + opts.dropHeight;
  const maxSteps = Math.ceil((opts.maxTime ?? 2e5) / dt);
  const recordEvery = opts.recordEvery ?? 1;
  const stepsPerRecord =
    recordEvery > 0 ? Math.max(1, Math.round(recordEvery / dt)) : 0;

  let r = r0;
  let v = opts.launchSpeed;
  let step = 0;

  // If released at (or below) the surface, it "crosses" at t = 0.
  let surfaceTime: number | null = r0 <= R ? 0 : null;
  let surfaceSpeed: number | null = r0 <= R ? v : null;

  const samples: Sample[] = [];
  const record = (t: number) => {
    const rr = Math.max(r, 0);
    samples.push({ t, r: rr, v, a: netAccel(rr, v, interior, drag), x: r0 - rr });
  };
  if (stepsPerRecord) record(0);

  while (r > 0 && step < maxSteps) {
    const a = netAccel(r, v, interior, drag); // 1. a from position
    v += a * dt; // 2. v += a·dt
    const rPrev = r;
    r -= v * dt; // 3. r -= v·dt
    step++;
    // t = step·dt avoids round-off building up from repeated t += dt
    const t = step * dt;

    const crossed = surfaceTime === null && rPrev >= R && r < R;
    if (crossed) {
      surfaceTime = t;
      surfaceSpeed = v;
    }
    if (stepsPerRecord && (crossed || step % stepsPerRecord === 0 || r <= 0)) {
      record(t);
    }
  }

  const totalTime = step * dt;
  return {
    samples,
    r0,
    totalTime,
    reachedCentre: r <= 0,
    surfaceTime,
    surfaceSpeed,
    finalSpeed: v,
    rate: POPULATION / totalTime,
  };
}

// ---------------------------------------------------------------------------
// Helpers for charts
// ---------------------------------------------------------------------------

/**
 * Rate (Vulcans/s) for each drop height in heightsKm. This runs about 40
 * whole simulations, so it uses dt = 0.05 s to be faster. That changes the
 * answer by less than 0.1 %.
 */
export function rateVsHeight(
  heightsKm: number[],
  launchSpeed: number,
  interior: Interior,
  drag: boolean
): { hKm: number; rate: number; time: number }[] {
  return heightsKm.map((hKm) => {
    const res = simulate({
      dropHeight: hKm * 1000,
      launchSpeed,
      interior,
      drag,
      dt: 0.05,
      recordEvery: 0,
    });
    return { hKm, rate: res.rate, time: res.totalTime };
  });
}

/** Reduce a long sample list to at most `max` points for plotting. */
export function thin<T>(arr: T[], max = 600): T[] {
  if (arr.length <= max) return arr;
  const k = Math.ceil(arr.length / max);
  return arr.filter((_, i) => i % k === 0 || i === arr.length - 1);
}

/** One row of the "first few steps" table. */
export interface EulerStep {
  step: number;
  t: number; // s, time at the end of the step
  a: number; // m/s², acceleration used during the step
  v: number; // m/s, new velocity
  x: number; // m, total distance fallen so far
}

/**
 * The first n Euler steps, for showing the method by hand. It runs the
 * real simulate() and records every step, so the numbers are exactly the
 * ones the answer is built from. The acceleration used in step k is the
 * one worked out at the end of step k-1.
 */
export function firstSteps(opts: SimOptions, n = 3): EulerStep[] {
  const dt = opts.dt ?? DT;
  const s = simulate({ ...opts, dt, recordEvery: dt, maxTime: (n + 0.5) * dt }).samples;
  const rows: EulerStep[] = [];
  for (let k = 1; k <= n && k < s.length; k++) {
    rows.push({ step: k, t: s[k].t, a: s[k - 1].a, v: s[k].v, x: s[k].x });
  }
  return rows;
}
