import { useCallback, useEffect, useState } from 'react';
import { HistoryDetail, HistorySummary } from '../types';
import HistoryDetailView from './HistoryDetail';
import Modal from './Modal';

interface Props {
  apiBase: string;
  onLoadConfig: (detail: HistoryDetail) => void;
  onAuthExpired: () => void;
}

const FILTER_LABELS: Record<string, string> = {
  bilateral: 'Bilateral',
  anisotropic: 'Anisotropic Diffusion',
  nlmeans: 'Non-Local Means',
};

export default function HistoryView({ apiBase, onLoadConfig, onAuthExpired }: Props) {
  const [items, setItems] = useState<HistorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const r = await fetch(`${apiBase}/api/history/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (r.status === 401) {
        onAuthExpired();
        return;
      }
      if (r.ok || r.status === 204) {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleLoadConfigById = async (id: number) => {
    const r = await fetch(`${apiBase}/api/history/${id}`, { credentials: 'include' });
    if (r.status === 401) {
      onAuthExpired();
      return;
    }
    if (r.ok) {
      const detail = (await r.json()) as HistoryDetail;
      onLoadConfig(detail);
    }
  };

  return (
    <div className="history-view">
      <div className="history-view-header">
        <span className="history-view-title">Historial de optimizaciones</span>
        <span className="history-view-count">
          {items.length} entrada{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ?
        <div className="history-empty">Cargando...</div>
      : items.length === 0 ?
        <div className="history-empty">
          No hay optimizaciones registradas. Ejecuta una optimización para verla aquí.
        </div>
      : <table className="history-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Filtro</th>
              <th>Métrica</th>
              <th>Mejor costo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="history-row">
                <td className="history-date">{new Date(item.created_at).toLocaleString('es-CL')}</td>
                <td className="history-filter">{FILTER_LABELS[item.filter_type] ?? item.filter_type}</td>
                <td className="history-metric">{item.metric_type.toUpperCase()}</td>
                <td className="history-cost">{item.best_cost.toFixed(4)}</td>
                <td className="history-actions">
                  <button className="hist-btn hist-btn-view" onClick={() => setSelectedId(item.id)}>
                    Ver
                  </button>
                  <button className="hist-btn hist-btn-load" onClick={() => handleLoadConfigById(item.id)}>
                    Cargar config
                  </button>
                  <button
                    className="hist-btn hist-btn-del"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}>
                    {deletingId === item.id ? '...' : 'Eliminar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }

      {selectedId !== null && (
        <Modal onClose={() => setSelectedId(null)}>
          <HistoryDetailView
            id={selectedId}
            apiBase={apiBase}
            onClose={() => setSelectedId(null)}
            onLoadConfig={onLoadConfig}
            onAuthExpired={onAuthExpired}
          />
        </Modal>
      )}
    </div>
  );
}
