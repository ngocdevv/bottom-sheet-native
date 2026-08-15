import {
  applyDismissible,
  bestSnapIndex,
  fractionalIndexForHeight,
  interpolateScrimOpacity,
  isNormalizedDetentClosed,
  normalizeDetent,
  programmatic,
  resolveDetentHeights,
  validateIndex,
} from '../bottomSheetUtils';

describe('normalizeDetent', () => {
  it('accepts point, percentage, and content detents', () => {
    expect(normalizeDetent(0, 0)).toEqual({
      value: 0,
      kind: 'points',
      programmatic: false,
    });
    expect(normalizeDetent('40%', 0)).toEqual({
      value: 0.4,
      kind: 'percentage',
      programmatic: false,
    });
    expect(normalizeDetent('content', 0)).toEqual({
      value: 0,
      kind: 'content',
      programmatic: false,
    });
    expect(normalizeDetent(programmatic(300), 0)).toEqual({
      value: 300,
      kind: 'points',
      programmatic: true,
    });
  });

  it('rejects invalid values', () => {
    expect(() => normalizeDetent(-10, 0)).toThrow(/finite, non-negative/);
    expect(() => normalizeDetent(Number.NaN, 0)).toThrow(/finite, non-negative/);
    expect(() => normalizeDetent('110%' as '100%', 0)).toThrow(/percentage/);
    expect(() => normalizeDetent('-10%' as '10%', 0)).toThrow(/percentage/);
  });
});

describe('validateIndex', () => {
  it('throws for empty detents or out-of-range index', () => {
    expect(() => validateIndex(0, 0)).toThrow(/empty array/);
    expect(() => validateIndex(1.5, 2)).toThrow(/finite integer/);
    expect(() => validateIndex(2, 2)).toThrow(/from 0 through 1/);
  });

  it('accepts a valid index', () => {
    expect(() => validateIndex(1, 3)).not.toThrow();
  });
});

describe('resolveDetentHeights', () => {
  it('resolves mixed detents and caps to max height', () => {
    const detents = [0, 'content', '80%', 2000].map(normalizeDetent);
    expect(resolveDetentHeights(detents, 800, 240)).toEqual([0, 240, 640, 800]);
  });

  it('falls back when content height is unknown', () => {
    const detents = [0, 'content', '50%'].map(normalizeDetent);
    expect(resolveDetentHeights(detents, 800, null)).toEqual([0, 400, 400]);
  });
});

describe('isNormalizedDetentClosed', () => {
  it('treats zero points/percent as closed, content as open', () => {
    expect(isNormalizedDetentClosed(normalizeDetent(0, 0))).toBe(true);
    expect(isNormalizedDetentClosed(normalizeDetent('0%', 0))).toBe(true);
    expect(isNormalizedDetentClosed(normalizeDetent('content', 0))).toBe(false);
  });
});

describe('bestSnapIndex', () => {
  const heights = [0, 240, 640];

  it('picks the nearest detent when velocity is low', () => {
    expect(bestSnapIndex({ height: 100, velocity: 0, detentHeights: heights })).toBe(0);
    expect(bestSnapIndex({ height: 200, velocity: 10, detentHeights: heights })).toBe(1);
    expect(bestSnapIndex({ height: 500, velocity: 0, detentHeights: heights })).toBe(2);
  });

  it('flicks up to the next taller detent', () => {
    expect(bestSnapIndex({ height: 250, velocity: -800, detentHeights: heights })).toBe(2);
  });

  it('flicks down to the next shorter detent', () => {
    expect(bestSnapIndex({ height: 240, velocity: 800, detentHeights: heights })).toBe(0);
  });

  it('skips programmatic detents unless they are the current index', () => {
    const programmaticFlags = [false, true, false];
    expect(
      bestSnapIndex({
        height: 240,
        velocity: 0,
        detentHeights: heights,
        programmatic: programmaticFlags,
      })
    ).toBe(0);
    expect(
      bestSnapIndex({
        height: 240,
        velocity: 0,
        detentHeights: heights,
        programmatic: programmaticFlags,
        includingIndex: 1,
      })
    ).toBe(1);
  });
});

describe('scrim interpolation', () => {
  it('interpolates opacity and fractional index', () => {
    expect(interpolateScrimOpacity(0, [0, 1])).toBe(0);
    expect(interpolateScrimOpacity(1, [0, 1])).toBe(1);
    expect(interpolateScrimOpacity(0.5, [0, 1])).toBe(0.5);
    expect(fractionalIndexForHeight(120, [0, 240, 640])).toBe(0.5);
    expect(fractionalIndexForHeight(0, [0, 240])).toBe(0);
    expect(fractionalIndexForHeight(640, [0, 240, 640])).toBe(2);
  });
});

describe('keyboard extend + dismissible', () => {
  it('grows only the content detent by the keyboard inset', () => {
    const detents = [0, 'content', '80%'].map(normalizeDetent);
    expect(resolveDetentHeights(detents, 800, 240, 0)).toEqual([0, 240, 640]);
    expect(resolveDetentHeights(detents, 800, 240, 200)).toEqual([0, 440, 640]);
    expect(resolveDetentHeights(detents, 800, 240, 700)).toEqual([0, 800, 640]);
  });

  it('marks a closed detent programmatic when the sheet is not dismissible', () => {
    const detents = [0, '22%', '70%'].map(normalizeDetent);
    expect(applyDismissible(detents, true)[0]?.programmatic).toBe(false);
    const locked = applyDismissible(detents, false);
    expect(locked[0]?.programmatic).toBe(true);
    expect(locked[1]?.programmatic).toBe(false);
    expect(locked[2]?.programmatic).toBe(false);
  });
});
