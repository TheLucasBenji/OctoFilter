import { useState, useRef, useCallback, useEffect } from 'react';
import {
  AppParams,
  AppState,
  OptimizationResult,
  ConvergencePoint,
  ConfigMode,
  ThemePreference,
} from './types';
import Sidebar from './components/Sidebar';
import ImageWorkspace from './components/ImageWorkspace';
import AnalysisSection from './components/AnalysisSection';

const API = 'http://localhost:8000';
const octopusLogo = new URL('./public/octopus.svg', import.meta.url).href;

const DEFAULT_PARAMS: AppParams = {
  filterType: 'bilateral',
  metricType: 'mse',
  noiseType: 'gaussian',
  noiseSigma: 25,
  noiseAmount: 0.05,
  population: 30,
  iterations: 50,
  seed: '',
};

const THEME_STORAGE_KEY = 'octopus-theme';

function getInitialTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'dark';

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  if (theme === 'dark') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M21 12.8A8.8 8.8 0 1 1 11.2 3 6.8 6.8 0 0 0 21 12.8Z" />
    </svg>
  );
}

export default function App() {
  const [params, setParams] = useState<AppParams>(DEFAULT_PARAMS);
  const [configMode, setConfigMode] = useState<ConfigMode>('basic');
  const [theme, setTheme] = useState<ThemePreference>(getInitialTheme);
  const [appState, setAppState] = useState<AppState>('idle');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [noisyImage, setNoisyImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [convergence, setConvergence] = useState<ConvergencePoint[]>([]);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<File | null>(null);
  const evsRef = useRef<EventSource | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const handleConfigModeChange = useCallback((mode: ConfigMode) => {
    if (appState === 'optimizing') return;
    setConfigMode(mode);
    if (mode === 'basic') {
      setParams(prev => ({
        ...prev,
        noiseType: DEFAULT_PARAMS.noiseType,
        noiseSigma: DEFAULT_PARAMS.noiseSigma,
        noiseAmount: DEFAULT_PARAMS.noiseAmount,
        population: DEFAULT_PARAMS.population,
        iterations: DEFAULT_PARAMS.iterations,
        seed: DEFAULT_PARAMS.seed,
      }));
    }
  }, [appState]);

  const previewNoise = useCallback(async (file: File, p: AppParams) => {
    const fd = new FormData();
    fd.append('image', file);
    fd.append('noise_type', p.noiseType);
    fd.append('noise_sigma', p.noiseSigma.toString());
    fd.append('noise_amount', p.noiseAmount.toString());
    if (p.seed) fd.append('seed', p.seed);
    try {
      const r = await fetch(`${API}/api/preview-noise`, { method: 'POST', body: fd });
      const d = await r.json();
      setOriginalImage(d.original_image);
      setNoisyImage(d.noisy_image);
    } catch { /* ignore */ }
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    fileRef.current = file;
    setAppState('previewing');
    setResult(null);
    setResultImage(null);
    setConvergence([]);
    setError(null);
    await previewNoise(file, params);
  }, [params, previewNoise]);

  useEffect(() => {
    if (!fileRef.current || appState === 'optimizing') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => previewNoise(fileRef.current!, params), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [params.noiseType, params.noiseSigma, params.noiseAmount, params.seed, appState, previewNoise]);

  const handleRun = useCallback(async () => {
    if (!fileRef.current) return;
    evsRef.current?.close();

    setAppState('optimizing');
    setConvergence([]);
    setCurrentIteration(0);
    setResult(null);
    setResultImage(null);
    setError(null);

    const fd = new FormData();
    fd.append('image', fileRef.current);
    fd.append('filter_type', params.filterType);
    fd.append('metric', params.metricType);
    fd.append('noise_type', params.noiseType);
    fd.append('noise_sigma', params.noiseSigma.toString());
    fd.append('noise_amount', params.noiseAmount.toString());
    fd.append('population', params.population.toString());
    fd.append('iterations', params.iterations.toString());
    if (params.seed) fd.append('seed', params.seed);

    let jobId: string;
    try {
      const r = await fetch(`${API}/api/optimize`, { method: 'POST', body: fd });
      const d = await r.json();
      jobId = d.job_id;
      setOriginalImage(d.original_image);
      setNoisyImage(d.noisy_image);
    } catch (e) {
      setError(String(e));
      setAppState('error');
      return;
    }

    const evs = new EventSource(`${API}/api/optimize/${jobId}/stream`);
    evsRef.current = evs;

    evs.onmessage = (e) => {
      const ev = JSON.parse(e.data);
      if (ev.type === 'progress') {
        setCurrentIteration(ev.iteration);
        setConvergence(prev => [...prev, { iteration: ev.iteration, cost: ev.cost }]);
      } else if (ev.type === 'complete') {
        setResultImage(ev.result_image);
        setResult(ev as OptimizationResult);
        setConvergence(ev.convergence.map((c: number, i: number) => ({ iteration: i + 1, cost: c })));
        setAppState('complete');
        evs.close();
      } else if (ev.type === 'error') {
        setError(ev.message);
        setAppState('error');
        evs.close();
      }
    };

    evs.onerror = () => {
      if (appState !== 'complete') {
        setError('Backend connection lost.');
        setAppState('error');
      }
      evs.close();
    };
  }, [params, appState]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">
            <span
              className="brand-logo"
              style={{
                WebkitMaskImage: `url(${octopusLogo})`,
                maskImage: `url(${octopusLogo})`,
              }}
              aria-hidden="true"
            />
          </span>
          <span className="brand-name">OctoFilter</span>
          <span className="brand-sep" />
          <span className="brand-sub">OOA · Restauración de imágenes</span>
        </div>

        <div className="mode-tabs" role="tablist" aria-label="Modo de configuración">
          {(['basic', 'advanced'] as ConfigMode[]).map(mode => (
            <button
              key={mode}
              type="button"
              className="mode-tab"
              role="tab"
              aria-selected={configMode === mode}
              disabled={appState === 'optimizing'}
              onClick={() => handleConfigModeChange(mode)}
            >
              {mode === 'basic' ? 'Básico' : 'Avanzado'}
            </button>
          ))}
        </div>

        <div className="header-actions">
          <div className="header-status">
            {appState === 'idle' && 'esperando imagen'}
            {appState === 'previewing' && 'previsualización lista'}
            {appState === 'optimizing' && (
              <>
                <span className="dot dot-amber" />
                iter {currentIteration} / {params.iterations}
              </>
            )}
            {appState === 'complete' && (
              <>
                <span className="dot dot-green" />
                listo
              </>
            )}
            {appState === 'error' && (
              <>
                <span className="dot dot-red" />
                error
              </>
            )}
          </div>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Cambiar tema"
            title="Cambiar tema"
          >
            <ThemeIcon theme={theme} />
          </button>
        </div>
      </header>

      <div className="app-body">
        <Sidebar
          params={params}
          onChange={setParams}
          onRun={handleRun}
          canRun={!!originalImage && appState !== 'optimizing'}
          appState={appState}
          currentIteration={currentIteration}
          mode={configMode}
        />

        <main className="main">
          {error && <div className="err-banner">{error}</div>}

          <ImageWorkspace
            appState={appState}
            originalImage={originalImage}
            noisyImage={noisyImage}
            resultImage={resultImage}
            onFileUpload={handleFileUpload}
          />

          {(convergence.length > 0 || result) && (
            <AnalysisSection
              convergence={convergence}
              result={result}
              metricType={params.metricType}
              totalIterations={params.iterations}
            />
          )}
        </main>
      </div>
    </div>
  );
}
