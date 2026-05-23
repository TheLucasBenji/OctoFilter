import { useState, useRef, useCallback } from 'react';
import { AppState } from '../types';

interface Props {
  appState: AppState;
  originalImage: string | null;
  noisyImage: string | null;
  resultImage: string | null;
  onFileUpload: (file: File) => void;
}

function CompareSlider({ original, noisy }: { original: string; noisy: string }) {
  const [pct, setPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updatePct = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const next = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPct(next);
  }, []);

  return (
    <div
      ref={containerRef}
      className="compare-wrap"
      onMouseDown={e => { dragging.current = true; updatePct(e.clientX); }}
      onMouseMove={e => { if (dragging.current) updatePct(e.clientX); }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
    >
      {/* Base: noisy */}
      <img src={`data:image/png;base64,${noisy}`} alt="noisy" draggable={false} />

      {/* Overlay: original (clipped) */}
      <div
        className="compare-overlay"
        style={{ width: `${pct}%`, right: undefined }}
      >
        <img
          src={`data:image/png;base64,${original}`}
          alt="original"
          draggable={false}
          style={{
            width: containerRef.current
              ? `${containerRef.current.clientWidth}px`
              : '100%',
            maxHeight: 320,
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Handle */}
      <div className="compare-handle" style={{ left: `${pct}%` }}>
        <div className="compare-knob">⟺</div>
      </div>

      {/* Labels */}
      <div className="compare-labels">
        <span className="compare-tag">original</span>
        <span className="compare-tag">ruido</span>
      </div>
    </div>
  );
}

export default function ImageWorkspace({ appState, originalImage, noisyImage, resultImage, onFileUpload }: Props) {
  const [drag, setDrag] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f && f.type.startsWith('image/')) onFileUpload(f);
  };

  const hasImage = !!originalImage && !!noisyImage;

  return (
    <div className="img-workspace">
      {/* Input pane */}
      <div className="img-pane">
        <div className="img-pane-header">
          <span className="pane-title">Entrada</span>
          {hasImage && (
            <span className="pane-status">arrastra para comparar</span>
          )}
        </div>

        {!hasImage ? (
          <label
            className={`upload-zone${drag ? ' drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
          >
            <input type="file" accept="image/*" onChange={e => handleFiles(e.target.files)} />
            <div className="upload-ring">+</div>
            <div className="upload-label">Arrastra una imagen o haz clic</div>
            <div className="upload-hint">PNG · JPG</div>
          </label>
        ) : (
          <>
            <CompareSlider original={originalImage} noisy={noisyImage} />
            <div className="change-img">
              <label>
                <input type="file" accept="image/*" onChange={e => handleFiles(e.target.files)} />
                cambiar imagen
              </label>
            </div>
          </>
        )}
      </div>

      {/* Result pane */}
      <div className="img-pane">
        <div className="img-pane-header">
          <span className="pane-title">Resultado</span>
          <span className="pane-status">
            {appState === 'optimizing' && (
              <><div className="spinner" style={{ width: 10, height: 10 }} /> &nbsp;procesando</>
            )}
            {appState === 'complete' && (
              <><span className="dot dot-green" /> listo</>
            )}
          </span>
        </div>

        {resultImage ? (
          <>
            <div className="result-img">
              <img src={`data:image/png;base64,${resultImage}`} alt="result" />
            </div>
            <div className="dl-link">
              <a href={`data:image/png;base64,${resultImage}`} download="octopus_result.png">
                descargar PNG
              </a>
            </div>
          </>
        ) : (
          <div className="result-empty">
            <div className="result-empty-glyph">
              {appState === 'optimizing' ? '⚙' : '□'}
            </div>
            <div className="result-empty-text">
              {appState === 'idle' || appState === 'previewing'
                ? 'Configura y ejecuta la optimización'
                : appState === 'optimizing'
                  ? 'Optimizando...'
                  : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
