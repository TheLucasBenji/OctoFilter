import { useEffect, useState } from 'react';
import { FaRegCircleStop } from 'react-icons/fa6';
import { AlgorithmType, AppParams, AppState, ConfigMode, FilterType, MetricType, NoiseType } from '../types';
import { ALGORITHM_HELP, FILTER_HELP, METRIC_HELP, NOISE_HELP, TERM_HELP, getParamHelp } from '../helpTexts';
import InfoHint from './InfoHint';
import MetricSelector from './MetricSelector';

const API = 'http://localhost:8000';

interface FilterParam {
  name: string;
  lb: number;
  ub: number;
}
interface FilterInfo {
  label: string;
  dim: number;
  params: FilterParam[];
}

interface Props {
  params: AppParams;
  onChange: (p: AppParams) => void;
  onRun: () => void;
  onCancel: () => void;
  canRun: boolean;
  appState: AppState;
  currentIteration: number;
  mode: ConfigMode;
}

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

const METRICS: { value: MetricType; label: string; hint: string }[] = [
  { value: 'mse', label: 'MSE', hint: 'minimizar error' },
  { value: 'snr', label: 'SNR', hint: 'maximizar señal' },
  { value: 'piqe', label: 'PIQE', hint: 'perceptual sin referencia' },
];

const ALGORITHMS: { value: AlgorithmType; label: string; short: string }[] = [
  { value: 'ooa', label: 'Octopus', short: 'OOA' },
  { value: 'sfoa', label: 'Starfish', short: 'SFOA' },
];

