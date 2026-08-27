/**
 * Detent + snap helpers aligned with @swmansion/react-native-bottom-sheet.
 */

export type DetentValue = number | `${number}%` | 'content';

export type Detent = DetentValue | { value: DetentValue; programmatic?: boolean };

export type NormalizedDetent = Readonly<{
  value: number;
  kind: 'points' | 'percentage' | 'content';
  programmatic: boolean;
}>;

/** Marks a detent as reachable only via controlled `index` updates, not dragging. */
export const programmatic = (value: DetentValue): Detent => ({
  value,
  programmatic: true,
});

export const detentValue = (detent: Detent): DetentValue => {
  if (typeof detent === 'object' && detent !== null) return detent.value;
  return detent;
};

export const isDetentProgrammatic = (detent: Detent): boolean => {
  if (typeof detent === 'object' && detent !== null) {
    return detent.programmatic === true;
  }
  return false;
};

const PERCENTAGE_PATTERN = /^\d+(?:\.\d+)?%$/;

const invalidPercentageError = (value: string, index: number) =>
  new Error(
    `Invalid bottom sheet detent at index ${index}: \`${value}\` is not a valid percentage. Expected an unsigned integer or decimal from 0% through 100%, without whitespace.`
  );

const invalidPointDetentError = (value: number, index: number) =>
  new Error(
    `Invalid bottom sheet detent at index ${index}: received ${String(value)}. Expected a finite, non-negative number.`
  );

const parseDetentPercentage = (value: string, index: number) => {
  if (!PERCENTAGE_PATTERN.test(value)) {
    throw invalidPercentageError(value, index);
  }

  const percentage = Number(value.slice(0, -1));
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw invalidPercentageError(value, index);
  }

  return percentage / 100;
};

/** Serializes a public detent into the shape consumed by the native views. */
export const normalizeDetent = (detent: Detent, index: number): NormalizedDetent => {
  const value = detentValue(detent);
  const isProgrammatic = isDetentProgrammatic(detent);

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw invalidPointDetentError(value, index);
    }

    return {
      value,
      kind: 'points',
      programmatic: isProgrammatic,
    };
  }

  if (value === 'content') {
    return {
      value: 0,
      kind: 'content',
      programmatic: isProgrammatic,
    };
  }

  return {
    value: parseDetentPercentage(value, index),
    kind: 'percentage',
    programmatic: isProgrammatic,
  };
};

export const isNormalizedDetentClosed = (detent: NormalizedDetent) =>
  detent.kind !== 'content' && detent.value === 0;

export const validateIndex = (index: number, detentCount: number) => {
  if (detentCount === 0) {
    throw new Error(
      'Invalid bottom sheet detents: received an empty array. Expected at least one detent.'
    );
  }

  if (!Number.isFinite(index) || !Number.isInteger(index)) {
    throw new Error(
      `Invalid bottom sheet index: received ${String(index)}. Expected a finite integer from 0 through ${detentCount - 1}.`
    );
  }

  if (index < 0 || index >= detentCount) {
    throw new Error(
      `Invalid bottom sheet index: received ${String(index)}. Expected a value from 0 through ${detentCount - 1}.`
    );
  }
};

/** Native iOS/Android flick threshold, in points (or dp) per second. */
export const SNAP_FLICK_THRESHOLD = 600;

/**
 * Resolve a detent to a height in points, capped by `maxHeight`.
 * Unresolved `'content'` falls through to the next concrete detent, then `maxHeight`.
 */
export const resolveDetentHeight = (
  detent: NormalizedDetent,
  index: number,
  all: readonly NormalizedDetent[],
  maxHeight: number,
  contentHeight: number | null,
  keyboardExtend = 0
): number => {
  let height: number;
  switch (detent.kind) {
    case 'points':
      height = detent.value;
      break;
    case 'percentage':
      height = maxHeight * detent.value;
      break;
    case 'content': {
      if (contentHeight != null && Number.isFinite(contentHeight)) {
        height = Math.min(contentHeight + Math.max(0, keyboardExtend), maxHeight);
      } else {
        height = unresolvedContentFallback(index, all, maxHeight);
      }
      break;
    }
  }
  return Math.min(Math.max(0, height), maxHeight);
};

