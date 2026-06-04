import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FilterInfo, FilterParam, FilterType, ParamKind } from '../types';
import { FILTER_HELP, getParamHelp } from '../helpTexts';
import { getParamDescription, getParamDisplayName, normalizeParamName } from '../paramMetadata';
import InfoHint from './InfoHint';

const FILTERS: { value: FilterType; label: string; short: string; desc: string }[] = [
  {
    value: 'bilateral',
    label: 'Filtro Bilateral',
    short: 'BF',
    desc: 'Espacio + intensidad',
  },
  {
    value: 'anisotropic',
    label: 'Difusión Anisotrópica',
    short: 'AD',
    desc: 'Suavizado con bordes',
  },
  {
    value: 'nlmeans',
    label: 'Non-Local Means',
    short: 'NLM',
    desc: 'Parches similares',
  },
];

interface Props {
  apiBase: string;
  onAuthExpired: () => void;
}

function buildDefaults(info: FilterInfo): number[] {
  return info.params.map(getDefaultParamValue);
}

function inferParamKind(name: string): ParamKind {
  const normalized = normalizeParamName(name);
  if (
    normalized === 'd' ||
    normalized.includes('diameter') ||
    normalized === 'niter' ||
    normalized === 'iteraciones' ||
    normalized === 'option' ||
    normalized.startsWith('opcion') ||
    normalized.includes('templatewindowsize') ||
    normalized.includes('template') ||
    normalized.includes('searchwindowsize') ||
    normalized.includes('search')
  ) {
    return normalized === 'option' || normalized.startsWith('opcion') ? 'choice' : 'int';
  }

  return 'float';
}

function getParamKind(param: FilterParam): ParamKind {
  return param.kind ?? inferParamKind(param.key ?? param.name);
}

function getManualLower(param: FilterParam): number {
  return param.manual_lb ?? param.lb;
}

