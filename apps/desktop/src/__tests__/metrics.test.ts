import { percentile, summarize } from '@entangle/protocol';

describe('percentile', () => {
  it('returns 0 for an empty sample set', () => {
    expect(percentile([], 0.5)).toBe(0);
  });

  it('returns the only sample whatever the rank', () => {
    expect(percentile([7], 0.5)).toBe(7);
    expect(percentile([7], 0.95)).toBe(7);
  });

  it('takes the nearest rank, not an interpolation', () => {
    const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(samples, 0.5)).toBe(5);
    expect(percentile(samples, 0.95)).toBe(10);
    expect(percentile(samples, 0.1)).toBe(1);
  });

  it('does not care about input order', () => {
    expect(percentile([9, 1, 5, 3, 7], 0.5)).toBe(5);
  });

  it('leaves the caller\'s array alone', () => {
    const samples = [3, 1, 2];
    percentile(samples, 0.5);
    expect(samples).toEqual([3, 1, 2]);
  });

  it('clamps a rank outside 0…1', () => {
    expect(percentile([1, 2, 3], 2)).toBe(3);
    expect(percentile([1, 2, 3], -1)).toBe(1);
  });
});

describe('summarize', () => {
  it('reports both ranks and the sample count', () => {
    expect(summarize([10, 20, 30, 40])).toEqual({ p50: 20, p95: 40, count: 4 });
  });

  it('reports zeros for no samples', () => {
    expect(summarize([])).toEqual({ p50: 0, p95: 0, count: 0 });
  });
});