function RunBlock({
  locked,
  canRun,
  appState,
  currentIteration,
  iterations,
  onRun,
  onCancel,
}: {
  locked: boolean;
  canRun: boolean;
  appState: AppState;
  currentIteration: number;
  iterations: number;
  onRun: () => void;
  onCancel: () => void;
}) {
  const pct =
    appState === 'optimizing' ? Math.round((currentIteration / (iterations || 1)) * 100)
    : appState === 'complete' ? 100
    : 0;

  return (
    <div className="sb-group sb-run">
      {locked ?
        <div className="run-busy">
          <span className="run-busy-label">
            <span className="spinner" />
            Optimizando...
          </span>
          <button
            type="button"
            className="stop-btn"
            onClick={onCancel}
            aria-label="Cancelar optimización"
            title="Cancelar optimización">
            <FaRegCircleStop aria-hidden="true" />
          </button>
        </div>
      : <button className="run-btn" onClick={onRun} disabled={!canRun}>
          Ejecutar
        </button>
      }

      {(locked || appState === 'complete') && (
        <div className="progress-wrap">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="progress-meta">
            <span>{locked ? `iter ${currentIteration} / ${iterations}` : 'completo'}</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  params,
  onChange,
  onRun,
  onCancel,
  canRun,
  appState,
  currentIteration,
  mode,
}: Props) {
  const [filterInfo, setFilterInfo] = useState<Record<string, FilterInfo>>({});
  const locked = appState === 'optimizing';
  const set = <K extends keyof AppParams>(k: K, v: AppParams[K]) => onChange({ ...params, [k]: v });

  useEffect(() => {
    fetch(`${API}/api/filters`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setFilterInfo)
      .catch(() => {});
  }, []);

  const curFilter = filterInfo[params.filterType];

  return (
    <aside className={`sidebar sidebar-${mode}`}>
      <div className="sidebar-content" style={{ flex: 1, overflowY: 'auto' }}>
        {mode === 'basic' ?
          <>
            {/* ── Algoritmo (basic) ─────────────────────────────────── */}
            <div className="sb-group">
              <div className="step-heading">
                <span className="step-num">1</span>
                <InfoHint label="Algoritmo" description={TERM_HELP.algorithm} className="step-heading-label" />
              </div>
              <div className="algo-btns">
                {ALGORITHMS.map((a) => (
                  <button
                    key={a.value}
                    className={`algo-btn${params.algorithm === a.value ? ' active' : ''}`}
                    onClick={() => set('algorithm', a.value)}
                    disabled={locked}
                    title={ALGORITHM_HELP[a.value]}
                    aria-label={`${a.label}. ${ALGORITHM_HELP[a.value]}`}>
                    <span
                      className="algo-dot"
                      style={params.algorithm === a.value ? { background: `var(--${a.value})` } : undefined}
                    />
                    <span className="filter-title">{a.label}</span>
                    <span className="algo-short">{a.short}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Filtro (basic) ────────────────────────────────────── */}
            <div className="sb-group">
              <div className="step-heading">
                <span className="step-num">2</span>
                <InfoHint label="Filtro" description={TERM_HELP.filter} className="step-heading-label" />
              </div>
              <div className="filter-btns">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    className={`filter-btn${params.filterType === f.value ? ' active' : ''}`}
                    onClick={() => set('filterType', f.value)}
                    disabled={locked}
                    title={FILTER_HELP[f.value]}
                    aria-label={`${f.label}. ${FILTER_HELP[f.value]}`}>
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

            {/* ── Métrica (basic) ───────────────────────────────────── */}
            <div className="sb-group">
              <div className="step-heading">
                <span className="step-num">3</span>
                <InfoHint label="Métrica" description={TERM_HELP.metric} className="step-heading-label" />
              </div>
              <MetricSelector
                value={params.metricType}
                onChange={(m) => set('metricType', m)}
                disabled={locked}
                metrics={METRICS}
                variant="stacked"
              />
            </div>

            {/* ── Ajuste automático (basic) ─────────────────────────── */}
            <div className="sb-group">
              <div className="step-heading">
                <span className="step-num">4</span>
                <span>Ajuste automático</span>
              </div>
              <div className="preset-grid">
                <div className="preset-item">
                  <InfoHint
                    label="Ruido"
                    description={`${TERM_HELP.noise} En modo básico se usa ruido gaussiano: ${NOISE_HELP.gaussian}`}
                    icon={false}
                    className="preset-label"
                  />
                  <strong>Gaussiano</strong>
                </div>
                <div className="preset-item">
                  <InfoHint label="Sigma" description={TERM_HELP.sigma} icon={false} className="preset-label" />
                  <strong>25</strong>
                </div>
                <div className="preset-item">
                  <InfoHint
                    label="Población"
                    description={TERM_HELP.population}
                    icon={false}
                    className="preset-label"
                  />
                  <strong>30</strong>
                </div>
                <div className="preset-item">
                  <InfoHint
                    label="Iteraciones"
                    description={TERM_HELP.iterations}
                    icon={false}
                    className="preset-label"
                  />
                  <strong>50</strong>
                </div>
              </div>
            </div>
          </>
        : <>
            {/* ── 1. Algoritmo (advanced) ───────────────────────────── */}
            <div className="sb-group">
              <div className="step-heading">
                <span className="step-num">1</span>
                <InfoHint label="Algoritmo" description={TERM_HELP.algorithm} className="step-heading-label" />
              </div>

              <div className="algo-btns">
                {ALGORITHMS.map((a) => (
                  <button
                    key={a.value}
                    className={`algo-btn${params.algorithm === a.value ? ' active' : ''}`}
                    onClick={() => set('algorithm', a.value)}
                    disabled={locked}
                    title={ALGORITHM_HELP[a.value]}
                    aria-label={`${a.label}. ${ALGORITHM_HELP[a.value]}`}>
                    <span
                      className="algo-dot"
                      style={params.algorithm === a.value ? { background: `var(--${a.value})` } : undefined}
                    />
                    <span className="filter-title">{a.label}</span>
                    <span className="algo-short">{a.short}</span>
                  </button>
                ))}
              </div>

              <div className="field">
                <label className="field-label">
                  <InfoHint label="Población" description={TERM_HELP.population} className="field-label-name" />
                  <span className="field-label-val">{params.population}</span>
                </label>
                <input
                  type="range"
                  min={9}
                  max={200}
                  step={1}
                  value={params.population}
                  onChange={(e) => set('population', Number(e.target.value))}
                  disabled={locked}
                />
              </div>

              <div className="field">
                <label className="field-label">
                  <InfoHint label="Iteraciones" description={TERM_HELP.iterations} className="field-label-name" />
                  <span className="field-label-val">{params.iterations}</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={500}
                  step={5}
                  value={params.iterations}
                  onChange={(e) => set('iterations', Number(e.target.value))}
                  disabled={locked}
                />
              </div>

              <div className="field">
                <label className="field-label">
                  <InfoHint label="Semilla" description={TERM_HELP.seed} className="field-label-name" />
                  <span className="field-label-optional">opcional</span>
                </label>
                <input
                  type="number"
                  placeholder="-"
                  value={params.seed}
                  onChange={(e) => set('seed', e.target.value)}
                  disabled={locked}
                />
              </div>
            </div>

            {/* ── 2. Ruido (advanced) ───────────────────────────────── */}
            <div className="sb-group">
              <div className="step-heading">
                <span className="step-num">2</span>
                <InfoHint label="Ruido" description={TERM_HELP.noise} className="step-heading-label" />
              </div>

              <div className="field">
                <div className="noise-seg">
                  {(['gaussian', 'sp'] as NoiseType[]).map((t) => (
                    <button
                      key={t}
                      className={`noise-seg-btn${params.noiseType === t ? ' active' : ''}`}
                      onClick={() => set('noiseType', t)}
                      disabled={locked}
                      title={NOISE_HELP[t]}
                      aria-label={`${t === 'gaussian' ? 'Gaussiano' : 'Sal y pimienta'}. ${NOISE_HELP[t]}`}>
                      {t === 'gaussian' ? 'Gaussiano' : 'Sal y pimienta'}
                    </button>
                  ))}
                </div>
              </div>

              {params.noiseType === 'gaussian' ?
                <div className="field">
                  <label className="field-label">
                    <InfoHint label="Sigma" description={TERM_HELP.sigma} className="field-label-name" />
                    <span className="field-label-val">{params.noiseSigma}</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={params.noiseSigma}
                    onChange={(e) => set('noiseSigma', Number(e.target.value))}
                    disabled={locked}
                  />
                </div>
              : <div className="field">
                  <label className="field-label">
                    <InfoHint label="Cantidad" description={TERM_HELP.amount} className="field-label-name" />
                    <span className="field-label-val">{params.noiseAmount.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min={0.01}
                    max={0.3}
                    step={0.01}
                    value={params.noiseAmount}
                    onChange={(e) => set('noiseAmount', Number(e.target.value))}
                    disabled={locked}
                  />
                </div>
              }
            </div>

            {/* ── 3. Filtro (advanced) ──────────────────────────────── */}
            <div className="sb-group">
              <div className="step-heading">
                <span className="step-num">3</span>
                <InfoHint label="Filtro" description={TERM_HELP.filter} className="step-heading-label" />
              </div>
              <div className="filter-btns">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    className={`filter-btn${params.filterType === f.value ? ' active' : ''}`}
                    onClick={() => set('filterType', f.value)}
                    disabled={locked}
                    title={FILTER_HELP[f.value]}
                    aria-label={`${f.label}. ${FILTER_HELP[f.value]}`}>
                    <span className="filter-dot" />
                    <span className="filter-title">{f.label}</span>
                    <span className="filter-short">{f.short}</span>
                  </button>
                ))}
              </div>
              {curFilter && (
                <div className="filter-params">
                  {curFilter.params.map((p) => {
                    const help = getParamHelp(p.name);
                    return help ?
                        <InfoHint key={p.name} label={p.name} description={help} icon={false} className="fp-chip" />
                      : <span key={p.name} className="fp-chip">
                          {p.name}
                        </span>;
                  })}
                </div>
              )}
            </div>

            {/* ── 4. Métrica (advanced) ────────────────────────────── */}
            <div className="sb-group">
              <div className="step-heading">
                <span className="step-num">4</span>
                <InfoHint label="Métrica" description={TERM_HELP.metric} className="step-heading-label" />
              </div>
              <MetricSelector
                value={params.metricType}
                onChange={(m) => set('metricType', m)}
                disabled={locked}
                metrics={METRICS}
                variant="basic"
              />
            </div>
          </>
        }
      </div>

      <RunBlock
        locked={locked}
        canRun={canRun}
        appState={appState}
        currentIteration={currentIteration}
        iterations={params.iterations}
        onRun={onRun}
        onCancel={onCancel}
      />
    </aside>
  );
}
