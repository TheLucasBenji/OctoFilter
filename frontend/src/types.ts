export type FilterType = 'bilateral' | 'anisotropic' | 'nlmeans';
export type MetricType = 'mse' | 'snr' | 'piqe';
export type NoiseType = 'gaussian' | 'sp';
export type AlgorithmType = 'ooa' | 'sfoa' | 'ao';
export type LegacyAlgorithmType = 'aquila';
export type ConfigMode = 'basic' | 'advanced';
export type HistoryEntryType = 'optimization' | 'experimental';
export type HistorySourceMode = ConfigMode | 'experimental';
export type ThemePreference = 'light' | 'dark';
export type ParamKind = 'float' | 'int' | 'odd-int' | 'choice';

export interface FilterParam {
  name: string;
  lb: number;
  ub: number;
  manual_lb?: number;
  manual_ub?: number;
  kind?: ParamKind;
  step?: number;
  choices?: number[];
  key?: string;
  display_name?: string;
  scientific_name?: string;
  symbol?: string;
  common_name?: string;
  aliases?: string[];
  description?: string;
}

export interface FilterInfo {
  label: string;
  dim: number;
  params: FilterParam[];
}

export interface AuthUser {
  id: number;
  email: string;
}

export interface AppParams {
  filterType: FilterType;
  metricType: MetricType;
  noiseType: NoiseType;
  noiseSigma: number;
  noiseAmount: number;
  population: number;
  iterations: number;
  seed: string;
  algorithm: AlgorithmType;
}

export interface ResultMetrics {
  mse: number;
  snr: number;
  piqe: number | null;
  noisy_mse: number;
  noisy_snr: number;
  noisy_piqe: number | null;
  best_cost: number;
  metric_used: string;
}

export interface OptimizationResult {
  result_image: string;
  convergence: number[];
  metrics: ResultMetrics;
  params: Record<string, number>;
  duration_ms?: number | null;
}

export interface RuntimeEstimate {
  estimated_low_ms: number;
  estimated_ms: number;
  nfe: number;
  t_eval_mean_ms: number;
  t_eval_min_ms: number;
  parallel_speedup: number;
}

export type AppState = 'idle' | 'previewing' | 'optimizing' | 'complete' | 'error';
export type AppView = 'workspace' | 'history' | 'experimental';

export interface ConvergencePoint {
  iteration: number;
  cost: number;
}

interface HistoryBase {
  id: number;
  entry_type: HistoryEntryType;
  history_key: string;
  created_at: string;
  filter_type: FilterType;
  source_mode: HistorySourceMode;
}

export interface OptimizationHistorySummary extends HistoryBase {
  entry_type: 'optimization';
  metric_type: MetricType;
  best_cost: number;
  metric_used: string;
  algorithm?: AlgorithmType | LegacyAlgorithmType | null;
  source_mode: ConfigMode;
}

export interface ExperimentalHistorySummary extends HistoryBase {
  entry_type: 'experimental';
  metric_type: null;
  best_cost: null;
  metric_used: null;
  algorithm: null;
  source_mode: 'experimental';
}

export type HistorySummary = OptimizationHistorySummary | ExperimentalHistorySummary;

export interface OptimizationHistoryDetail extends OptimizationHistorySummary {
  noise_type: NoiseType;
  noise_sigma: number;
  noise_amount: number;
  population: number;
  iterations: number;
  seed: number | null;
  config_mode?: ConfigMode;
  params: Record<string, number>;
  metrics: ResultMetrics;
  convergence: number[];
  original_image: string | null;
  noisy_image: string | null;
  result_image: string | null;
  duration_ms: number | null;
}

export interface ExperimentalHistoryDetail extends ExperimentalHistorySummary {
  params: Record<string, number>;
  input_image: string | null;
  result_image: string | null;
  duration_ms: number | null;
}

export type HistoryDetail = OptimizationHistoryDetail | ExperimentalHistoryDetail;

export interface ExperimentalConfig {
  filterType: FilterType;
  params: Record<string, number>;
}
