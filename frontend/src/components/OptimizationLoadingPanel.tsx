import { FaRegCircleStop } from 'react-icons/fa6';
import { AlgorithmType, AppState, OptimizationPhase } from '../types';
import { formatDuration, hasReliableRemainingEstimate } from '../utils/optimizationProgress';

interface Props {
  appState: AppState;
  algorithm: AlgorithmType;
  phase: OptimizationPhase | null;
  progressFraction: number;
  remainingMs: number | null;
  elapsedMs: number;
  completedIterations: number;
  totalIterations: number;
  etaSampleCount: number;
  onCancel: () => void;
}

function statusLabel(
  phase: OptimizationPhase | null,
  etaSampleCount: number,
  remainingMs: number | null,
): string {
  if (phase === 'finalizing') return 'Finalizando';
  if (phase === 'initializing') return 'Iniciando población';
  if (hasReliableRemainingEstimate(etaSampleCount, remainingMs)) return 'Optimizando';
  if (phase === 'iterating' || etaSampleCount > 0) return 'Calculando tiempo restante';
  return 'Iniciando';
}

export default function OptimizationLoadingPanel({
  appState,
  algorithm,
  phase,
  progressFraction,
  remainingMs,
  elapsedMs,
  completedIterations,
  totalIterations,
  etaSampleCount,
  onCancel,
}: Props) {
  const optimizing = appState === 'optimizing';
  // La barra (pct) usa progressFraction, una estimacion ponderada por fase del backend;
  // el contador "X / Y" usa completedIterations/totalIterations (cifras exactas). Ambas senales
  // son independientes y pueden no coincidir. Ademas, en OOA el bucle solo corre totalIterations-1
  // veces, por lo que el contador no alcanza el total hasta el evento de finalizacion (en SFOA si).
  const hasProgress = progressFraction > 0;
  const showIndeterminate = !hasProgress;
  const pct = optimizing ? Math.min(100, Math.round(progressFraction * 100)) : 0;
  const progressLabel = hasProgress ? `${pct}% aprox.` : 'iniciando';
  const reliableRemaining = hasReliableRemainingEstimate(etaSampleCount, remainingMs);
  const heading = phase === 'finalizing'
    ? 'Finalizando optimización'
    : hasProgress ? 'Optimizando filtro'
    : 'Preparando optimización';

  return (
    <section className={`loading-panel ${hasProgress ? 'is-optimizing' : 'is-preparing'}`}>
      <div className="loading-panel-head">
        <div>
          <span className="loading-kicker">{algorithm.toUpperCase()}</span>
          <h2>{heading}</h2>
        </div>
        <button
          type="button"
          className="loading-cancel-btn"
          onClick={onCancel}
          aria-label="Cancelar optimización"
          title="Cancelar optimización">
          <FaRegCircleStop aria-hidden="true" />
        </button>
      </div>

      <div className="loading-progress-row">
        <div className="loading-progress-track">
          <div
            className={`loading-progress-fill${showIndeterminate ? ' indeterminate' : ''}`}
            style={showIndeterminate ? undefined : { width: `${pct}%` }}
          />
        </div>
        <span className="loading-progress-value">{progressLabel}</span>
      </div>

      <div className="loading-stats">
        <div className="loading-stat">
          <span>Estado</span>
          <strong>{statusLabel(phase, etaSampleCount, remainingMs)}</strong>
        </div>
        <div className="loading-stat">
          <span>Restante aprox.</span>
          <strong>{reliableRemaining ? formatDuration(remainingMs) : '--'}</strong>
        </div>
        <div className="loading-stat">
          <span>Transcurrido</span>
          <strong>{formatDuration(elapsedMs > 0 ? elapsedMs : null)}</strong>
        </div>
        <div className="loading-stat">
          <span>Iteración</span>
          <strong>
            {optimizing ?
              phase === 'initializing' ? 'Inicializando'
              : `${completedIterations} / ${totalIterations}`
            : '--'}
          </strong>
        </div>
      </div>
    </section>
  );
}