const unresolvedContentFallback = (
  index: number,
  all: readonly NormalizedDetent[],
  maxHeight: number
): number => {
  for (let i = index + 1; i < all.length; i += 1) {
    const next = all[i];
    if (next.kind === 'points') return Math.min(Math.max(0, next.value), maxHeight);
    if (next.kind === 'percentage') {
      return Math.min(Math.max(0, maxHeight * next.value), maxHeight);
    }
  }
  return maxHeight;
};

export const resolveDetentHeights = (
  detents: readonly NormalizedDetent[],
  maxHeight: number,
  contentHeight: number | null,
  keyboardExtend = 0
): number[] =>
  detents.map((detent, index) =>
    resolveDetentHeight(detent, index, detents, maxHeight, contentHeight, keyboardExtend)
  );

export type KeyboardBehavior = 'none' | 'extend' | 'stick';

export const KEYBOARD_BEHAVIOR_LEVEL: Record<KeyboardBehavior, number> = {
  none: 0,
  extend: 1,
  stick: 2,
};

/** Scan-style sheets never close: treat a zero detent as programmatic-only. */
export const applyDismissible = (
  detents: readonly NormalizedDetent[],
  dismissible: boolean
): NormalizedDetent[] => {
  if (dismissible) return detents.map((detent) => ({ ...detent }));
  return detents.map((detent) =>
    isNormalizedDetentClosed(detent) ? { ...detent, programmatic: true } : { ...detent }
  );
};

/**
 * Snap target used by the native engines.
 * Positive velocity = dragging down (collapse). Negative = dragging up (expand).
 */
export const bestSnapIndex = ({
  height,
  velocity,
  detentHeights,
  programmatic,
  includingIndex,
  flickThreshold = SNAP_FLICK_THRESHOLD,
}: {
  height: number;
  velocity: number;
  detentHeights: readonly number[];
  programmatic?: readonly boolean[];
  includingIndex?: number | null;
  flickThreshold?: number;
}): number => {
  const candidates: number[] = [];
  for (let i = 0; i < detentHeights.length; i += 1) {
    const isProgrammatic = programmatic?.[i] === true;
    if (!isProgrammatic || i === includingIndex) {
      candidates.push(i);
    }
  }
  if (candidates.length === 0) return 0;

  if (velocity < -flickThreshold) {
    return (
      candidates.find((index) => detentHeights[index] > height) ?? candidates[candidates.length - 1]
    );
  }
  if (velocity > flickThreshold) {
    const lower = [...candidates].reverse().find((index) => detentHeights[index] < height);
    return lower ?? candidates[0];
  }

  let closest = candidates[0];
  let closestDistance = Math.abs(detentHeights[closest] - height);
  for (const index of candidates) {
    const distance = Math.abs(detentHeights[index] - height);
    if (distance < closestDistance) {
      closest = index;
      closestDistance = distance;
    }
  }
  return closest;
};

/** Linear interpolation of scrim opacity between surrounding detents. */
export const interpolateScrimOpacity = (
  fractionalIndex: number,
  opacities: readonly number[]
): number => {
  if (opacities.length === 0) return 1;
  if (opacities.length === 1) return clamp01(opacities[0]);
  const maxIndex = opacities.length - 1;
  const clamped = Math.min(Math.max(fractionalIndex, 0), maxIndex);
  const lower = Math.floor(clamped);
  const upper = Math.min(lower + 1, maxIndex);
  const t = clamped - lower;
  return clamp01(opacities[lower] * (1 - t) + opacities[upper] * t);
};

/** Fractional detent index from a live height. */
export const fractionalIndexForHeight = (
  height: number,
  detentHeights: readonly number[]
): number => {
  if (detentHeights.length === 0) return 0;
  if (detentHeights.length === 1) return 0;
  if (height <= detentHeights[0]) return 0;
  const last = detentHeights.length - 1;
  if (height >= detentHeights[last]) return last;
  for (let i = 0; i < last; i += 1) {
    const a = detentHeights[i];
    const b = detentHeights[i + 1];
    if (height >= a && height <= b) {
      const span = b - a;
      return i + (span === 0 ? 0 : (height - a) / span);
    }
  }
  return last;
};

/**
 * Native sheets can read their mounted child's frame directly when the caller
 * already owns the height animation. Keeping `onLayout` attached in that mode
 * would send one event and one React state update per animation frame.
 *
 * Web has no native host to measure from, so it always keeps the JS fallback.
 */
export const shouldMeasureContentHeightInJS = (
  platform: string,
  animateContentHeight: boolean
): boolean => platform === 'web' || animateContentHeight;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
