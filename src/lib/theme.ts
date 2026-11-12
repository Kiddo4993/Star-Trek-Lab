/**
 * Colours for SVG/Recharts, which can't read CSS variables in attributes.
 * They mirror the tokens in globals.css: a student's pens on white
 * printouts taped into an engineering-paper notebook.
 */
export const PALETTE = {
  print: "#2B2B2B", // printer black (axis text on taped-in printouts)
  pencil: "#55585F", // graphite: muted text, hatching
  grid: "#E2E2DE", // faint printout gridlines
  sheet: "#FFFFFF", // printout paper
  red: "#C3302A", // red pen: probe and surface line only
  uniform: "#1F3A8F", // blue ballpoint
  dense: "#1F7A4A", // green pen
};

export type Palette = typeof PALETTE;
