import { useCallback, useEffect, useState } from 'react';
import { HistoryDetail, HistoryEntryType, HistorySummary } from '../types';
import HistoryDetailView from './HistoryDetail';
import Modal from './Modal';
import PdfExportButton from './PdfExportButton';
import { FILTER_LABELS, exportReportPdf, historyDetailToReport } from '../utils/pdfReport';

const ALGORITHM_ABBR: Record<string, string> = { ooa: 'OOA', sfoa: 'SFOA', ao: 'AO', aquila: 'AO' };

interface Props {
  apiBase: string;
  onLoadConfig: (detail: HistoryDetail) => void;
  onAuthExpired: () => void;
  onBack: () => void;
}

export default function HistoryView({ apiBase, onLoadConfig, onAuthExpired, onBack }: Props) {
  const [items, setItems] = useState<HistorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<{ entryType: HistoryEntryType; id: number } | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/history`, { credentials: 'include' });
      if (r.status === 401) {
        onAuthExpired();
        return;
      }
      if (r.ok) setItems(await r.json());
    } finally {
      setLoading(false);
    }
  }, [apiBase, onAuthExpired]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDelete = async (item: HistorySummary) => {
    setDeletingKey(item.history_key);
    try {
      const r = await fetch(`${apiBase}/api/history/${item.entry_type}/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (r.status === 401) {
        onAuthExpired();
        return;
      }
      if (r.ok || r.status === 204) {
        setItems((prev) => prev.filter((i) => i.history_key !== item.history_key));
      }
    } finally {
      setDeletingKey(null);
    }
  };

  const handleLoadConfigByItem = async (item: HistorySummary) => {
    const r = await fetch(`${apiBase}/api/history/${item.entry_type}/${item.id}`, { credentials: 'include' });
    if (r.status === 401) {
      onAuthExpired();
      return;
    }
    if (r.ok) {
      const detail = (await r.json()) as HistoryDetail;
      onLoadConfig(detail);
    }
  };

  const handleExportPdf = async (item: HistorySummary) => {
    if (item.entry_type !== 'optimization') return;
    const r = await fetch(`${apiBase}/api/history/${item.entry_type}/${item.id}`, { credentials: 'include' });
    if (r.status === 401) { onAuthExpired(); return; }
    if (r.ok) {
      const detail = (await r.json()) as HistoryDetail;
      if (detail.entry_type === 'optimization') {
        await exportReportPdf(historyDetailToReport(detail));
      }
    }
  };

  return (
    <div className="history-view">
      <div className="history-view-header">
        <button className="history-back-btn" onClick={onBack} title="Volver al inicio">←</button>
        <span className="history-view-title">Historial</span>
        <span className="history-view-count">
          {items.length} entrada{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ?
        <div className="history-empty">Cargando...</div>
      : items.length === 0 ?
        <div className="history-empty">
          No hay entradas registradas. Ejecuta una optimización o aplica un filtro experimental.
        </div>
      : <table className="history-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Modo</th>
              <th>Filtro</th>
              <th>Métrica</th>
              <th>Mejor costo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.history_key} className="history-row">
                <td className="history-date">{new Date(item.created_at).toLocaleString('es-CL')}</td>
                <td className="history-kind">
                  {item.entry_type === 'optimization'
                    ? (ALGORITHM_ABBR[item.algorithm ?? 'ooa'] ?? (item.algorithm ?? 'ooa').toUpperCase())
                    : 'Manual'}
                </td>
                <td className="history-mode">
                  {item.source_mode === 'experimental' ? 'Experimental' : item.source_mode === 'basic' ? 'Básico' : 'Avanzado'}
                </td>
                <td className="history-filter">{FILTER_LABELS[item.filter_type] ?? item.filter_type}</td>
                <td className="history-metric">{item.metric_type ? item.metric_type.toUpperCase() : 'No aplica'}</td>
                <td className="history-cost">{item.best_cost != null ? item.best_cost.toFixed(4) : 'No aplica'}</td>
                <td className="history-actions">
                  <button
                    className="hist-btn hist-btn-view"
                    onClick={() => setSelectedEntry({ entryType: item.entry_type, id: item.id })}>
                    Ver
                  </button>
                  <button className="hist-btn hist-btn-load" onClick={() => handleLoadConfigByItem(item)}>
                    Cargar config
                  </button>
                  <span
                    className={`history-pdf-action${item.entry_type === 'experimental' ? ' history-pdf-action-disabled' : ''}`}
                    title={
                      item.entry_type === 'experimental'
                        ? 'El modo experimental no genera métricas ni convergencia para armar el PDF'
                        : undefined
                    }>
                    <PdfExportButton
                      className={`hist-btn hist-btn-pdf${item.entry_type === 'experimental' ? ' hist-btn-pdf-disabled' : ''}`}
                      onExport={() => handleExportPdf(item)}
                      disabled={item.entry_type === 'experimental'}
                      title={item.entry_type === 'optimization' ? 'Exportar PDF' : undefined}
                    />
                  </span>
                  <button
                    className="hist-btn hist-btn-del"
                    onClick={() => handleDelete(item)}
                    disabled={deletingKey === item.history_key}>
                    {deletingKey === item.history_key ? '...' : 'Eliminar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }

      {selectedEntry !== null && (
        <Modal onClose={() => setSelectedEntry(null)}>
          <HistoryDetailView
            id={selectedEntry.id}
            entryType={selectedEntry.entryType}
            apiBase={apiBase}
            onClose={() => setSelectedEntry(null)}
            onLoadConfig={onLoadConfig}
            onAuthExpired={onAuthExpired}
          />
        </Modal>
      )}
    </div>
  );
}
