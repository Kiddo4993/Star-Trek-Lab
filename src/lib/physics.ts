/**
 * Physics for the red-matter probe falling through a hole drilled to the
 * centre of Vulcan.
 *
 * Sign convention used everywhere in this file:
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
 * Step the motion with Euler's method exactly as specified:
 *   1. a  = a(r, v)          (acceleration from the current position)
 *   2. v += a·dt             (update velocity)
 *   3. r -= v·dt             (update position with the NEW velocity;
 *                             minus because v is toward the centre)
 * Repeat until r ≤ 0.
 *
 * Using the updated v in step 3 makes this the semi-implicit
 * (Euler–Cromer) variant, which is far more stable than plain Euler
 * for the spring-like motion inside the planet.
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
// Exact (analytic) solution, no drag
// ---------------------------------------------------------------------------

/**
 * Time to fall from rest at radius rA down to radius r (r ≤ rA) under
 * g = GM/r². This is the given formula with x = r/rA:
 *   t = sqrt(rA³ / 2GM) · [ sqrt(x(1−x)) + acos(sqrt x) ]
 */
function fallTimeFromRest(rA: number, r: number): number {
  const x = Math.min(1, Math.max(0, r / rA)); // clamp round-off
  return Math.sqrt((rA * rA * rA) / (2 * GM)) * (Math.sqrt(x * (1 - x)) + Math.acos(Math.sqrt(x)));
}

export interface ExactResult {
  t1: number | null; // s, release → surface (null if no closed form)
  t2: number; // s, surface → centre
  total: number | null;
  surfaceSpeed: number; // m/s
  rate: number | null; // Vulcans/s
}

/**
 * Closed-form answer for the drag-free case.
 *
 * Outside (t1): with launch speed v0 > 0 the probe moves as if it had been
 * dropped from rest at a higher "apex" radius rA, where energy conservation
 * gives 1/rA = 1/r0 − v0²/(2GM). Then t1 = T(rA→R) − T(rA→r0).
 * With v0 = 0, rA = r0, x = R/r0 and this is exactly the given formula.
 * If v0 ≥ escape speed, there is no apex (hyperbolic orbit) → t1 = null.
 *
 * Surface speed from energy conservation:
 *   vs² = v0² + 2GM(1/R − 1/r0)
 *
 * Inside (t2):
 *   uniform: SHM with ω = sqrt(g0/R); r(t) = R·cos ωt − (vs/ω)·sin ωt
 *            hits 0 when tan ωt = ωR/vs  →  t2 = atan(ωR/vs)/ω
 *   dense core: constant g0, R = vs·t + ½g0·t²
 *            →  t2 = (−vs + sqrt(vs² + 2g0R)) / g0
 */
export function exactSolution(
  dropHeight: number,
  launchSpeed: number,
  interior: Interior
): ExactResult {
  const r0 = R + dropHeight;
  const v0 = launchSpeed;

  const surfaceSpeed = Math.sqrt(v0 * v0 + 2 * GM * (1 / R - 1 / r0));

  let t1: number | null;
  if (dropHeight <= 0) {
    t1 = 0;
  } else {
    const invApex = 1 / r0 - (v0 * v0) / (2 * GM);
    if (invApex <= 0) {
      t1 = null;
    } else {
      const rA = v0 === 0 ? r0 : 1 / invApex;
      t1 = fallTimeFromRest(rA, R) - fallTimeFromRest(rA, r0);
    }
  }

  let t2: number;
  if (interior === "uniform") {
    const omega = Math.sqrt(G0 / R);
    // atan(∞) = π/2 handles vs = 0 (quarter period) automatically
    t2 = Math.atan((omega * R) / surfaceSpeed) / omega;
  } else {
    t2 = (-surfaceSpeed + Math.sqrt(surfaceSpeed * surfaceSpeed + 2 * G0 * R)) / G0;
  }

  const total = t1 === null ? null : t1 + t2;
  return {
    t1,
    t2,
    total,
    surfaceSpeed,
    rate: total === null ? null : POPULATION / total,
  };
}

// ---------------------------------------------------------------------------
// Helpers for charts
// ---------------------------------------------------------------------------

/**
 * Rate (Vulcans/s) for each drop height in heightsKm. Uses a coarser
 * time step (0.05 s) because it runs ~40 full simulations; the result
 * differs from dt = 0.01 s by well under 0.1 %.
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
