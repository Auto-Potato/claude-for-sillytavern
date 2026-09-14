export const MOBILE_BREAKPOINT = 700;
export function visibleShellHeight({ mobile, focused, innerHeight, viewportHeight, scale = 1 }) {
  if (!mobile || !focused || scale !== 1) return null;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return null;
  return Math.round(Math.min(innerHeight, viewportHeight));
}
