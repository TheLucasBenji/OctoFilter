import { ConvergencePoint, MetricType, OptimizationResult } from '../types';
import ConvergenceChart from './ConvergenceChart';
import MetricsPanel from './MetricsPanel';

interface Props {
  convergence: ConvergencePoint[];
  result: OptimizationResult | null;
  metricType: MetricType;
  totalIterations: number;
}

export default function AnalysisSection({ convergence, result, metricType, totalIterations }: Props) {
  return (
    <div className="analysis">
      <div className="chart-section">
        <div className="section-header">
          <span className="section-title">Convergencia — {metricType.toUpperCase()}</span>
          <span className="section-meta">{convergence.length} / {totalIterations} iter</span>
        </div>
        {convergence.length > 0 ? (
          <ConvergenceChart data={convergence} metricType={metricType} totalIterations={totalIterations} />
        ) : (
          <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
            esperando...
          </div>
        )}
      </div>

      {result && <MetricsPanel result={result} metricType={metricType} />}
    </div>
  );
}
