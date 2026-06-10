import { useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onExport: () => Promise<void> | void;
  label?: string;
  loadingLabel?: string;
  icon?: ReactNode;
  iconOnly?: boolean;
  onError?: (error: unknown) => void;
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export default function PdfExportButton({
  onExport,
  label = 'Exportar PDF',
  loadingLabel = 'Generando PDF...',
  icon,
  iconOnly = false,
  className,
  disabled,
  onError,
  type = 'button',
  ...props
}: Props) {
  const [exporting, setExporting] = useState(false);

  const handleClick = async () => {
    if (exporting || disabled) return;

    setExporting(true);
    try {
      await waitForPaint();
      await onExport();
    } catch (error) {
      if (onError) {
        onError(error);
      } else {
        console.error('No se pudo exportar el PDF.', error);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      {...props}
      type={type}
      className={`pdf-export-btn${iconOnly ? ' pdf-export-btn--icon' : ''}${className ? ` ${className}` : ''}`}
      onClick={() => { void handleClick(); }}
      disabled={disabled || exporting}
      aria-busy={exporting}
      aria-label={iconOnly ? (exporting ? loadingLabel : label) : undefined}
      title={iconOnly ? label : undefined}
    >
      {icon && <span className="pdf-export-btn-icon" aria-hidden="true">{icon}</span>}
      {!iconOnly && (
        <span className="pdf-export-btn-label">
          {exporting ? loadingLabel : label}
        </span>
      )}
      {exporting && <span className="pdf-export-btn-progress" aria-hidden="true" />}
    </button>
  );
}
