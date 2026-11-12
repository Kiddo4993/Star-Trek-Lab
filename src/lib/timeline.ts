/**
 * A tiny shared store for "where are we in the fall?".
 *
 *   time   the animation / scrubber position (s)
 *   hover  the time under the pointer on any time graph (s), or null
 *   end    total fall time of the current run (s)
 *
 * It lives outside React on purpose: it changes ~60 times a second while
 * the probe falls, and only the cross-section and the chart overlays need
 * to hear about it. Keeping it out of React state means the whole page
 * (eight graphs) doesn't re-render every frame.
 */
type Listener = () => void;

interface TimelineState {
  time: number;
  hover: number | null;
  end: number;
}

let state: TimelineState = { time: 0, hover: null, end: 0 };
const listeners = new Set<Listener>();

export const timeline = {
  get: () => state,
  set(patch: Partial<TimelineState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
