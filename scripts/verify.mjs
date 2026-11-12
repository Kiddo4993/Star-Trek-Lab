// Checks the Euler simulation against the exact formulas and the expected
// answers (1.36e3 s, 5.15e6 Vulcans/s). Run with: npm run verify
// Requires Node ≥ 22.18 (runs the .ts file directly via type stripping).
import { simulate, exactSolution, DEFAULT_DROP_HEIGHT } from "../src/lib/physics.ts";

const sim = simulate({ dropHeight: DEFAULT_DROP_HEIGHT, launchSpeed: 0, interior: "uniform", drag: false, recordEvery: 0 });
const ex = exactSolution(DEFAULT_DROP_HEIGHT, 0, "uniform");
const s3 = (x) => Number(x).toPrecision(3);

console.log(`Euler: t_surface = ${s3(sim.surfaceTime)} s, t_total = ${s3(sim.totalTime)} s, rate = ${s3(sim.rate)} Vulcans/s`);
console.log(`Exact: t1 = ${s3(ex.t1)} s, t2 = ${s3(ex.t2)} s, total = ${s3(ex.total)} s, rate = ${s3(ex.rate)} Vulcans/s`);

let ok = true;
const check = (label, got, want) => {
  const pass = s3(got) === want;
  ok &&= pass;
  console.log(`${pass ? "PASS" : "FAIL"} ${label}: ${s3(got)} (expected ${want})`);
};
check("Euler total time", sim.totalTime, "1.36e+3");
check("Euler rate", sim.rate, "5.15e+6");
check("Exact total time", ex.total, "1.36e+3");
check("Exact rate", ex.rate, "5.15e+6");
process.exit(ok ? 0 : 1);
