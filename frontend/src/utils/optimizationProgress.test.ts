import { describe, expect, it } from 'vitest';
import {
  ETA_EMA_ALPHA,
  ETA_FINALIZING_BUFFER_MS,
  ETA_FINALIZING_CAP_MS,
  ETA_FINALIZING_FLOOR_MS,
  ETA_MIN_SAMPLES,
  createEtaTracker,
  formatDuration,
  hasReliableRemainingEstimate,
} from './optimizationProgress';

function progressUpdate(
  overrides: Partial<{
    elapsedMs: number;
    completedIterations: number;
    remainingIterations: number;
    totalIterations: number;
    phase: 'initializing' | 'iterating' | 'finalizing';
  }>,
) {
  return {
    elapsedMs: 1000,
    completedIterations: 1,
    remainingIterations: 49,
    totalIterations: 50,
    phase: 'iterating' as const,
    ...overrides,
  };
}

describe('formatDuration', () => {
  it('formats sub-minute durations', () => {
    expect(formatDuration(1500)).toBe('1.5s');
  });

  it('formats minute durations', () => {
    expect(formatDuration(125000)).toBe('2m 5s');
  });

  it('returns placeholder for empty values', () => {
    expect(formatDuration(null)).toBe('--');
    expect(formatDuration(0)).toBe('--');
  });
});

