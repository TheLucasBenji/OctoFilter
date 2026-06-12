import { useEffect, useState } from 'react';
import { ConvergencePoint, HistoryDetail, HistoryEntryType, OptimizationResult } from '../types';
import AnalysisSection from './AnalysisSection';
import ImageWorkspace from './ImageWorkspace';
import { FILTER_LABELS } from '../utils/pdfReport';

interface Props {
  id: number;
  entryType: HistoryEntryType;
  apiBase: string;
  onClose: () => void;
  onLoadConfig: (detail: HistoryDetail) => void;
  onAuthExpired: () => void;
}

function dataUri(image: string | null): string | null {
  return image ? `data:image/png;base64,${image}` : null;
}

function ExperimentalDetail({ detail }: { detail: Extract<HistoryDetail, { entry_type: 'experimental' }> }) {
  const inputSrc = dataUri(detail.input_image);
  const resultSrc = dataUri(detail.result_image);

  return (
    <div className="img-workspace history-experimental-images">
      <div className="img-pane">
        <div className="img-pane-header">
          <span className="pane-title">Entrada</span>
          <span className="pane-status">imagen manual</span>
        </div>
        {inputSrc ? (
          <div className="result-img">
            <img src={inputSrc} alt="entrada experimental" />
          </div>
        ) : (
          <div className="result-empty">
            <div className="result-empty-glyph">□</div>
            <div className="result-empty-text">Imagen no disponible</div>
          </div>
        )}
      </div>

      <div className="img-pane">
        <div className="img-pane-header">
          <span className="pane-title">Resultado</span>
          <span className="pane-status">
            <span className="dot dot-green" /> listo
          </span>
        </div>
        {resultSrc ? (
          <>
            <div className="result-img">
              <img src={resultSrc} alt="resultado experimental" />
            </div>
            <div className="dl-link">
              <a href={resultSrc} download="octopus_experimental.png">PNG</a>
            </div>
          </>
        ) : (
          <div className="result-empty">
            <div className="result-empty-glyph">□</div>
            <div className="result-empty-text">Resultado no disponible</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryDetailView({ id, entryType, apiBase, onClose, onLoadConfig, onAuthExpired }: Props) {
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(`${apiBase}/api/history/${entryType}/${id}`, { credentials: 'include' });
        if (cancelled) return;
        if (r.status === 401) { onAuthExpired(); return; }
        if (r.ok) setDetail(await r.json());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id, entryType, apiBase, onAuthExpired]);

  if (loading) {
    return <div className="history-empty">Cargando...</div>;
  }
  if (!detail) {
    return <div className="history-empty">No se encontró la entrada.</div>;
  }

  const isOptimization = detail.entry_type === 'optimization';
  const filterLabel = FILTER_LABELS[detail.filter_type] ?? detail.filter_type;
  const detailMeta = isOptimization
    ? `${filterLabel} · ${detail.metric_type.toUpperCase()} · ${new Date(detail.created_at).toLocaleString('es-CL')}`
    : `${filterLabel} · Experimental · ${new Date(detail.created_at).toLocaleString('es-CL')}`;

  const fakeResult: OptimizationResult | null = isOptimization ? {
    result_image: detail.result_image ?? '',
    convergence: detail.convergence,
    metrics: detail.metrics,
    params: detail.params,
    duration_ms: detail.duration_ms,
  } : null;
  const convergencePoints: ConvergencePoint[] = isOptimization ? detail.convergence.map((c, i) => ({
    iteration: i + 1,
    cost: c,
  })) : [];

  return (
    <div className="history-detail">
      <div className="history-detail-header">
        <button className="history-back-btn" onClick={onClose}>← Volver</button>
        <span className="history-detail-meta">
          {detailMeta}
          {detail.duration_ms != null && (
            <span className="history-duration"> · {(detail.duration_ms / 1000).toFixed(1)}s</span>
          )}
        </span>
        <button className="history-load-btn" onClick={() => onLoadConfig(detail)}>
          Cargar config
        </button>
      </div>

      {isOptimization ? (
        <>
          <ImageWorkspace
            appState="complete"
            originalImage={detail.original_image}
            noisyImage={detail.noisy_image}
            resultImage={detail.result_image}
            onFileUpload={() => {}}
            readOnly
          />

          <AnalysisSection
            convergence={convergencePoints}
            result={fakeResult}
            filterType={detail.filter_type}
            metricType={detail.metric_type}
            totalIterations={detail.iterations}
          />
        </>
      ) : (
        <ExperimentalDetail detail={detail} />
      )}
    </div>
  );
}
