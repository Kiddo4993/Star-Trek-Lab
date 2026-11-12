# Star Trek Lab: Red-Matter Probe Through Vulcan

**Dylan Duan, Grade 11 Physics**

An interactive physics simulation for a school project. A red-matter probe is
dropped from rest 2.00 × 10⁶ m above a hole drilled to the centre of Vulcan.
How long does it take to reach the centre, and how many Vulcans per second does
that work out to?

| | Euler (dt = 0.01 s) | Exact |
|---|---|---|
| Time to surface, t₁ | 671 s | 671 s |
| Surface → centre, t₂ | 687 s | 687 s |
| **Total time** | **1.36 × 10³ s** | **1.36 × 10³ s** |
| **Rate** | **5.15 × 10⁶ Vulcans/s** | **5.15 × 10⁶ Vulcans/s** |

## The physics

Given: R = 6.792 × 10⁶ m, g₀ = 13.73 m/s², population = 7.00 × 10⁹.

- **Outside:** g = GM/r², with GM = g₀R²
- **Inside, uniform density:** g = g₀·r/R (shell theorem)
- **Inside, dense core:** g = g₀ = 13.73 m/s²
- **Euler's method:** a from position, `v += a·dt`, `r -= v·dt`, repeat until r = 0
  (v is measured toward the centre, so r decreases)
- **Exact check:**
  - t₁ = √(r₀³/2GM)·[√(x(1−x)) + cos⁻¹√x], x = R/r₀
  - t₂ = tan⁻¹(ωR/vₛ)/ω, ω = √(g₀/R), vₛ = √(2GM(1/R − 1/r₀))
- **Rate** = population ÷ total time

All the physics is in [`src/lib/physics.ts`](src/lib/physics.ts), with comments.

## Features

- A reactive Aim sentence: drag the numbers, click the words to switch model / drag
- "Guess first": type a prediction and it's marked in red pen
- Linked views: hover any time graph to see where the probe was at that
  moment; click to send it there; graphs trace themselves as it falls
- A pencil ghost of your previous settings on the velocity graph
- Keyboard: Space drops / pauses, ← → step through the fall, R resets
- Animated cross-section with play/pause, reset, speed and a time scrubber
- Sliders for drop height (0–10 000 km) and launch speed (0–10 000 m/s)
- Interior model dropdown: uniform vs dense core
- Air drag on/off: 2000 kg sphere, Cd = 0.47, ρ = 1.2·e^(−h/8500) kg/m³
  (the sphere's radius isn't given, so 0.5 m is assumed: `PROBE_RADIUS`)
- Graphs: velocity, acceleration and displacement vs time (surface crossing
  marked), g vs r, rate vs drop height, and velocity comparisons across assumptions
- Euler vs exact results table, all values to 3 significant figures

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run verify   # checks Euler + exact answers = 1.36e3 s and 5.15e6 Vulcans/s
npm run build    # static site in ./out
```

`npm run verify` needs Node 22.18 or newer (it runs the TypeScript physics file directly).

## Deploy

**GitHub Pages:** push to `main`, then in the repo go to *Settings → Pages →
Source: GitHub Actions*. The workflow in `.github/workflows/deploy.yml`
verifies the physics, builds, and publishes `out/`.

**Vercel:** import the repo. No settings needed (the base path is only set on GitHub Pages).

## Built with

Next.js (App Router, static export), React, TypeScript, Recharts.
