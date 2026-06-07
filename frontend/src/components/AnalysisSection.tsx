import { ConvergencePoint, FilterType, MetricType, OptimizationResult } from '../types';
import { METRIC_HELP, TERM_HELP } from '../helpTexts';
import ConvergenceChart from './ConvergenceChart';
import InfoHint from './InfoHint';
import MetricsPanel from './MetricsPanel';
import { formatDuration } from '../utils/optimizationProgress';

interface Props {
  convergence: ConvergencePoint[];
  result: OptimizationResult | null;
  filterType: FilterType;
  metricType: MetricType;
  totalIterations: number;
}

export default function AnalysisSection({ convergence, result, filterType, metricType, totalIterations }: Props) {
  const durationLabel = result?.elapsed_ms != null ? formatDuration(result.elapsed_ms) : null;

  return (
    <div className="analysis">
      <div className="chart-section">
        <div className="section-header">
          <span className="section-title">
            <InfoHint
              label={<>Convergencia — {metricType.toUpperCase()}</>}
              description={`${TERM_HELP.convergence} ${METRIC_HELP[metricType]}`}
              icon={false}
              className="section-title-help"
              ariaLabel={`Convergencia ${metricType.toUpperCase()}: ${TERM_HELP.convergence} ${METRIC_HELP[metricType]}`}
            />
          </span>
          <span className="section-meta">
            <span>{convergence.length} / {totalIterations} iter</span>
            {durationLabel && <span className="section-meta-chip">Tiempo total {durationLabel}</span>}
          </span>
        </div>
        {convergence.length > 0 ? (
          <ConvergenceChart data={convergence} metricType={metricType} totalIterations={totalIterations} />
        ) : (
          <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
            esperando...
          </div>
        )}
      </div>

      {result && <MetricsPanel result={result} filterType={filterType} metricType={metricType} />}
    </div>
  );
}
