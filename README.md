# Star Trek Lab: Red-Matter Probe Through Vulcan

Dylan Duan, Grade 11 Physics

My physics project. A red-matter probe is dropped from rest 2.00 × 10⁶ m above a
hole drilled to the centre of Vulcan. How long does it take to get to the centre,
and how many Vulcans per second is that?

| | dt = 1 s | dt = 0.1 s | dt = 0.01 s |
|---|---|---|---|
| Time to surface | 671 s | 671 s | 671 s |
| Surface to centre | 688 s | 687 s | 687 s |
| Total time | 1.36 × 10³ s | 1.36 × 10³ s | **1.36 × 10³ s** |
| Rate | 5.15 × 10⁶ Vulcans/s | 5.15 × 10⁶ Vulcans/s | **5.15 × 10⁶ Vulcans/s** |

## How it works

Given: R = 6.792 × 10⁶ m, g₀ = 13.73 m/s², population = 7.00 × 10⁹.

Outside the planet g = GM/r² (GM = g₀R²). Inside, it depends on what Vulcan is
like. If it's the same density all the way through, g = g₀·r/R, so it's 0 at the
centre. If most of the mass is in a dense core, g just stays 13.73 m/s².

Because g keeps changing, I couldn't use the kinematics equations. I used Euler's
method instead. You split the fall into tiny steps (dt = 0.01 s) and pretend a is
constant during each one:

1. work out a from the probe's r right now
2. v = v + a·dt
3. r = r − v·dt (minus since toward the centre is positive)

Keep going until r = 0. Time = number of steps × dt, and rate = population ÷ time.

To check it I also ran it with dt = 1 s and 0.1 s. 0.1 s and 0.01 s give the same
answer to 3 s.f., so 0.01 s is small enough.

All the physics is in [`src/lib/physics.ts`](src/lib/physics.ts).
[`CODE_EXPLAINED.txt`](CODE_EXPLAINED.txt) goes through the rest of the code.

## What you can do on the site

- drag the numbers in the question, or click the wavy words, to change the drop
  height, launch speed, what's inside Vulcan, and air drag
- type a guess before you see the answer
- watch the probe fall in the cross-section
- hover over a graph to see where the probe was at that time
- the Method section shows the first few Euler steps for whatever you picked

For drag I used a 2000 kg sphere with C<sub>d</sub> = 0.47 and
ρ = 1.2·e^(−h/8500) kg/m³. The question doesn't say how big the sphere is, so I
guessed a 0.5 m radius (`PROBE_RADIUS`).

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run verify   # checks the answers are 1.36e3 s and 5.15e6 Vulcans/s
npm run build    # static site in ./out
```

`npm run verify` needs Node 22.18 or newer.

## Deploying

For GitHub Pages, push to `main`, then go to *Settings → Pages → Source: GitHub
Actions*. The workflow in `.github/workflows/deploy.yml` checks the answers,
builds the site and publishes it. On Vercel, just import the repo.

Made with Next.js, React, TypeScript and Recharts.
