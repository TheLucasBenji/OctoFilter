import { OptimizationResult, MetricType } from '../types';

interface Props { result: OptimizationResult; metricType: MetricType; }

function delta(before: number, after: number, lowerBetter: boolean) {
  const pct = ((after - before) / Math.abs(before)) * 100;
  const good = lowerBetter ? pct < 0 : pct > 0;
  return { label: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, good };
}

function MetricTile({ label, value, unit, before, lowerBetter }: {
  label: string; value: number | null; unit?: string;
  before: number | null; lowerBetter: boolean;
}) {
  if (value === null || before === null) return null;

  const d = delta(before, value, lowerBetter);

  // For bar: normalize to [0,1] range relative to before value
  const maxVal = lowerBetter ? before : value;
  const beforePct = lowerBetter
    ? 100
    : Math.round((before / maxVal) * 100);
  const afterPct = lowerBetter
    ? Math.round((value / before) * 100)
    : 100;

  return (
    <div className="metric-tile">
      <div className="mt-label">{label}</div>
      <div className="mt-value">
        {value.toFixed(2)}
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div className={`mt-bar-wrap ${d.good ? 'mt-bar-good' : 'mt-bar-bad'}`}>
        <div className="mt-bar-bg">
          <div className="mt-bar-before" style={{ width: `${Math.min(beforePct, 100)}%` }} />
          <div className="mt-bar-after"  style={{ width: `${Math.min(afterPct, 100)}%` }} />
        </div>
        <span className={`mt-delta ${d.good ? 'good' : 'bad'}`}>{d.label}</span>
      </div>
      <div className="mt-before">antes {before.toFixed(2)}{unit ? ` ${unit}` : ''}</div>
    </div>
  );
}

export default function MetricsPanel({ result, metricType }: Props) {
  const { metrics, params } = result;

  return (
    <>
      <div className="metrics-row">
        <MetricTile
          label="MSE"
          value={metrics.mse}
          before={metrics.noisy_mse}
          lowerBetter={true}
        />
        <MetricTile
          label="SNR"
          unit="dB"
          value={metrics.snr}
          before={metrics.noisy_snr}
          lowerBetter={false}
        />
        {metrics.piqe !== null && (
          <MetricTile
            label="PIQE"
            value={metrics.piqe}
            before={metrics.noisy_piqe}
            lowerBetter={true}
          />
        )}

        {/* Best params */}
        <div className="params-tile">
          <div className="mt-label">Mejores parámetros · {metricType.toUpperCase()}</div>
          {Object.entries(params).map(([k, v]) => (
            <div key={k} className="pt-row">
              <span className="pt-key">{k}</span>
              <span className="pt-val">{Number.isInteger(v) ? v : (v as number).toFixed(3)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