function getManualUpper(param: FilterParam): number {
  return param.manual_ub ?? param.ub;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getChoices(param: FilterParam): number[] {
  return param.choices?.length ? param.choices : [getManualLower(param), getManualUpper(param)];
}

function normalizeParamValue(value: number, param: FilterParam): number {
  const kind = getParamKind(param);

  if (kind === 'choice') {
    return getChoices(param).reduce((best, choice) =>
      Math.abs(choice - value) < Math.abs(best - value) ? choice : best,
    );
  }

  const min = getManualLower(param);
  const max = getManualUpper(param);

  if (kind === 'float') return clamp(value, min, max);

  let next = Math.round(clamp(value, min, max));
  if (kind === 'odd-int' && next % 2 === 0) {
    next = next >= max ? next - 1 : next + 1;
  }
  return clamp(next, min, max);
}

function getDefaultParamValue(param: FilterParam): number {
  if (getParamKind(param) === 'choice') return getChoices(param)[0];
  return normalizeParamValue((getManualLower(param) + getManualUpper(param)) / 2, param);
}

function isIntegerParam(param: FilterParam): boolean {
  const kind = getParamKind(param);
  return kind === 'int' || kind === 'odd-int' || kind === 'choice';
}

function getStep(param: FilterParam): number {
  if (param.step) return param.step;
  if (isIntegerParam(param)) return getParamKind(param) === 'odd-int' ? 2 : 1;
  const range = getManualUpper(param) - getManualLower(param);
  if (range <= 1) return 0.01;
  if (range <= 10) return 0.1;
  return 1;
}

function formatParamValue(value: number, param: FilterParam): string {
  if (!Number.isFinite(value)) return '-';
  if (isIntegerParam(param)) return `${Math.round(value)}`;
  const step = getStep(param);
  if (step < 0.01) return value.toFixed(3);
  if (step < 0.1) return value.toFixed(2);
  if (step < 1) return value.toFixed(1);
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatBound(value: number): string {
  if (Number.isInteger(value)) return `${value}`;
  if (value < 1) return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return value.toFixed(1).replace(/0+$/, '').replace(/\.$/, '');
}

function getParamRule(param: FilterParam): string {
  const kind = getParamKind(param);
  if (kind === 'choice') return `solo ${getChoices(param).map(formatBound).join(' o ')}`;
  if (kind === 'odd-int') return 'entero impar, sin decimales';
  if (kind === 'int') return 'entero, sin decimales';
  return 'acepta decimales';
}

function getExperimentalParamHelp(filterType: FilterType, param: FilterParam): string {
  const base = getParamDescription(filterType, param.name, param) ?? getParamHelp(param.name);
  const min = formatBound(getManualLower(param));
  const max = formatBound(getManualUpper(param));
  const experimental = `Experimental: rango manual ${min} a ${max}; ${getParamRule(param)}.`;
  return base ? `${base} ${experimental}` : experimental;
}

function getChoiceLabel(param: FilterParam, choice: number): string {
  const normalized = normalizeParamName(param.key ?? param.name);
  if (normalized === 'option' || normalized.startsWith('opcion')) {
    return choice === 1 ? '1 · exp' : '2 · rec';
  }
  return formatBound(choice);
}

function ManualWorkspace({
  inputSrc,
  resultSrc,
  fileName,
  busy,
  onFileUpload,
}: {
  inputSrc: string | null;
  resultSrc: string | null;
  fileName: string | null;
  busy: boolean;
  onFileUpload: (file: File) => void;
}) {
  const [drag, setDrag] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f && f.type.startsWith('image/')) onFileUpload(f);
  };

  return (
    <div className="img-workspace exp-workspace">
      <div className="img-pane">
        <div className="img-pane-header">
          <span className="pane-title">Entrada</span>
          <span className="pane-status" title={fileName ?? undefined}>
            {fileName ?? 'selecciona imagen'}
          </span>
        </div>

        {!inputSrc ? (
          <label
            className={`upload-zone${drag ? ' drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <input type="file" accept="image/*" onChange={(e) => handleFiles(e.target.files)} />
            <div className="upload-ring">+</div>
            <div className="upload-label">Arrastra una imagen o haz clic</div>
            <div className="upload-hint">PNG · JPG</div>
          </label>
        ) : (
          <>
            <div className="result-img">
              <img src={inputSrc} alt="entrada" />
            </div>
            <div className="change-img">
              <label>
                <input type="file" accept="image/*" onChange={(e) => handleFiles(e.target.files)} />
                cambiar imagen
              </label>
            </div>
          </>
        )}
      </div>

      <div className="img-pane">
        <div className="img-pane-header">
          <span className="pane-title">Resultado</span>
          <span className="pane-status">
            {busy ? (
              <>
                <div className="spinner" style={{ width: 10, height: 10 }} /> &nbsp;Aplicando...
              </>
            ) : resultSrc ? (
              <>
                <span className="dot dot-green" /> listo
              </>
            ) : (
              'sin aplicar'
            )}
          </span>
        </div>

        {resultSrc ? (
          <>
            <div className="result-img">
              <img src={resultSrc} alt="resultado" />
            </div>
            <div className="dl-link">
              <a href={resultSrc} download="octopus_experimental.png">
                descargar PNG
              </a>
            </div>
          </>
        ) : (
          <div className="result-empty">
            <div className="result-empty-glyph">□</div>
            <div className="result-empty-text">
              Sube una imagen y aplica el filtro manual
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExperimentalSidebar({
  filterType,
  activeFilter,
  activeParams,
  hasFile,
  busy,
  onFilterChange,
  onParamChange,
  onApply,
  onReset,
}: {
  filterType: FilterType;
  activeFilter: FilterInfo | undefined;
  activeParams: number[];
  hasFile: boolean;
  busy: boolean;
  onFilterChange: (next: FilterType) => void;
  onParamChange: (idx: number, value: number, param: FilterParam) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const canApply = hasFile && !!activeFilter && !busy;
  const applyLabel =
    busy ? 'Aplicando...'
    : !hasFile ? 'Sube una imagen para aplicar'
    : !activeFilter ? 'Cargando filtros...'
    : 'Aplicar filtro';

  return (
    <aside className="sidebar sidebar-experimental">
      <div className="sidebar-content" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="sb-group">
          <div className="step-heading">
            <span className="step-num">1</span>
            <span>Filtro</span>
          </div>
          <div className="filter-btns">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                className={`filter-btn${filterType === f.value ? ' active' : ''}`}
                onClick={() => onFilterChange(f.value)}
                title={FILTER_HELP[f.value]}
                aria-label={`${f.label}. ${FILTER_HELP[f.value]}`}
                disabled={busy}
              >
                <span className="filter-dot" />
                <span>
                  <span className="filter-title">{f.label}</span>
                  <span className="filter-desc">{f.desc}</span>
                </span>
                <span className="filter-short">{f.short}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sb-group">
          <div className="step-heading">
            <span className="step-num">2</span>
            <span>Parámetros</span>
          </div>

          {!activeFilter ? (
            <div className="exp-empty">Cargando filtros...</div>
          ) : (
            <div className="exp-params">
              {activeFilter.params.map((p, idx) => {
                const label = getParamDisplayName(filterType, p.name, p);
                const help = getExperimentalParamHelp(filterType, p);
                const value = activeParams[idx];
                const kind = getParamKind(p);
                const min = getManualLower(p);
                const max = getManualUpper(p);
                return (
                  <div key={`${filterType}-${p.key ?? p.name}`} className="field">
                    <label className="field-label">
                      <InfoHint label={label} description={help} className="field-label-name" />
                      <span className="field-label-val">{formatParamValue(value, p)}</span>
                    </label>
                    {kind === 'choice' ?
                      <div className="exp-choice-row" role="group" aria-label={label}>
                        {getChoices(p).map((choice) => (
                          <button
                            key={`${p.key ?? p.name}-${choice}`}
                            type="button"
                            className={`exp-choice-btn${Math.round(value) === choice ? ' active' : ''}`}
                            onClick={() => onParamChange(idx, choice, p)}
                            disabled={busy}
                          >
                            {getChoiceLabel(p, choice)}
                          </button>
                        ))}
                      </div>
                    :
                      <div className="exp-param-control">
                        <input
                          type="number"
                          min={min}
                          max={max}
                          step={getStep(p)}
                          inputMode={isIntegerParam(p) ? 'numeric' : 'decimal'}
                          value={Number.isFinite(value) ? value : ''}
                          onChange={(e) => {
                            const nextVal = Number(e.target.value);
                            if (Number.isNaN(nextVal)) return;
                            onParamChange(idx, nextVal, p);
                          }}
                          disabled={busy}
                        />
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={getStep(p)}
                          value={Number.isFinite(value) ? value : getDefaultParamValue(p)}
                          onChange={(e) => {
                            const nextVal = Number(e.target.value);
                            if (Number.isNaN(nextVal)) return;
                            onParamChange(idx, nextVal, p);
                          }}
                          disabled={busy}
                          aria-label={`Ajustar ${label}`}
                        />
                      </div>
                    }
                    <div className="exp-param-range">
                      Rango manual {formatBound(min)} — {formatBound(max)} · {getParamRule(p)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sb-group">
          <div className="step-heading">
            <span className="step-num">3</span>
            <span>Aplicar</span>
          </div>
          <div className="exp-action-row">
            <button type="button" className="run-btn" onClick={onApply} disabled={!canApply}>
              {applyLabel}
            </button>
            <button type="button" className="exp-reset-btn" onClick={onReset} disabled={!activeFilter || busy}>
              Reset
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function ExperimentalView({ apiBase, onAuthExpired }: Props) {
  const [filterInfo, setFilterInfo] = useState<Record<string, FilterInfo>>({});
  const [filterType, setFilterType] = useState<FilterType>('bilateral');
  const [paramsByFilter, setParamsByFilter] = useState<Record<FilterType, number[]>>(
    {} as Record<FilterType, number[]>,
  );
  const [status, setStatus] = useState<'idle' | 'applying'>('idle');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const fileRef = useRef<File | null>(null);
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fetch(`${apiBase}/api/filters`, { credentials: 'include' })
      .then((r) => {
        if (r.status === 401) {
          onAuthExpired();
          return Promise.reject();
        }
        return r.ok ? r.json() : Promise.reject();
      })
      .then((data: Record<string, FilterInfo>) => {
        setFilterInfo(data);
        setParamsByFilter((prev) => {
          const next = { ...prev } as Record<FilterType, number[]>;
          (Object.keys(data) as FilterType[]).forEach((key) => {
            if (!next[key] || next[key].length !== data[key].params.length) {
              next[key] = buildDefaults(data[key]);
            }
          });
          return next;
        });
      })
      .catch(() => {});
  }, [apiBase, onAuthExpired]);

  const updatePreview = useCallback((file: File) => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
    }
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setPreviewSrc(url);
  }, []);

  const handleFileUpload = useCallback(
    (file: File) => {
      fileRef.current = file;
      setFileName(file.name);
      setOriginalImage(null);
      setResultImage(null);
      setError(null);
      updatePreview(file);
    },
    [updatePreview],
  );

  const activeFilter = filterInfo[filterType];
  const activeParams = paramsByFilter[filterType] ?? [];
  const isBusy = status === 'applying';
  const hasFile = !!fileRef.current;

  const inputSrc = useMemo(() => {
    if (originalImage) return `data:image/png;base64,${originalImage}`;
    return previewSrc;
  }, [originalImage, previewSrc]);

  const resultSrc = useMemo(() => {
    if (!resultImage) return null;
    return `data:image/png;base64,${resultImage}`;
  }, [resultImage]);

  const applyFilter = useCallback(async () => {
    if (!fileRef.current || !activeFilter) return;

    const cleaned = activeFilter.params.map((p, i) => {
      const v = activeParams[i];
      return normalizeParamValue(Number.isFinite(v) ? v : getDefaultParamValue(p), p);
    });

    const fd = new FormData();
    fd.append('image', fileRef.current);
    fd.append('filter_type', filterType);
    fd.append('params', JSON.stringify(cleaned));

    setStatus('applying');
    setError(null);

    try {
      const r = await fetch(`${apiBase}/api/manual-filter`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (r.status === 401) {
        onAuthExpired();
        return;
      }
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.detail ?? `No se pudo aplicar el filtro (${r.status}).`);
      }
      const data = await r.json();
      setOriginalImage(data.original_image);
      setResultImage(data.result_image);
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }
      setPreviewSrc(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatus('idle');
    }
  }, [activeFilter, activeParams, apiBase, filterType, onAuthExpired]);

  const resetParams = useCallback(() => {
    if (!activeFilter) return;
    setParamsByFilter((prev) => ({
      ...prev,
      [filterType]: buildDefaults(activeFilter),
    }));
  }, [activeFilter, filterType]);

  const handleParamChange = useCallback(
    (idx: number, value: number, param: FilterParam) => {
      if (!activeFilter) return;
      setParamsByFilter((prev) => {
        const existing = prev[filterType] ?? buildDefaults(activeFilter);
        const nextParams = [...existing];
        nextParams[idx] = normalizeParamValue(value, param);
        return { ...prev, [filterType]: nextParams };
      });
    },
    [activeFilter, filterType],
  );

  return (
    <>
      <ExperimentalSidebar
        filterType={filterType}
        activeFilter={activeFilter}
        activeParams={activeParams}
        hasFile={hasFile}
        busy={isBusy}
        onFilterChange={setFilterType}
        onParamChange={handleParamChange}
        onApply={applyFilter}
        onReset={resetParams}
      />

      <main className="main">
        <div className="exp-main">
          {error && <div className="err-banner">{error}</div>}
          <ManualWorkspace
            inputSrc={inputSrc}
            resultSrc={resultSrc}
            fileName={fileName}
            busy={isBusy}
            onFileUpload={handleFileUpload}
          />
        </div>
      </main>
    </>
  );
}
