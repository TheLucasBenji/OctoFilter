import { OptimizationResult, MetricType } from '../types';
import { METRIC_HELP, TERM_HELP, getParamHelp } from '../helpTexts';
import InfoHint from './InfoHint';

interface Props { result: OptimizationResult; metricType: MetricType; }

function delta(before: number, after: number, lowerBetter: boolean) {
  if (Math.abs(before) < 1e-10) return { label: '—', good: false };
  const pct = ((after - before) / Math.abs(before)) * 100;
  const good = lowerBetter ? pct < 0 : pct > 0;
  return { label: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, good };
}

function MetricTile({ label, value, unit, before, lowerBetter, help }: {
  label: string; value: number | null; unit?: string;
  before: number | null; lowerBetter: boolean; help: string;
}) {
  if (value === null || before === null) return null;

  const d = delta(before, value, lowerBetter);

  // For bar: normalize to [0,1] range relative to before value
  const maxVal = lowerBetter ? before : value;
  const beforePct = lowerBetter
    ? 100
    : maxVal > 0 ? Math.round((before / maxVal) * 100) : 100;
  const afterPct = lowerBetter
    ? before > 0 ? Math.round((value / before) * 100) : 100
    : 100;

  return (
    <div className="metric-tile">
      <div className="mt-label">
        <InfoHint label={label} description={help} icon={false} className="mt-help-label" />
      </div>
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
          help={METRIC_HELP.mse}
        />
        <MetricTile
          label="SNR"
          unit="dB"
          value={metrics.snr}
          before={metrics.noisy_snr}
          lowerBetter={false}
          help={METRIC_HELP.snr}
        />
        {metrics.piqe !== null && (
          <MetricTile
            label="PIQE"
            value={metrics.piqe}
            before={metrics.noisy_piqe}
            lowerBetter={true}
            help={METRIC_HELP.piqe}
          />
        )}

        {/* Best params */}
        <div className="params-tile">
          <div className="mt-label">
            <InfoHint
              label={<>Mejores parámetros · {metricType.toUpperCase()}</>}
              description={TERM_HELP.bestParams}
              icon={false}
              className="mt-help-label"
              ariaLabel={`Mejores parámetros ${metricType.toUpperCase()}: ${TERM_HELP.bestParams}`}
            />
          </div>
          {Object.entries(params).map(([k, v]) => {
            const help = getParamHelp(k);
            return (
              <div key={k} className="pt-row">
                {help ? (
                  <InfoHint label={k} description={help} icon={false} className="pt-key" />
                ) : (
                  <span className="pt-key">{k}</span>
                )}
                <span className="pt-val">{Number.isInteger(v) ? v : (v as number).toFixed(3)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
