import { useEffect, useState } from 'react';
import { ConvergencePoint, HistoryDetail, OptimizationResult } from '../types';
import AnalysisSection from './AnalysisSection';
import ImageWorkspace from './ImageWorkspace';
import PdfExportButton from './PdfExportButton';
import { exportReportPdf, historyDetailToReport } from '../utils/pdfReport';

interface Props {
  id: number;
  apiBase: string;
  onClose: () => void;
  onLoadConfig: (detail: HistoryDetail) => void;
  onAuthExpired: () => void;
}

export default function HistoryDetailView({ id, apiBase, onClose, onLoadConfig, onAuthExpired }: Props) {
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(`${apiBase}/api/history/${id}`, { credentials: 'include' });
        if (cancelled) return;
        if (r.status === 401) { onAuthExpired(); return; }
        if (r.ok) setDetail(await r.json());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id, apiBase, onAuthExpired]);

  if (loading) {
    return <div className="history-empty">Cargando...</div>;
  }
  if (!detail) {
    return <div className="history-empty">No se encontró la entrada.</div>;
  }

  const fakeResult: OptimizationResult = {
    result_image: detail.result_image ?? '',
    convergence: detail.convergence,
    metrics: detail.metrics,
    params: detail.params,
  };
  const convergencePoints: ConvergencePoint[] = detail.convergence.map((c, i) => ({
    iteration: i + 1,
    cost: c,
  }));

  return (
    <div className="history-detail">
      <div className="history-detail-header">
        <button className="history-back-btn" onClick={onClose}>← Volver</button>
        <span className="history-detail-meta">
          {detail.filter_type} · {detail.metric_type.toUpperCase()} ·{' '}
          {new Date(detail.created_at).toLocaleString('es-CL')}
          {detail.duration_ms != null && (
            <span className="history-duration"> · {(detail.duration_ms / 1000).toFixed(1)}s</span>
          )}
        </span>
        <button className="history-load-btn" onClick={() => onLoadConfig(detail)}>
          Cargar config
        </button>
        <PdfExportButton
          className="history-pdf-btn"
          onExport={() => exportReportPdf(historyDetailToReport(detail))}
        />
      </div>

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
    </div>
  );
}
