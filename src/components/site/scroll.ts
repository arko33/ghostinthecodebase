export interface ScrollSignals {
  /** whole document progress, 0..1 */
  page: number;
  /** pinned loop section progress, 0..1 */
  loop: number;
  /** signed scroll velocity, roughly px per frame */
  velocity: number;
  /** damped pointer offset, -1..1 */
  mouseX: number;
  mouseY: number;
}

export function createScrollSignals(): ScrollSignals {
  return { page: 0, loop: 0, velocity: 0, mouseX: 0, mouseY: 0 };
}
