import type { OptimizationPhase } from '../types';

export const ETA_MIN_SAMPLES = 3;
export const ETA_EMA_ALPHA = 0.35;
export const ETA_FINALIZING_BUFFER_MS = 1500;
export const ETA_FINALIZING_FLOOR_MS = 800;
export const ETA_FINALIZING_CAP_MS = 6000;
export const ETA_COUNTDOWN_FLOOR_MS = 1000;

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return '--';

  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;

  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
}

export interface EtaTracker {
  reset(): void;
  update(input: {
    elapsedMs: number;
    completedIterations: number;
    remainingIterations: number;
    totalIterations: number;
    phase: OptimizationPhase | null;
  }): number | null;
  readonly sampleCount: number;
}

function smoothIterationDuration(previous: number | null, delta: number): number {
  if (previous == null || !Number.isFinite(previous)) {
    return delta;
  }
  return Math.round(ETA_EMA_ALPHA * delta + (1 - ETA_EMA_ALPHA) * previous);
}

// El trabajo de finalizacion (un apply del filtro + metricas + encode + DB) no escala con un
// numero fijo: lo aproximamos a partir del coste medio por iteracion ya observado, acotado entre
// un piso y un techo. Sin muestras, caemos al buffer conservador constante.
function estimateFinalizingMs(avgIterMs: number | null): number {
  if (avgIterMs == null || !Number.isFinite(avgIterMs)) {
    return ETA_FINALIZING_BUFFER_MS;
  }
  return Math.min(ETA_FINALIZING_CAP_MS, Math.max(ETA_FINALIZING_FLOOR_MS, avgIterMs));
}

export function createEtaTracker(): EtaTracker {
  let lastElapsedMs = 0;
  let lastCompleted = 0;
  let lastPhase: OptimizationPhase | null = null;
  let avgIterMs: number | null = null;
  let sampleCount = 0;

  return {
    get sampleCount() {
      return sampleCount;
    },

    reset() {
      lastElapsedMs = 0;
      lastCompleted = 0;
      lastPhase = null;
      avgIterMs = null;
      sampleCount = 0;
    },

    update({
      elapsedMs,
      completedIterations,
      remainingIterations,
      totalIterations,
      phase,
    }) {
      if (
        elapsedMs <= 0
        || !Number.isFinite(elapsedMs)
        || !Number.isFinite(completedIterations)
        || !Number.isFinite(remainingIterations)
        || !Number.isFinite(totalIterations)
        || totalIterations <= 0
      ) {
        return null;
      }

      if (phase === 'finalizing' && completedIterations >= totalIterations) {
        lastElapsedMs = elapsedMs;
        lastCompleted = completedIterations;
        lastPhase = phase;
        return estimateFinalizingMs(avgIterMs);
      }

      if (remainingIterations <= 0 && phase !== 'initializing') {
        lastElapsedMs = elapsedMs;
        lastCompleted = completedIterations;
        lastPhase = phase;
        return 0;
      }

      if (
        completedIterations > lastCompleted
        && lastPhase !== 'initializing'
        && lastElapsedMs > 0
      ) {
        const delta = elapsedMs - lastElapsedMs;
        if (delta > 0) {
          avgIterMs = smoothIterationDuration(avgIterMs, delta);
          sampleCount += 1;
        }
      }

      lastElapsedMs = elapsedMs;
      lastCompleted = completedIterations;
      lastPhase = phase;

      if (sampleCount < ETA_MIN_SAMPLES || avgIterMs == null) {
        return null;
      }

      return Math.max(0, Math.round(remainingIterations * avgIterMs));
    },
  };
}

export function hasReliableRemainingEstimate(
  sampleCount: number,
  remainingMs: number | null,
): boolean {
  return sampleCount >= ETA_MIN_SAMPLES && remainingMs != null;
}