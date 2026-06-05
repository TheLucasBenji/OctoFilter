import type { FilterParam, FilterType } from './types';

export interface ParamDisplayInfo {
  key: string;
  displayName: string;
  scientificName: string;
  symbol: string;
  commonName: string;
  aliases: string[];
  description: string;
}

const PARAM_DISPLAY_INFO: Record<FilterType, ParamDisplayInfo[]> = {
  bilateral: [
    {
      key: 'd',
      displayName: 'd · Neighborhood diameter',
      scientificName: 'Neighborhood diameter',
      symbol: 'd',
      commonName: 'd',
      aliases: ['d (diameter)', 'diameter', 'diametro', 'neighborhood diameter'],
      description: 'Diámetro de la vecindad espacial usada por el filtro bilateral.',
    },
    {
      key: 'sigmaColor',
      displayName: 'σr · Range sigma (sigmaColor)',
      scientificName: 'Range sigma',
      symbol: 'σr',
      commonName: 'sigmaColor',
      aliases: ['sigma Color', 'sigma color', 'range sigma', 'intensity sigma', 'sigma_r'],
      description: 'Sigma de rango que controla la similitud de intensidades en el filtro bilateral.',
    },
    {
      key: 'sigmaSpace',
      displayName: 'σs · Spatial sigma (sigmaSpace)',
      scientificName: 'Spatial sigma',
      symbol: 'σs',
      commonName: 'sigmaSpace',
      aliases: ['sigma Space', 'sigma space', 'spatial sigma', 'domain sigma', 'sigma_s'],
      description: 'Sigma espacial que controla la influencia de píxeles vecinos.',
    },
  ],
  anisotropic: [
    {
      key: 'niter',
      displayName: 'niter · Diffusion iterations',
      scientificName: 'Diffusion iterations',
      symbol: 'niter',
      commonName: 'niter',
      aliases: ['Iteraciones', 'iterations', 'iteraciones', 'diffusion steps'],
      description: 'Número de pasos de difusión aplicados por el modelo de Perona-Malik.',
    },
    {
      key: 'kappa',
      displayName: 'κ · Gradient threshold (kappa)',
      scientificName: 'Gradient threshold',
      symbol: 'κ',
      commonName: 'kappa',
      aliases: ['Kappa', 'conductance', 'gradient threshold', 'edge threshold'],
      description: 'Umbral de gradiente que regula la preservación de bordes en Perona-Malik.',
    },
    {
      key: 'gamma',
      displayName: 'γ · Diffusion rate / time step',
      scientificName: 'Diffusion rate / time step',
      symbol: 'γ',
      commonName: 'gamma',
      aliases: ['Gamma', 'time step', 'integration constant', 'diffusion rate'],
      description: 'Tasa de difusión o paso temporal que controla la intensidad de cada actualización.',
    },
    {
      key: 'option',
      displayName: 'g(|∇I|) · Conduction function',
      scientificName: 'Conduction function',
      symbol: 'g(|∇I|)',
      commonName: 'option',
      aliases: ['Opción (1=exp, 2=rec)', 'option', 'opcion 1 exp 2 rec', 'diffusion function', 'flux function'],
      description: 'Función de conducción de Perona-Malik: exponencial o recíproca.',
    },
  ],
  nlmeans: [
    {
      key: 'h',
      displayName: 'h · Filtering strength',
      scientificName: 'Filtering strength',
      symbol: 'h',
      commonName: 'h',
      aliases: ['h (fuerza)', 'denoising strength', 'filter strength', 'smoothing parameter'],
      description: 'Parámetro de suavizado que controla la fuerza de filtrado de Non-Local Means.',
    },
    {
      key: 'templateWindowSize',
      displayName: 'Patch size · templateWindowSize',
      scientificName: 'Patch size',
      symbol: 'T',
      commonName: 'templateWindowSize',
      aliases: ['templateWindowSize', 'template window size', 'patch size', 'template window'],
      description: 'Tamaño del parche usado para comparar similitud entre regiones.',
    },
    {
      key: 'searchWindowSize',
      displayName: 'Search window size · searchWindowSize',
      scientificName: 'Search window size',
      symbol: 'S',
      commonName: 'searchWindowSize',
      aliases: ['searchWindowSize', 'search window size', 'search window', 'search area'],
      description: 'Tamaño de la ventana donde se buscan parches similares.',
    },
  ],
};

export function normalizeParamName(value: string) {
  return value
    .replace(/σ/g, 'sigma')
    .replace(/κ/g, 'kappa')
    .replace(/γ/g, 'gamma')
    .replace(/∇/g, 'gradient')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function candidates(info: ParamDisplayInfo): string[] {
  return [
    info.key,
    info.displayName,
    info.scientificName,
    info.symbol,
    info.commonName,
    ...info.aliases,
  ].map(normalizeParamName);
}

function matches(info: ParamDisplayInfo, name: string): boolean {
  const normalized = normalizeParamName(name);
  return candidates(info).some((candidate) => {
    if (!candidate) return false;
    if (normalized === candidate) return true;
    if (candidate.length <= 2) return false;
    return normalized.includes(candidate) || candidate.includes(normalized);
  });
}

export function getParamDisplayInfo(
  filterType: FilterType,
  name: string,
  param?: FilterParam,
): ParamDisplayInfo {
  if (param?.display_name) {
    return {
      key: param.key ?? name,
      displayName: param.display_name,
      scientificName: param.scientific_name ?? param.display_name,
      symbol: param.symbol ?? param.key ?? name,
      commonName: param.common_name ?? param.key ?? name,
      aliases: param.aliases ?? [],
      description: param.description ?? '',
    };
  }

  const fallback = PARAM_DISPLAY_INFO[filterType].find((info) => matches(info, name));
  if (fallback) return fallback;

  return {
    key: param?.key ?? name,
    displayName: param?.display_name ?? name,
    scientificName: param?.scientific_name ?? name,
    symbol: param?.symbol ?? name,
    commonName: param?.common_name ?? name,
    aliases: param?.aliases ?? [],
    description: param?.description ?? '',
  };
}

export function getParamDisplayName(filterType: FilterType, name: string, param?: FilterParam): string {
  return getParamDisplayInfo(filterType, name, param).displayName;
}

export function getParamDescription(filterType: FilterType, name: string, param?: FilterParam): string | undefined {
  return getParamDisplayInfo(filterType, name, param).description || undefined;
}
