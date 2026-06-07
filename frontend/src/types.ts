export type FilterType = 'bilateral' | 'anisotropic' | 'nlmeans';
export type MetricType = 'mse' | 'snr' | 'piqe';
export type NoiseType = 'gaussian' | 'sp';
export type AlgorithmType = 'ooa' | 'sfoa';
export type ConfigMode = 'basic' | 'advanced';
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
  elapsed_ms?: number;
}

export type AppState = 'idle' | 'previewing' | 'optimizing' | 'complete' | 'error';
export type AppView = 'workspace' | 'history' | 'experimental';
export type OptimizationPhase = 'initializing' | 'iterating' | 'finalizing';

export interface OptimizationProgressEvent {
  type: 'progress';
  phase: OptimizationPhase;
  iteration: number;
  completed_iterations: number;
  total_iterations: number;
  remaining_iterations: number;
  progress_fraction: number;
  elapsed_ms: number;
  cost?: number;
}

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
