import { useState, useRef, useCallback, useEffect } from 'react';
import { FiLogOut } from 'react-icons/fi';
import { AiTwotoneExperiment } from 'react-icons/ai';
import {
  AlgorithmType,
  AuthUser,
  AppParams,
  AppState,
  AppView,
  OptimizationResult,
  ConvergencePoint,
  ConfigMode,
  ExperimentalConfig,
  ThemePreference,
  HistoryDetail,
  RuntimeEstimate,
} from './types';
import Sidebar from './components/Sidebar';
import ImageWorkspace from './components/ImageWorkspace';
import AnalysisSection from './components/AnalysisSection';
import LoginScreen from './components/LoginScreen';
import HistoryView from './components/HistoryView';
import PdfExportButton from './components/PdfExportButton';
import ExperimentalView from './components/ExperimentalView';
import { exportReportPdf } from './utils/pdfReport';

const API = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
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
  algorithm: 'ooa',
};

function normalizeAlgorithm(value: string | null | undefined): AlgorithmType {
  if (value === 'aquila') return 'ao';
  if (value === 'sfoa' || value === 'ao') return value;
  return 'ooa';
}

const THEME_STORAGE_KEY = 'octopus-theme';
type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

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
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [view, setView] = useState<AppView>('workspace');
  const [params, setParams] = useState<AppParams>(DEFAULT_PARAMS);
  const [configMode, setConfigMode] = useState<ConfigMode>('basic');
  const [experimentalConfig, setExperimentalConfig] = useState<ExperimentalConfig | null>(null);
  const [theme, setTheme] = useState<ThemePreference>(getInitialTheme);
  const [appState, setAppState] = useState<AppState>('idle');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [noisyImage, setNoisyImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [convergence, setConvergence] = useState<ConvergencePoint[]>([]);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [estimate, setEstimate] = useState<RuntimeEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);

  const fileRef = useRef<File | null>(null);
  const evsRef = useRef<EventSource | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const estimateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const estimateAbortRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (appState !== 'optimizing') return;
    const id = setInterval(() => {
      if (startTimeRef.current != null) {
        setElapsedMs(Date.now() - startTimeRef.current);
      }
    }, 100);
    return () => clearInterval(id);
  }, [appState]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.algorithm = params.algorithm;
  }, [params.algorithm]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const clearWorkspace = useCallback(() => {
    fileRef.current = null;
    evsRef.current?.close();
    estimateAbortRef.current?.abort();
    cancelRequestedRef.current = false;
    setEstimate(null);
    setEstimating(false);
    setAppState('idle');
    setOriginalImage(null);
    setNoisyImage(null);
    setResultImage(null);
    setConvergence([]);
    setCurrentIteration(0);
    setResult(null);
    setError(null);
    setActiveJobId(null);
  }, []);

  const handleAuthExpired = useCallback(() => {
    clearWorkspace();
    setAuthUser(null);
    setAuthStatus('anonymous');
  }, [clearWorkspace]);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch(`${API}/api/auth/me`, {
          credentials: 'include',
        });
        if (cancelled) return;

        if (response.ok) {
          const data = (await response.json()) as { user: AuthUser };
          setAuthUser(data.user);
          setAuthStatus('authenticated');
        } else {
          setAuthUser(null);
          setAuthStatus('anonymous');
        }
      } catch {
        if (!cancelled) {
          setAuthUser(null);
          setAuthStatus('anonymous');
        }
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => evsRef.current?.close(), []);

  const handleAuthenticated = useCallback((user: AuthUser) => {
    setAuthUser(user);
    setAuthStatus('authenticated');
    setError(null);
  }, []);

  const handleConfigModeChange = useCallback(
    (mode: ConfigMode) => {
      if (appState === 'optimizing') return;
      setConfigMode(mode);
      if (mode === 'basic') {
        setParams((prev) => ({
          ...prev,
          noiseType: DEFAULT_PARAMS.noiseType,
          noiseSigma: DEFAULT_PARAMS.noiseSigma,
          noiseAmount: DEFAULT_PARAMS.noiseAmount,
          population: DEFAULT_PARAMS.population,
          iterations: DEFAULT_PARAMS.iterations,
          seed: DEFAULT_PARAMS.seed,
        }));
      }
    },
    [appState],
  );

  const previewNoise = useCallback(
    async (file: File, p: AppParams) => {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('noise_type', p.noiseType);
      fd.append('noise_sigma', p.noiseSigma.toString());
      fd.append('noise_amount', p.noiseAmount.toString());
      if (p.seed) fd.append('seed', p.seed);
      try {
        const r = await fetch(`${API}/api/preview-noise`, {
          method: 'POST',
          credentials: 'include',
          body: fd,
        });
        if (r.status === 401) {
          handleAuthExpired();
          return;
        }
        if (!r.ok) {
          throw new Error(`No se pudo previsualizar el ruido (${r.status}).`);
        }
        const d = await r.json();
        setOriginalImage(d.original_image);
        setNoisyImage(d.noisy_image);
      } catch {
        /* ignore */
      }
    },
    [handleAuthExpired],
  );

  const fetchEstimate = useCallback(
    async (file: File, p: AppParams) => {
      estimateAbortRef.current?.abort();
      const ctrl = new AbortController();
      estimateAbortRef.current = ctrl;
      setEstimating(true);

      const fd = new FormData();
      fd.append('image', file);
      fd.append('filter_type', p.filterType);
      fd.append('metric', p.metricType);
      fd.append('noise_type', p.noiseType);
      fd.append('noise_sigma', p.noiseSigma.toString());
      fd.append('noise_amount', p.noiseAmount.toString());
      fd.append('population', p.population.toString());
      fd.append('iterations', p.iterations.toString());
      if (p.seed) fd.append('seed', p.seed);
      fd.append('algorithm', p.algorithm);

      try {
        const r = await fetch(`${API}/api/estimate`, {
          method: 'POST',
          credentials: 'include',
          body: fd,
          signal: ctrl.signal,
        });
        if (r.status === 401) {
          handleAuthExpired();
          return;
        }
        if (!r.ok) throw new Error(`estimate ${r.status}`);
        const d = (await r.json()) as RuntimeEstimate;
        if (!ctrl.signal.aborted) setEstimate(d);
      } catch {
        if (!ctrl.signal.aborted) setEstimate(null);
      } finally {
        if (!ctrl.signal.aborted) setEstimating(false);
      }
    },
    [handleAuthExpired],
  );

  useEffect(() => {
    if (!fileRef.current || appState === 'optimizing') return;
    if (estimateDebounceRef.current) clearTimeout(estimateDebounceRef.current);
    estimateDebounceRef.current = setTimeout(() => fetchEstimate(fileRef.current!, params), 600);
    return () => {
      if (estimateDebounceRef.current) clearTimeout(estimateDebounceRef.current);
    };
  }, [
    params.filterType,
    params.metricType,
    params.noiseType,
    params.noiseSigma,
    params.noiseAmount,
    params.population,
    params.iterations,
    params.seed,
    params.algorithm,
    originalImage,
    appState,
    fetchEstimate,
  ]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      fileRef.current = file;
      setAppState('previewing');
      setResult(null);
      setResultImage(null);
      setConvergence([]);
      setError(null);
      await previewNoise(file, params);
    },
    [params, previewNoise],
  );

  useEffect(() => {
    if (!fileRef.current || appState === 'optimizing') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => previewNoise(fileRef.current!, params), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [params.noiseType, params.noiseSigma, params.noiseAmount, params.seed, appState, previewNoise]);

  const handleRun = useCallback(async () => {
    if (!fileRef.current) return;
    evsRef.current?.close();
    cancelRequestedRef.current = false;

    startTimeRef.current = Date.now();
    setElapsedMs(0);
    setAppState('optimizing');
    setActiveJobId(null);
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
    fd.append('algorithm', params.algorithm);
    fd.append('config_mode', configMode);

    let jobId: string;
    try {
      const r = await fetch(`${API}/api/optimize`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (r.status === 401) {
        handleAuthExpired();
        return;
      }
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.detail ?? `No se pudo iniciar la optimización (${r.status}).`);
      }
      const d = await r.json();
      jobId = d.job_id;
      setActiveJobId(jobId);
      setOriginalImage(d.original_image);
      setNoisyImage(d.noisy_image);
    } catch (e) {
      setError(String(e));
      setAppState('error');
      return;
    }

    const evs = new EventSource(`${API}/api/optimize/${jobId}/stream`, {
      withCredentials: true,
    });
    evsRef.current = evs;

    evs.onmessage = (e) => {
      let ev;
      try {
        ev = JSON.parse(e.data);
      } catch {
        console.warn('SSE: frame no-JSON ignorado', e.data);
        return;
      }
      if (ev.type === 'progress') {
        setCurrentIteration(ev.iteration);
        setConvergence((prev) => [...prev, { iteration: ev.iteration, cost: ev.cost }]);
      } else if (ev.type === 'complete') {
        setResultImage(ev.result_image);
        setResult(ev as OptimizationResult);
        setConvergence(ev.convergence.map((c: number, i: number) => ({ iteration: i + 1, cost: c })));
        if (typeof ev.duration_ms === 'number') setElapsedMs(ev.duration_ms);
        startTimeRef.current = null;
        setAppState('complete');
        setActiveJobId(null);
        cancelRequestedRef.current = false;
        evs.close();
      } else if (ev.type === 'error') {
        setError(ev.message);
        setAppState('error');
        setActiveJobId(null);
        cancelRequestedRef.current = false;
        evs.close();
      } else if (ev.type === 'cancelled') {
        setAppState(fileRef.current ? 'previewing' : 'idle');
        setCurrentIteration(0);
        setConvergence([]);
        setResult(null);
        setResultImage(null);
        setError(null);
        setActiveJobId(null);
        cancelRequestedRef.current = false;
        evs.close();
      }
    };

    evs.onerror = () => {
      if (cancelRequestedRef.current) {
        setAppState(fileRef.current ? 'previewing' : 'idle');
        setActiveJobId(null);
        cancelRequestedRef.current = false;
      } else {
        setError('Backend connection lost.');
        setAppState('error');
        setActiveJobId(null);
      }
      evs.close();
    };
  }, [configMode, handleAuthExpired, params]);

  const handleCancel = useCallback(async () => {
    if (!activeJobId || appState !== 'optimizing') return;

    cancelRequestedRef.current = true;
    try {
      const response = await fetch(`${API}/api/optimize/${activeJobId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.status === 401) {
        handleAuthExpired();
        return;
      }
      if (!response.ok) {
        throw new Error(`No se pudo cancelar la optimización (${response.status}).`);
      }
    } catch (e) {
      cancelRequestedRef.current = false;
      evsRef.current?.close();
      setActiveJobId(null);
      setError(e instanceof Error ? e.message : String(e));
      setAppState('error');
    }
  }, [activeJobId, appState, handleAuthExpired]);

  const handleLogout = useCallback(async () => {
    const jobToCancel = activeJobId && appState === 'optimizing' ? activeJobId : null;

    if (jobToCancel) {
      cancelRequestedRef.current = true;
      try {
        await fetch(`${API}/api/optimize/${jobToCancel}/cancel`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        /* ignore logout cancellation failures */
      }
    }

    evsRef.current?.close();

    try {
      await fetch(`${API}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      clearWorkspace();
      setAuthUser(null);
      setAuthStatus('anonymous');
    }
  }, [activeJobId, appState, clearWorkspace]);

  const handleLoadConfig = useCallback((detail: HistoryDetail) => {
    if (detail.entry_type === 'experimental') {
      setExperimentalConfig({
        filterType: detail.filter_type,
        params: detail.params,
      });
      setView('experimental');
      return;
    }

    setParams({
      filterType: detail.filter_type,
      metricType: detail.metric_type,
      noiseType: detail.noise_type,
      noiseSigma: detail.noise_sigma,
      noiseAmount: detail.noise_amount,
      population: detail.population,
      iterations: detail.iterations,
      seed: detail.seed !== null ? String(detail.seed) : '',
      algorithm: normalizeAlgorithm(detail.algorithm),
    });
    setConfigMode(detail.source_mode === 'basic' ? 'basic' : 'advanced');
    setView('workspace');
  }, []);

  const handleExperimentalConfigApplied = useCallback(() => {
    setExperimentalConfig(null);
  }, []);

  if (authStatus === 'checking') {
    return (
      <div className="auth-loading">
        <span
          className="auth-loading-logo"
          style={{
            WebkitMaskImage: `url(${octopusLogo})`,
            maskImage: `url(${octopusLogo})`,
          }}
          aria-hidden="true"
        />
        <span>Comprobando sesión</span>
      </div>
    );
  }

  if (authStatus === 'anonymous' || !authUser) {
    return (
      <LoginScreen
        apiBase={API}
        logoUrl={octopusLogo}
        theme={theme}
        onThemeToggle={toggleTheme}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

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
          <span className="brand-sub">Optimizador de Parámetros de Filtros de Imagen</span>
        </div>

        <div className="mode-controls">
          <div className="mode-tabs" role="tablist" aria-label="Modo de configuración">
            {(['basic', 'advanced'] as ConfigMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className="mode-tab"
                role="tab"
                aria-selected={view !== 'experimental' && configMode === mode}
                disabled={appState === 'optimizing'}
                onClick={() => {
                  handleConfigModeChange(mode);
                  setView('workspace');
                }}>
                {mode === 'basic' ? 'Básico' : 'Avanzado'}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`exp-toggle-btn${view === 'experimental' ? ' active' : ''}`}
            onClick={() => setView((v) => (v === 'experimental' ? 'workspace' : 'experimental'))}
            disabled={appState === 'optimizing'}
            aria-pressed={view === 'experimental'}
            aria-label="Modo experimental"
            title="Modo experimental">
            <AiTwotoneExperiment aria-hidden="true" />
          </button>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className={`history-inline-btn${view === 'history' ? ' active' : ''}`}
            onClick={() => setView((v) => (v === 'history' ? 'workspace' : 'history'))}
            disabled={appState === 'optimizing'}
            aria-pressed={view === 'history'}
            title="Historial de optimizaciones">
            {view === 'history' && <span className="history-close">✕</span>}
            <svg
              viewBox="0 0 24 24"
              className="history-icon"
              aria-hidden="true"
              focusable="false"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">
              <path d="M12 8v4l3 3" />
              <path d="M3.05 11a9 9 0 1 1 .5 4" />
              <polyline points="3 7 3 11 7 11" />
            </svg>
            <span className="history-label">Historial</span>
          </button>

          <span className="user-pill" title={authUser.email}>
            {authUser.email}
          </span>
          <button
            type="button"
            className="logout-btn"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión">
            <FiLogOut aria-hidden="true" />
          </button>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Cambiar tema"
            title="Cambiar tema">
            <ThemeIcon theme={theme} />
          </button>
        </div>
      </header>

      <div className="app-body">
        {view === 'experimental' ?
          <ExperimentalView
            apiBase={API}
            initialConfig={experimentalConfig}
            onInitialConfigApplied={handleExperimentalConfigApplied}
            onAuthExpired={handleAuthExpired}
          />
        : <>
            <Sidebar
              params={params}
              onChange={setParams}
              onRun={handleRun}
              onCancel={handleCancel}
              canRun={!!originalImage && appState !== 'optimizing'}
              appState={appState}
              currentIteration={currentIteration}
              elapsedMs={elapsedMs}
              mode={configMode}
              estimate={estimate}
              estimating={estimating}
            />

            <main className="main">
              {view === 'history' ?
                <HistoryView
                  apiBase={API}
                  onLoadConfig={handleLoadConfig}
                  onAuthExpired={handleAuthExpired}
                  onBack={() => setView('workspace')}
                />
              : <>
                  {error && <div className="err-banner">{error}</div>}

                  <ImageWorkspace
                    appState={appState}
                    originalImage={originalImage}
                    noisyImage={noisyImage}
                    resultImage={resultImage}
                    onFileUpload={handleFileUpload}
                    onExportPdf={
                      result
                        ? () =>
                            exportReportPdf({
                              filterType: params.filterType,
                              metricType: params.metricType,
                              noiseType: params.noiseType,
                              noiseSigma: params.noiseSigma,
                              noiseAmount: params.noiseAmount,
                              population: params.population,
                              iterations: params.iterations,
                              seed: params.seed,
                              params: result.params,
                              metrics: result.metrics,
                              convergence: result.convergence,
                              originalImage,
                              noisyImage,
                              resultImage,
                            })
                        : undefined
                    }
                  />

                  {(convergence.length > 0 || result) && (
                    <AnalysisSection
                      convergence={convergence}
                      result={result}
                      filterType={params.filterType}
                      metricType={params.metricType}
                      totalIterations={params.iterations}
                    />
                  )}
                </>
              }
            </main>
          </>
        }
      </div>
    </div>
  );
}
