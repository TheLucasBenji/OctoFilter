import type { FilterParam, FilterType } from '../types';
import { getParamDisplayInfo, getParamDisplayName, normalizeParamName } from '../paramMetadata';

interface Props {
  filterType: FilterType;
  name: string;
  param?: FilterParam;
}

export function getParamAccessibleLabel(filterType: FilterType, name: string, param?: FilterParam): string {
  return getParamDisplayName(filterType, name, param);
}

export default function ParamLabel({ filterType, name, param }: Props) {
  const displayName = getParamDisplayName(filterType, name, param);
  const info = getParamDisplayInfo(filterType, name, param);
  const primary = info.scientificName || displayName;
  const secondary = info.commonName || info.key;

  if (!secondary || normalizeParamName(primary) === normalizeParamName(secondary)) {
    return <>{displayName}</>;
  }

  return (
    <span className="param-label-stack">
      <span>{primary}</span>
      <span>{secondary}</span>
    </span>
  );
}
