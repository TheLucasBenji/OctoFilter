import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { ConvergencePoint, MetricType } from '../types';

const LABEL: Record<MetricType, string> = { mse: 'MSE', snr: 'SNR (dB)', piqe: 'PIQE' };

function xform(cost: number, m: MetricType) { return m === 'snr' ? -cost : cost; }

const Tip = ({ active, payload, label, m }: {
  active?: boolean; payload?: { value: number }[]; label?: number; m: MetricType
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--raised)', border: '1px solid var(--line-md)',
      borderRadius: 5, padding: '6px 10px',
      fontFamily: 'var(--mono)', fontSize: 11,
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ color: 'var(--t3)', marginBottom: 2 }}>iter {label}</div>
      <div style={{ color: 'var(--a)', fontWeight: 600 }}>
        {LABEL[m]} {payload[0].value.toFixed(4)}
      </div>
    </div>
  );
};

export default function ConvergenceChart({ data, metricType, totalIterations }: {
  data: ConvergencePoint[]; metricType: MetricType; totalIterations: number;
}) {
  const pts = data.map(d => ({ ...d, v: xform(d.cost, metricType) }));
  const vals = pts.map(p => p.v);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.1 || 0.5;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={pts} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="var(--chart-grid)" vertical={false} />
        <XAxis
          dataKey="iteration"
          tick={{ fontSize: 9, fontFamily: 'var(--mono)', fill: 'var(--t3)' }}
          tickLine={false}
          axisLine={{ stroke: 'var(--line-md)' }}
          domain={[1, totalIterations]}
          tickCount={6}
        />
        <YAxis
          domain={[lo - pad, hi + pad]}
          tick={{ fontSize: 9, fontFamily: 'var(--mono)', fill: 'var(--t3)' }}
          tickLine={false}
          axisLine={false}
          width={46}
          tickFormatter={v => v.toFixed(1)}
        />
        <Tooltip content={<Tip m={metricType} />} />
        <Line
          type="monotone"
          dataKey="v"
          stroke="var(--a)"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: 'var(--a)', strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
