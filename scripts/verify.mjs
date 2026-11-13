// Checks that the Euler simulation gives the expected answers
// (1.36e3 s and 5.15e6 Vulcans/s), and that a 10x bigger step gives the
// same answer to 3 s.f. Run with: npm run verify
// Needs Node 22.18 or newer (it runs the .ts file directly).
import { simulate, DEFAULT_DROP_HEIGHT } from "../src/lib/physics.ts";

const opts = { dropHeight: DEFAULT_DROP_HEIGHT, launchSpeed: 0, interior: "uniform", drag: false, recordEvery: 0 };
const fine = simulate(opts); // dt = 0.01 s
const coarse = simulate({ ...opts, dt: 0.1 });
const s3 = (x) => Number(x).toPrecision(3);

console.log(`dt = 0.01 s: t_surface = ${s3(fine.surfaceTime)} s, t_total = ${s3(fine.totalTime)} s, rate = ${s3(fine.rate)} Vulcans/s`);
console.log(`dt = 0.1 s:  t_surface = ${s3(coarse.surfaceTime)} s, t_total = ${s3(coarse.totalTime)} s, rate = ${s3(coarse.rate)} Vulcans/s`);

let ok = true;
const check = (label, got, want) => {
  const pass = s3(got) === want;
  ok &&= pass;
  console.log(`${pass ? "PASS" : "FAIL"} ${label}: ${s3(got)} (expected ${want})`);
};
check("total time", fine.totalTime, "1.36e+3");
check("rate", fine.rate, "5.15e+6");
check("total time with dt = 0.1 s", coarse.totalTime, "1.36e+3");
process.exit(ok ? 0 : 1);
