import type { FilterType, MetricType, NoiseType } from './types';

export const TERM_HELP = {
  filter:
    'Filtro de reducción de ruido que se optimiza para esta imagen.',
  metric:
    'Criterio usado para decidir qué combinación de parámetros es mejor.',
  noise:
    'Alteración artificial aplicada a la imagen para probar la capacidad de recuperación del filtro.',
  ooa:
    'Octopus Optimization Algorithm: metaheurística que prueba soluciones candidatas y conserva las mejores.',
  convergence:
    'Evolución del mejor costo encontrado por el algoritmo durante la optimización.',
  cost:
    'Valor que OOA intenta mejorar. Según la métrica, puede representar error, calidad perceptual o señal/ruido.',
  bestParams:
    'Combinación de parámetros del filtro que obtuvo el mejor resultado durante la búsqueda.',
  sigma:
    'Intensidad del ruido gaussiano agregado a la imagen.',
  amount:
    'Proporción de píxeles afectados por ruido sal y pimienta.',
  population:
    'Cantidad de soluciones candidatas que OOA evalúa por iteración. Más población explora más, pero tarda más.',
  iterations:
    'Número de rondas de búsqueda del algoritmo. Más iteraciones pueden mejorar el resultado, pero aumentan el tiempo.',
  seed:
    'Valor opcional para repetir la misma aleatoriedad y obtener resultados comparables.',
} as const;

export const FILTER_HELP: Record<FilterType, string> = {
  bilateral:
    'Suaviza píxeles cercanos y parecidos en intensidad, preservando bordes mejor que un promedio simple.',
  anisotropic:
    'Difunde la imagen de forma controlada para suavizar regiones internas sin borrar tanto los bordes.',
  nlmeans:
    'Busca parches similares en la imagen y los combina para reducir ruido sin depender solo de vecinos cercanos.',
};

export const METRIC_HELP: Record<MetricType, string> = {
  mse:
    'Error cuadrático medio entre la imagen original y la filtrada. Menor es mejor.',
  snr:
    'Relación señal/ruido en decibeles. Mayor indica menos ruido relativo.',
  piqe:
    'Estimación perceptual de calidad sin imagen de referencia. Menor es mejor.',
};

export const NOISE_HELP: Record<NoiseType, string> = {
  gaussian:
    'Ruido distribuido alrededor de cada píxel, parecido a variaciones aleatorias de sensor o captura.',
  sp:
    'Ruido impulsivo que reemplaza algunos píxeles por valores blancos o negros.',
};

const PARAM_HELP: Record<string, string> = {
  d: 'Diámetro de la vecindad usada por el filtro bilateral. Valores mayores mezclan zonas más amplias.',
  sigmaColor:
    'Controla cuánto pueden diferir dos intensidades para seguir mezclándose en el filtro bilateral.',
  sigmaSpace:
    'Controla qué tan lejos puede influir un píxel vecino en el filtro bilateral.',
  niter:
    'Cantidad de pasos internos de difusión anisotrópica aplicados por el filtro.',
  kappa:
    'Umbral de gradiente que decide cuánto se preservan los bordes durante la difusión.',
  gamma:
    'Tasa de actualización de la difusión. Controla la intensidad de cada paso interno.',
  option:
    'Función de difusión usada por Perona-Malik: exponencial o recíproca.',
  h:
    'Fuerza de suavizado de Non-Local Means. Valores mayores eliminan más ruido, pero pueden borrar detalle.',
  templateWindowSize:
    'Tamaño del parche usado para comparar similitud entre zonas de la imagen.',
  searchWindowSize:
    'Tamaño de la ventana donde Non-Local Means busca parches similares.',
};

function normalizeTerm(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function getParamHelp(name: string): string | undefined {
  const normalized = normalizeTerm(name);

  if (normalized === 'd' || normalized.includes('diameter')) return PARAM_HELP.d;
  if (normalized.includes('sigmacolor') || normalized.includes('sigma color')) return PARAM_HELP.sigmaColor;
  if (normalized.includes('sigmaspace') || normalized.includes('sigma space')) return PARAM_HELP.sigmaSpace;
  if (normalized === 'niter' || normalized === 'iteraciones') return PARAM_HELP.niter;
  if (normalized === 'kappa') return PARAM_HELP.kappa;
  if (normalized === 'gamma') return PARAM_HELP.gamma;
  if (normalized.startsWith('opcion') || normalized === 'option') return PARAM_HELP.option;
  if (normalized === 'h' || normalized.includes('fuerza')) return PARAM_HELP.h;
  if (normalized.includes('templatewindowsize') || normalized.includes('template')) {
    return PARAM_HELP.templateWindowSize;
  }
  if (normalized.includes('searchwindowsize') || normalized.includes('search')) {
    return PARAM_HELP.searchWindowSize;
  }

  return undefined;
}
