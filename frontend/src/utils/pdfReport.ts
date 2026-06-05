import { jsPDF } from 'jspdf';
import { FilterType, HistoryDetail, MetricType, NoiseType, ResultMetrics } from '../types';
import { getParamDisplayInfo } from '../paramMetadata';

export const FILTER_LABELS: Record<FilterType, string> = {
  bilateral: 'Bilateral',
  anisotropic: 'Anisotropic Diffusion',
  nlmeans: 'Non-Local Means',
};

const METRIC_AXIS: Record<MetricType, string> = {
  mse: 'MSE',
  snr: 'SNR (dB)',
  piqe: 'PIQE',
};

const NOISE_LABELS: Record<NoiseType, string> = {
  gaussian: 'Gaussiano',
  sp: 'Sal y pimienta',
};

export interface ReportData {
  filterType: FilterType;
  metricType: MetricType;
  createdAt?: string;
  durationMs?: number | null;
  noiseType: NoiseType;
  noiseSigma: number;
  noiseAmount: number;
  population: number;
  iterations: number;
  seed: number | string | null;
  params: Record<string, number>;
  metrics: ResultMetrics;
  convergence: number[];
  originalImage: string | null;
  noisyImage: string | null;
  resultImage: string | null;
}

export function historyDetailToReport(d: HistoryDetail): ReportData {
  return {
    filterType: d.filter_type,
    metricType: d.metric_type,
    createdAt: d.created_at,
    durationMs: d.duration_ms,
    noiseType: d.noise_type,
    noiseSigma: d.noise_sigma,
    noiseAmount: d.noise_amount,
    population: d.population,
    iterations: d.iterations,
    seed: d.seed,
    params: d.params,
    metrics: d.metrics,
    convergence: d.convergence,
    originalImage: d.original_image,
    noisyImage: d.noisy_image,
    resultImage: d.result_image,
  };
}

type RGB = [number, number, number];

const ACCENT: RGB = [91, 61, 245];
const T1: RGB    = [14, 17, 22];
const T2: RGB    = [79, 89, 104];
const T3: RGB    = [140, 149, 163];
const GREEN: RGB = [36, 140, 98];
const RED: RGB   = [200, 50, 75];
const LINE: RGB  = [210, 213, 220];

const PDF_WORKSPACE_IMAGE_MAX_H = 320 * 72 / 96;
const IMAGE_ROW_GAP = 16;

function imageDataUri(base64: string): string {
  return `data:image/png;base64,${base64}`;
}

function getPdfParamLabel(filterType: FilterType, name: string): string {
  const info = getParamDisplayInfo(filterType, name);
  const labels: Record<string, string> = {
    d: 'Neighborhood diameter (d)',
    sigmaColor: 'Range sigma (sigmaColor)',
    sigmaSpace: 'Spatial sigma (sigmaSpace)',
    niter: 'Diffusion iterations (niter)',
    kappa: 'Gradient threshold (kappa)',
    gamma: 'Diffusion rate / time step (gamma)',
    option: 'Conduction function g(|grad I|)',
    h: 'Filtering strength (h)',
    templateWindowSize: 'Patch size (templateWindowSize)',
    searchWindowSize: 'Search window size (searchWindowSize)',
  };

  return labels[info.key] ?? info.commonName ?? name;
}

