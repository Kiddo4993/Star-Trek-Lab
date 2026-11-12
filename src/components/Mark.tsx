/**
 * The site's mark: the velocity-vs-time graph on engineering paper.
 * Same drawing as the favicon (src/app/icon.svg). If you change one,
 * change the other.
 */
export default function Mark({ size = 36 }: { size?: number }) {
  return (
    <svg className="mark-logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="31" rx="7" fill="#EEF3E4" stroke="#AFC69C" />
      <path d="M1 11h30M1 18h30M14 1v30M21 1v30" stroke="#D3E1C6" strokeWidth="1" />
      <path d="M7 4.5V25h20.5" fill="none" stroke="#55585F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 24.2C13 23.5 16.6 19.5 19.2 14.6 21.2 10.8 23 8.6 25.4 7.8" fill="none" stroke="#1F3A8F" strokeWidth="3" strokeLinecap="round" />
      <circle cx="25.4" cy="7.8" r="3.4" fill="#C3302A" />
    </svg>
  );
}
