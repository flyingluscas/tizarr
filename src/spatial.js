// Spatial navigation math: which element is "next" when pressing an arrow key.
// Pure functions on rects ({ left, top, right, bottom }) so they can be tested without a DOM.

// Moving sideways costs more than moving straight, so focus prefers aligned elements.
const SIDE_WEIGHT = 2;
// Small pull toward the closest center, only to break ties between equal edge distances.
const CENTER_TIEBREAK = 0.01;

const center = (rect) => ({ x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 });

/** Gap between two ranges on one axis; 0 when they overlap. */
const gap = (startA, endA, startB, endB) => Math.max(0, startB - endA, startA - endB);

/**
 * Cost of moving focus from one rect to another in a direction ('left' | 'right' | 'up' |
 * 'down'), or null when the target is not in that direction. Distances are measured between
 * edges, so a wide element (a text field) directly below counts as close even if its center
 * is far away.
 */
export function moveScore(direction, from, to) {
  const a = center(from);
  const b = center(to);
  const horizontal = direction === 'left' || direction === 'right';
  const ahead = { left: a.x - b.x, right: b.x - a.x, up: a.y - b.y, down: b.y - a.y }[direction];
  if (ahead <= 1) return null;

  const straight = horizontal
    ? gap(from.left, from.right, to.left, to.right)
    : gap(from.top, from.bottom, to.top, to.bottom);
  const side = horizontal
    ? gap(from.top, from.bottom, to.top, to.bottom)
    : gap(from.left, from.right, to.left, to.right);
  const offCenter = horizontal ? Math.abs(b.y - a.y) : Math.abs(b.x - a.x);
  return straight + SIDE_WEIGHT * side + CENTER_TIEBREAK * offCenter;
}

/** Index of the best target in `rects` from `from`, or -1 when nothing is in that direction. */
export function pickNext(direction, from, rects) {
  let best = -1;
  let bestScore = Infinity;
  rects.forEach((rect, index) => {
    const score = moveScore(direction, from, rect);
    if (score !== null && score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}
