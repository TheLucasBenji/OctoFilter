export type FilterType = 'bilateral' | 'anisotropic' | 'nlmeans';
export type MetricType = 'mse' | 'snr' | 'piqe';
export type NoiseType = 'gaussian' | 'sp';
export type AlgorithmType = 'ooa' | 'sfoa';
export type ConfigMode = 'basic' | 'advanced';
export type ThemePreference = 'light' | 'dark';

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
}

export type AppState = 'idle' | 'previewing' | 'optimizing' | 'complete' | 'error';
export type AppView = 'workspace' | 'history';

export interface ConvergencePoint {
  iteration: number;
  cost: number;
}

export interface HistorySummary {
  id: number;
  created_at: string;
  filter_type: FilterType;
  metric_type: MetricType;
  best_cost: number;
  metric_used: string;
  algorithm?: AlgorithmType;
}

export interface HistoryDetail extends HistorySummary {
  noise_type: NoiseType;
  noise_sigma: number;
  noise_amount: number;
  population: number;
  iterations: number;
  seed: number | null;
  algorithm?: AlgorithmType;
  params: Record<string, number>;
  metrics: ResultMetrics;
  convergence: number[];
  original_image: string | null;
  noisy_image: string | null;
  result_image: string | null;
  duration_ms: number | null;
}
