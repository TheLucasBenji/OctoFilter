export type FilterType = 'bilateral' | 'anisotropic' | 'nlmeans';
export type MetricType = 'mse' | 'snr' | 'piqe';
export type NoiseType = 'gaussian' | 'sp';
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

export interface ConvergencePoint {
  iteration: number;
  cost: number;
}