describe('createEtaTracker', () => {
  it('returns null during initializing phase only', () => {
    const tracker = createEtaTracker();

    expect(
      tracker.update(progressUpdate({
        elapsedMs: 10000,
        completedIterations: 0,
        remainingIterations: 49,
        phase: 'initializing',
      })),
    ).toBeNull();
    expect(tracker.sampleCount).toBe(0);
  });

  it('ignores delta on initializing to iterating transition', () => {
    const tracker = createEtaTracker();

    tracker.update(progressUpdate({
      elapsedMs: 30000,
      completedIterations: 0,
      remainingIterations: 49,
      phase: 'initializing',
    }));
    tracker.update(progressUpdate({
      elapsedMs: 31000,
      completedIterations: 1,
      remainingIterations: 48,
      phase: 'iterating',
    }));
    tracker.update(progressUpdate({
      elapsedMs: 32000,
      completedIterations: 2,
      remainingIterations: 47,
      phase: 'iterating',
    }));
    tracker.update(progressUpdate({
      elapsedMs: 33000,
      completedIterations: 3,
      remainingIterations: 46,
      phase: 'iterating',
    }));

    expect(tracker.sampleCount).toBe(2);
    expect(
      tracker.update(progressUpdate({
        elapsedMs: 34000,
        completedIterations: 4,
        remainingIterations: 45,
        phase: 'iterating',
      })),
    ).toBe(45000);
    expect(tracker.sampleCount).toBe(3);
  });

  it('estimates remaining time after enough iterating samples', () => {
    const tracker = createEtaTracker();

    tracker.update(progressUpdate({
      elapsedMs: 30000,
      completedIterations: 0,
      remainingIterations: 49,
      phase: 'initializing',
    }));
    tracker.update(progressUpdate({
      elapsedMs: 31000,
      completedIterations: 1,
      remainingIterations: 48,
      phase: 'iterating',
    }));
    tracker.update(progressUpdate({
      elapsedMs: 32000,
      completedIterations: 2,
      remainingIterations: 47,
      phase: 'iterating',
    }));
    tracker.update(progressUpdate({
      elapsedMs: 33000,
      completedIterations: 3,
      remainingIterations: 46,
      phase: 'iterating',
    }));
    const remaining = tracker.update(progressUpdate({
      elapsedMs: 34000,
      completedIterations: 4,
      remainingIterations: 45,
      phase: 'iterating',
    }));

    expect(tracker.sampleCount).toBe(3);
    expect(remaining).toBe(45000);
  });

  it('returns zero when no loop iterations remain', () => {
    const tracker = createEtaTracker();

    expect(
      tracker.update(progressUpdate({
        elapsedMs: 100000,
        completedIterations: 49,
        remainingIterations: 0,
        phase: 'iterating',
      })),
    ).toBe(0);
  });

  it('returns a conservative buffer while finalizing without samples', () => {
    const tracker = createEtaTracker();

    expect(
      tracker.update(progressUpdate({
        elapsedMs: 100000,
        completedIterations: 50,
        remainingIterations: 0,
        phase: 'finalizing',
      })),
    ).toBe(ETA_FINALIZING_BUFFER_MS);
  });

  it('derives the finalize estimate from avgIterMs when samples exist', () => {
    const tracker = createEtaTracker();

    tracker.update(progressUpdate({ elapsedMs: 1000, completedIterations: 1, remainingIterations: 48 }));
    tracker.update(progressUpdate({ elapsedMs: 3000, completedIterations: 2, remainingIterations: 47 }));
    tracker.update(progressUpdate({ elapsedMs: 5000, completedIterations: 3, remainingIterations: 46 }));
    tracker.update(progressUpdate({ elapsedMs: 7000, completedIterations: 4, remainingIterations: 45 }));

    expect(
      tracker.update(progressUpdate({
        elapsedMs: 100000,
        completedIterations: 50,
        remainingIterations: 0,
        phase: 'finalizing',
      })),
    ).toBe(2000);
  });

  it('clamps the derived finalize estimate to the cap', () => {
    const tracker = createEtaTracker();

    tracker.update(progressUpdate({ elapsedMs: 1000, completedIterations: 1, remainingIterations: 48 }));
    tracker.update(progressUpdate({ elapsedMs: 11000, completedIterations: 2, remainingIterations: 47 }));
    tracker.update(progressUpdate({ elapsedMs: 21000, completedIterations: 3, remainingIterations: 46 }));
    tracker.update(progressUpdate({ elapsedMs: 31000, completedIterations: 4, remainingIterations: 45 }));

    expect(
      tracker.update(progressUpdate({
        elapsedMs: 100000,
        completedIterations: 50,
        remainingIterations: 0,
        phase: 'finalizing',
      })),
    ).toBe(ETA_FINALIZING_CAP_MS);
  });

  it('clamps the derived finalize estimate to the floor', () => {
    const tracker = createEtaTracker();

    tracker.update(progressUpdate({ elapsedMs: 1000, completedIterations: 1, remainingIterations: 48 }));
    tracker.update(progressUpdate({ elapsedMs: 1200, completedIterations: 2, remainingIterations: 47 }));
    tracker.update(progressUpdate({ elapsedMs: 1400, completedIterations: 3, remainingIterations: 46 }));
    tracker.update(progressUpdate({ elapsedMs: 1600, completedIterations: 4, remainingIterations: 45 }));

    expect(
      tracker.update(progressUpdate({
        elapsedMs: 100000,
        completedIterations: 50,
        remainingIterations: 0,
        phase: 'finalizing',
      })),
    ).toBe(ETA_FINALIZING_FLOOR_MS);
  });

  it('smooths abrupt iteration durations with EMA', () => {
    const tracker = createEtaTracker();

    tracker.update(progressUpdate({
      elapsedMs: 1000,
      completedIterations: 1,
      remainingIterations: 48,
    }));
    tracker.update(progressUpdate({
      elapsedMs: 2000,
      completedIterations: 2,
      remainingIterations: 47,
    }));
    tracker.update(progressUpdate({
      elapsedMs: 3000,
      completedIterations: 3,
      remainingIterations: 46,
    }));
    const afterFast = tracker.update(progressUpdate({
      elapsedMs: 4000,
      completedIterations: 4,
      remainingIterations: 45,
    }));
    const afterSlow = tracker.update(progressUpdate({
      elapsedMs: 14000,
      completedIterations: 5,
      remainingIterations: 44,
    }));

    const rawSlowRemaining = Math.round(44 * 10000);
    expect(afterSlow!).toBeLessThan(rawSlowRemaining);
    expect(afterSlow!).toBeGreaterThan(afterFast!);
    expect(afterSlow).toBe(
      Math.round(44 * Math.round(ETA_EMA_ALPHA * 10000 + (1 - ETA_EMA_ALPHA) * 1000)),
    );
  });

  it('does not drift when elapsed grows without new completed iterations', () => {
    const tracker = createEtaTracker();

    tracker.update(progressUpdate({
      elapsedMs: 1000,
      completedIterations: 1,
      remainingIterations: 48,
    }));
    tracker.update(progressUpdate({
      elapsedMs: 2000,
      completedIterations: 2,
      remainingIterations: 47,
    }));
    tracker.update(progressUpdate({
      elapsedMs: 3000,
      completedIterations: 3,
      remainingIterations: 46,
    }));
    const first = tracker.update(progressUpdate({
      elapsedMs: 4000,
      completedIterations: 4,
      remainingIterations: 45,
    }));
    const second = tracker.update(progressUpdate({
      elapsedMs: 6000,
      completedIterations: 4,
      remainingIterations: 45,
    }));

    expect(first).toBe(45000);
    expect(second).toBe(first);
  });

  it('requires three samples before returning an estimate', () => {
    const tracker = createEtaTracker();

    tracker.update(progressUpdate({
      elapsedMs: 1000,
      completedIterations: 1,
      remainingIterations: 48,
    }));
    expect(
      tracker.update(progressUpdate({
        elapsedMs: 2000,
        completedIterations: 2,
        remainingIterations: 47,
      })),
    ).toBeNull();
    expect(tracker.sampleCount).toBe(1);
    expect(
      tracker.update(progressUpdate({
        elapsedMs: 3000,
        completedIterations: 3,
        remainingIterations: 46,
      })),
    ).toBeNull();
    expect(tracker.sampleCount).toBe(2);
    expect(
      tracker.update(progressUpdate({
        elapsedMs: 4000,
        completedIterations: 4,
        remainingIterations: 45,
      })),
    ).toBe(45000);
    expect(tracker.sampleCount).toBe(3);
  });

  it('resets state', () => {
    const tracker = createEtaTracker();

    tracker.update(progressUpdate({
      elapsedMs: 1000,
      completedIterations: 1,
      remainingIterations: 48,
    }));
    tracker.reset();

    expect(tracker.sampleCount).toBe(0);
    expect(
      tracker.update(progressUpdate({
        elapsedMs: 2000,
        completedIterations: 1,
        remainingIterations: 48,
      })),
    ).toBeNull();
  });
});

describe('hasReliableRemainingEstimate', () => {
  it('requires enough samples and a numeric estimate', () => {
    expect(hasReliableRemainingEstimate(ETA_MIN_SAMPLES - 1, 5000)).toBe(false);
    expect(hasReliableRemainingEstimate(ETA_MIN_SAMPLES, 5000)).toBe(true);
    expect(hasReliableRemainingEstimate(ETA_MIN_SAMPLES, null)).toBe(false);
  });
});