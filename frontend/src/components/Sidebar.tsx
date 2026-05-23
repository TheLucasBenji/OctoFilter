import { useEffect, useState } from 'react';
import {
  AppParams,
  AppState,
  ConfigMode,
  FilterType,
  MetricType,
  NoiseType,
} from '../types';

const API = 'http://localhost:8000';

interface FilterParam { name: string; lb: number; ub: number; }
interface FilterInfo { label: string; dim: number; params: FilterParam[]; }

interface Props {
  params: AppParams;
  onChange: (p: AppParams) => void;
  onRun: () => void;
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

function RunBlock({
  locked,
  canRun,
  appState,
  currentIteration,
  iterations,
  onRun,
}: {
  locked: boolean;
  canRun: boolean;
  appState: AppState;
  currentIteration: number;
  iterations: number;
  onRun: () => void;
}) {
  const pct = appState === 'optimizing'
    ? Math.round((currentIteration / (iterations || 1)) * 100)
    : appState === 'complete' ? 100 : 0;

  return (
    <div className="sb-group sb-run">
      <button
        className={`run-btn${locked ? ' busy' : ''}`}
        onClick={onRun}
        disabled={!canRun}
      >
        {locked ? <><div className="spinner" />Optimizando...</> : 'Ejecutar'}
      </button>

      {(locked || appState === 'complete') && (
        <div className="progress-wrap">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="progress-meta">
            <span>
              {locked ? `iter ${currentIteration} / ${iterations}` : 'completo'}
            </span>
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
  canRun,
  appState,
  currentIteration,
  mode,
}: Props) {
  const [filterInfo, setFilterInfo] = useState<Record<string, FilterInfo>>({});
  const locked = appState === 'optimizing';
  const set = <K extends keyof AppParams>(k: K, v: AppParams[K]) => onChange({ ...params, [k]: v });

  useEffect(() => {
    fetch(`${API}/api/filters`).then(r => r.json()).then(setFilterInfo).catch(() => {});
  }, []);

  const curFilter = filterInfo[params.filterType];
  const imageReady = canRun || appState === 'optimizing' || appState === 'complete';

  return (
    <aside className={`sidebar sidebar-${mode}`}>
      {mode === 'basic' ? (
        <>
          <div className="sb-group sb-hero">
            <div className="sb-label">Modo básico</div>
            <div className="basic-status">
              <span className={`basic-status-dot${imageReady ? ' ready' : ''}`} />
              <span>{imageReady ? 'Imagen lista' : 'Sin imagen'}</span>
            </div>
          </div>

          <div className="sb-group">
            <div className="step-heading">
              <span className="step-num">1</span>
              <span>Filtro</span>
            </div>
            <div className="filter-btns">
              {FILTERS.map(f => (
                <button
                  key={f.value}
                  className={`filter-btn${params.filterType === f.value ? ' active' : ''}`}
                  onClick={() => set('filterType', f.value)}
                  disabled={locked}
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
              <span>Métrica</span>
            </div>
            <div className="metric-btns">
              {METRICS.map(m => (
                <button
                  key={m.value}
                  className={`metric-btn${params.metricType === m.value ? ' active' : ''}`}
                  onClick={() => set('metricType', m.value)}
                  disabled={locked}
                >
                  <span>{m.label}</span>
                  <small>{m.hint}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="sb-group">
            <div className="step-heading">
              <span className="step-num">3</span>
              <span>Ajuste automático</span>
            </div>
            <div className="preset-grid">
              <div className="preset-item">
                <span>Ruido</span>
                <strong>Gaussiano</strong>
              </div>
              <div className="preset-item">
                <span>Sigma</span>
                <strong>25</strong>
              </div>
              <div className="preset-item">
                <span>Población</span>
                <strong>30</strong>
              </div>
              <div className="preset-item">
                <span>Iteraciones</span>
                <strong>50</strong>
              </div>
            </div>
          </div>

          <RunBlock
            locked={locked}
            canRun={canRun}
            appState={appState}
            currentIteration={currentIteration}
            iterations={params.iterations}
            onRun={onRun}
          />
        </>
      ) : (
        <>
          <div className="sb-group">
            <div className="sb-label">Filtro</div>
            <div className="filter-btns">
              {FILTERS.map(f => (
                <button
                  key={f.value}
                  className={`filter-btn${params.filterType === f.value ? ' active' : ''}`}
                  onClick={() => set('filterType', f.value)}
                  disabled={locked}
                >
                  <span className="filter-dot" />
                  <span className="filter-title">{f.label}</span>
                  <span className="filter-short">{f.short}</span>
                </button>
              ))}
            </div>
            {curFilter && (
              <div className="filter-params">
                {curFilter.params.map(p => (
                  <span key={p.name} className="fp-chip">{p.name}</span>
                ))}
              </div>
            )}
          </div>

          <div className="sb-group">
            <div className="sb-label">Ruido</div>

            <div className="field">
              <div className="noise-seg">
                {(['gaussian', 'sp'] as NoiseType[]).map(t => (
                  <button
                    key={t}
                    className={`noise-seg-btn${params.noiseType === t ? ' active' : ''}`}
                    onClick={() => set('noiseType', t)}
                    disabled={locked}
                  >
                    {t === 'gaussian' ? 'Gaussiano' : 'Sal y pimienta'}
                  </button>
                ))}
              </div>
            </div>

            {params.noiseType === 'gaussian' ? (
              <div className="field">
                <label className="field-label">
                  Sigma
                  <span className="field-label-val">{params.noiseSigma}</span>
                </label>
                <input
                  type="range"
                  min={1} max={100} step={1}
                  value={params.noiseSigma}
                  onChange={e => set('noiseSigma', Number(e.target.value))}
                  disabled={locked}
                />
              </div>
            ) : (
              <div className="field">
                <label className="field-label">
                  Cantidad
                  <span className="field-label-val">{params.noiseAmount.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min={0.01} max={0.30} step={0.01}
                  value={params.noiseAmount}
                  onChange={e => set('noiseAmount', Number(e.target.value))}
                  disabled={locked}
                />
              </div>
            )}
          </div>

          <div className="sb-group">
            <div className="sb-label">Algoritmo — OOA</div>

            <div className="field">
              <label className="field-label">
                Población
                <span className="field-label-val">{params.population}</span>
              </label>
              <input
                type="range"
                min={9} max={200} step={1}
                value={params.population}
                onChange={e => set('population', Number(e.target.value))}
                disabled={locked}
              />
            </div>

            <div className="field">
              <label className="field-label">
                Iteraciones
                <span className="field-label-val">{params.iterations}</span>
              </label>
              <input
                type="range"
                min={5} max={500} step={5}
                value={params.iterations}
                onChange={e => set('iterations', Number(e.target.value))}
                disabled={locked}
              />
            </div>

            <div className="field">
              <label className="field-label">Métrica objetivo</label>
              <select
                value={params.metricType}
                onChange={e => set('metricType', e.target.value as MetricType)}
                disabled={locked}
              >
                {METRICS.map(m => (
                  <option key={m.value} value={m.value}>{m.label} — {m.hint}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label">
                Semilla
                <span className="field-label-optional">opcional</span>
              </label>
              <input
                type="number"
                placeholder="-"
                value={params.seed}
                onChange={e => set('seed', e.target.value)}
                disabled={locked}
              />
            </div>
          </div>

          <RunBlock
            locked={locked}
            canRun={canRun}
            appState={appState}
            currentIteration={currentIteration}
            iterations={params.iterations}
            onRun={onRun}
          />
        </>
      )}
    </aside>
  );
}
