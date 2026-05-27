import type { MetricType } from '../types';

type MetricOption = { value: MetricType; label: string; hint: string };

interface Props {
  value: MetricType;
  onChange: (m: MetricType) => void;
  disabled?: boolean;
  metrics?: MetricOption[];
  variant?: 'basic' | 'stacked';
}

const DEFAULT_METRICS: MetricOption[] = [
  { value: 'mse', label: 'MSE', hint: 'minimizar error' },
  { value: 'snr', label: 'SNR', hint: 'maximizar señal' },
  { value: 'piqe', label: 'PIQE', hint: 'perceptual sin referencia' },
];

export default function MetricSelector({
  value,
  onChange,
  disabled = false,
  metrics = DEFAULT_METRICS,
  variant = 'basic',
}: Props) {
  const cls = `metric-btns ${variant === 'basic' ? 'basic' : 'stacked'}`;
  return (
    <div className={cls}>
      {metrics.map((m) => (
        <button
          key={m.value}
          type="button"
          className={`metric-btn${value === m.value ? ' active' : ''}`}
          onClick={() => onChange(m.value)}
          disabled={disabled}
          title={m.hint}
          aria-label={`${m.label}. ${m.hint}`}>
          <span>{m.label}</span>
          <small>{m.hint}</small>
        </button>
      ))}
    </div>
  );
}