export async function exportReportPdf(report: ReportData): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = 595.28;
  const PH = 841.89;
  const ML = 40;
  const MB = 40;
  const CW = PW - ML * 2;
  let y = 40;

  function txt(
    s: string, x: number, yy: number,
    size = 10, bold = false, color: RGB = T1,
    align: 'left' | 'right' | 'center' = 'left',
  ) {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(s, x, yy, { align });
  }

  function hline(yy: number) {
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.5);
    doc.line(ML, yy, ML + CW, yy);
  }

  function ensureSpace(height: number) {
    if (y + height <= PH - MB) return;
    doc.addPage();
    y = 40;
  }

  // ── 1. Header ──────────────────────────────────────────────────────────
  txt('OctoFilter — Informe de optimización', ML, y, 15, true, ACCENT);
  y += 10;

  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(ML, y, CW, 3, 'F');
  y += 14;

  const filterLabel = FILTER_LABELS[report.filterType] ?? report.filterType;
  const dateStr = report.createdAt
    ? new Date(report.createdAt).toLocaleString('es-CL')
    : new Date().toLocaleString('es-CL');
  let meta = `${filterLabel} · ${report.metricType.toUpperCase()} · ${dateStr}`;
  if (report.durationMs != null) meta += ` · ${(report.durationMs / 1000).toFixed(1)}s`;
  txt(meta, ML, y, 9, false, T2);
  y += 18;

  hline(y); y += 14;

  // ── 2. Config ──────────────────────────────────────────────────────────
  txt('CONFIGURACIÓN', ML, y, 8, false, T3);
  y += 11;

  const noiseLabel = NOISE_LABELS[report.noiseType] ?? report.noiseType;
  const seedStr = (report.seed != null && report.seed !== '') ? String(report.seed) : 'aleatorio';
  const cfg: [string, string][] = [
    ['Filtro',      filterLabel],
    ['Métrica',     report.metricType.toUpperCase()],
    ['Ruido',       report.noiseType === 'gaussian'
                      ? `${noiseLabel} (sigma=${report.noiseSigma})`
                      : `${noiseLabel} (amount=${report.noiseAmount})`],
    ['Población',   String(report.population)],
    ['Iteraciones', String(report.iterations)],
    ['Seed',        seedStr],
  ];
  const half = Math.ceil(cfg.length / 2);
  cfg.forEach(([label, val], i) => {
    const col  = i < half ? ML            : ML + CW / 2;
    const vcol = i < half ? ML + 100      : ML + CW / 2 + 100;
    const ry   = y + (i < half ? i : i - half) * 13;
    txt(label, col,  ry, 8, false, T3);
    txt(val,   vcol, ry, 8, false, T1);
  });
  y += half * 13 + 10;
  hline(y); y += 14;

  // ── 3. Images ──────────────────────────────────────────────────────────
  const imgs = ([
    { data: report.originalImage, label: 'Original'  },
    { data: report.noisyImage,    label: 'Ruidosa'   },
    { data: report.resultImage,   label: 'Resultado' },
  ] as { data: string | null; label: string }[]).filter(
    (im): im is { data: string; label: string } => im.data != null,
  );

  if (imgs.length > 0) {
    ensureSpace(180);
    txt('IMÁGENES', ML, y, 8, false, T3);
    y += 11;

    const imageItems = imgs.map((im) => {
      const dataUri = imageDataUri(im.data);
      const props = doc.getImageProperties(dataUri);
      return {
        ...im,
        dataUri,
        ratio: props.height / props.width,
      };
    });

    for (const im of imageItems) {
      let drawW = CW;
      let drawH = drawW * im.ratio;
      if (drawH > PDF_WORKSPACE_IMAGE_MAX_H) {
        drawH = PDF_WORKSPACE_IMAGE_MAX_H;
        drawW = drawH / im.ratio;
      }

      ensureSpace(drawH + 24);
      txt(im.label, ML + CW / 2, y, 8, false, T2, 'center');
      y += 8;

      const offsetX = ML + (CW - drawW) / 2;
      doc.addImage(im.dataUri, 'PNG', offsetX, y, drawW, drawH, undefined, 'NONE');
      y += drawH + IMAGE_ROW_GAP;
    }

    hline(y); y += 14;
  }

  // ── 4. Metrics before/after ────────────────────────────────────────────
  ensureSpace(110);
  txt('MÉTRICAS ANTES / DESPUÉS', ML, y, 8, false, T3);
  y += 11;

  const mc = [ML, ML + 90, ML + 210, ML + 330] as const;
  (['Métrica', 'Antes', 'Después', 'Mejora'] as const).forEach((h, i) => txt(h, mc[i], y, 8, true, T2));
  y += 4;
  hline(y); y += 9;

  const { metrics: m } = report;
  type Row = [string, number, number, boolean];
  const mrows: Row[] = [
    ['MSE',      m.noisy_mse, m.mse, false],
    ['SNR (dB)', m.noisy_snr, m.snr, true ],
  ];
  if (m.piqe != null && m.noisy_piqe != null) {
    mrows.push(['PIQE', m.noisy_piqe, m.piqe, false]);
  }
  mrows.forEach(([label, before, after, higherBetter]) => {
    const delta    = higherBetter ? after - before : before - after;
    const improved = delta > 0;
    const pct      = before !== 0 ? (Math.abs(delta / before) * 100).toFixed(1) : '-';
    const arrow    = improved ? '+ ' : '- ';
    const dColor   = improved ? GREEN : RED;
    txt(label,             mc[0], y, 9, false, T1);
    txt(before.toFixed(2), mc[1], y, 9, false, T2);
    txt(after.toFixed(2),  mc[2], y, 9, false, T1);
    txt(`${arrow}${pct}%`, mc[3], y, 9, false, dColor);
    y += 14;
  });
  txt(`Mejor costo (${m.metric_used.toUpperCase()}): ${m.best_cost.toFixed(4)}`, ML, y + 4, 8, false, T3);
  y += 16;
  hline(y); y += 14;

  // ── 5. Best params ─────────────────────────────────────────────────────
  ensureSpace(70);
  txt('MEJORES PARÁMETROS', ML, y, 8, false, T3);
  y += 11;
  const pe = Object.entries(report.params);

  pe.forEach(([k, v]) => {
    const label = getPdfParamLabel(report.filterType, k);
    const vs = Math.abs(v - Math.round(v)) < 0.005 ? String(Math.round(v)) : v.toFixed(3);

    ensureSpace(17);
    txt(`${label}: ${vs}`, ML, y, 9, false, T1);
    y += 14;
  });
  y += 8;
  hline(y); y += 14;

  // ── 6. Convergence chart ───────────────────────────────────────────────
  ensureSpace(160);
  txt('CONVERGENCIA', ML, y, 8, false, T3);
  y += 12;

  const CH = 110;

  if (report.convergence.length > 1) {
    const vals  = report.convergence.map(c => report.metricType === 'snr' ? -c : c);
    const minV  = Math.min(...vals);
    const maxV  = Math.max(...vals);
    const range = maxV - minV || 1;

    const pL = ML + 50;
    const pR = ML + CW - 4;
    const pT = y;
    const pB = y + CH - 14;
    const pW = pR - pL;
    const pH = pB - pT;

    // Y grid + ticks
    [0, 0.25, 0.5, 0.75, 1].forEach(t => {
      const ty = pB - t * pH;
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.setLineWidth(0.3);
      doc.line(pL, ty, pR, ty);
      txt((minV + t * range).toFixed(2), pL - 4, ty + 3, 6, false, T3, 'right');
    });

    // Axes
    doc.setDrawColor(T3[0], T3[1], T3[2]);
    doc.setLineWidth(0.7);
    doc.line(pL, pT, pL, pB);
    doc.line(pL, pB, pR, pB);

    // X ticks + labels
    const nT = Math.min(6, vals.length);
    for (let t = 0; t <= nT; t++) {
      const f  = t / nT;
      const tx = pL + f * pW;
      const ti = Math.round(f * (vals.length - 1)) + 1;
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.setLineWidth(0.3);
      doc.line(tx, pB, tx, pB + 4);
      txt(String(ti), tx, pB + 11, 6, false, T3, 'center');
    }

    // Axis labels
    txt(METRIC_AXIS[report.metricType], ML + 2, pT + pH / 2, 6, false, T3);
    txt('Iteración', pL + pW / 2, y + CH + 10, 6, false, T3, 'center');

    // Data line
    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setLineWidth(1.5);
    for (let i = 1; i < vals.length; i++) {
      const x1 = pL + (i - 1) / (vals.length - 1) * pW;
      const y1 = pB - (vals[i - 1] - minV) / range * pH;
      const x2 = pL + i / (vals.length - 1) * pW;
      const y2 = pB - (vals[i] - minV) / range * pH;
      doc.line(x1, y1, x2, y2);
    }
  } else {
    txt('Sin datos de convergencia', ML + CW / 2, y + CH / 2, 9, false, T3, 'center');
  }
  y += CH + 24;

  // ── Footer ─────────────────────────────────────────────────────────────
  ensureSpace(28);
  hline(y);
  txt('Generado por OctoFilter', ML, y + 11, 7, false, T3);
  txt(new Date().toLocaleString('es-CL'), ML + CW, y + 11, 7, false, T3, 'right');

  const tag = new Date().toISOString().slice(0, 10);
  doc.save(`octofilter_${report.filterType}_${tag}.pdf`);
}
