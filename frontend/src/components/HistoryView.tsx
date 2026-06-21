import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { HistoryDetail, HistoryEntryType, HistorySummary } from '../types';
import HistoryDetailView from './HistoryDetail';
import Modal from './Modal';
import PdfExportButton from './PdfExportButton';
import { FILTER_LABELS, exportReportPdf, historyDetailToReport } from '../utils/pdfReport';

const ALGORITHM_ABBR: Record<string, string> = { ooa: 'OOA', sfoa: 'SFOA', ao: 'AO', aquila: 'AO' };
const DEFAULT_HISTORY_PAGE_SIZE = 50;
const HISTORY_PAGE_SIZE_OPTIONS = [25, 50, 100];
const MAX_VISIBLE_PAGES = 5;

function getVisiblePageNumbers(currentPage: number, totalPages: number) {
  const count = Math.min(totalPages, MAX_VISIBLE_PAGES);
  const start = Math.min(Math.max(0, currentPage - Math.floor(count / 2)), Math.max(0, totalPages - count));
  return Array.from({ length: count }, (_, index) => start + index);
}

interface Props {
  apiBase: string;
  onLoadConfig: (detail: HistoryDetail) => void;
  onAuthExpired: () => void;
  onBack: () => void;
}

export default function HistoryView({ apiBase, onLoadConfig, onAuthExpired, onBack }: Props) {
  const [items, setItems] = useState<HistorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_HISTORY_PAGE_SIZE);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<{ entryType: HistoryEntryType; id: number } | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const visiblePageNumbers = getVisiblePageNumbers(page, totalPages);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const offset = page * pageSize;
      const [historyResponse, countResponse] = await Promise.all([
        fetch(`${apiBase}/api/history?limit=${pageSize}&offset=${offset}`, { credentials: 'include' }),
        fetch(`${apiBase}/api/history/count`, { credentials: 'include' }),
      ]);
      if (historyResponse.status === 401 || countResponse.status === 401) {
        onAuthExpired();
        return;
      }
      if (countResponse.ok) {
        const data = (await countResponse.json()) as { total: number };
        const nextTotal = data.total;
        const nextTotalPages = Math.max(1, Math.ceil(nextTotal / pageSize));
        setTotalItems(nextTotal);
        if (page > nextTotalPages - 1) {
          setPage(nextTotalPages - 1);
          return;
        }
      }
      if (historyResponse.ok) {
        setItems((await historyResponse.json()) as HistorySummary[]);
      }
    } finally {
      setLoading(false);
    }
  }, [apiBase, onAuthExpired, page, pageSize]);

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
        if (items.length === 1 && page > 0) {
          setPage((current) => Math.max(0, current - 1));
        } else {
          await loadHistory();
        }
      }
    } finally {
      setDeletingKey(null);
    }
  };

  const handlePageSizeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(event.target.value));
    setPage(0);
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

      {!loading && items.length > 0 && (
        <nav className="history-pagination" aria-label="Paginación del historial">
          <div className="history-pagination-total">
            Total entradas: <strong>{totalItems}</strong>
          </div>
          <div className="history-page-list">
            <button
              className="history-page-step"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
              title="Página anterior"
              aria-label="Página anterior">
              <FiChevronLeft aria-hidden="true" />
            </button>
            {visiblePageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                className={`history-page-number${pageNumber === page ? ' active' : ''}`}
                onClick={() => setPage(pageNumber)}
                aria-current={pageNumber === page ? 'page' : undefined}>
                {pageNumber + 1}
              </button>
            ))}
            <button
              className="history-page-step"
              onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              disabled={page >= totalPages - 1}
              title="Página siguiente"
              aria-label="Página siguiente">
              <FiChevronRight aria-hidden="true" />
            </button>
          </div>
          <label className="history-page-size">
            <span>Por página:</span>
            <select value={pageSize} onChange={handlePageSizeChange}>
              {HISTORY_PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </nav>
      )}

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
