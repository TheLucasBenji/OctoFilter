import React from 'react';
import './Modal.css';

interface Props {
  children: React.ReactNode;
  onClose: () => void;
}

export default function Modal({ children, onClose }: Props) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
      <button className="modal-close" aria-label="Cerrar" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
