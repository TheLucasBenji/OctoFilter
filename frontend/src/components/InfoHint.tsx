import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaCircleInfo } from 'react-icons/fa6';

interface InfoHintProps {
  label?: ReactNode;
  description: string;
  icon?: boolean;
  className?: string;
  align?: 'left' | 'right';
  ariaLabel?: string;
}

export default function InfoHint({
  label,
  description,
  icon = true,
  className = '',
  align = 'left',
  ariaLabel,
}: InfoHintProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const open = hovered || focused;
  const labelText = typeof label === 'string' ? label : 'Información';
  const classes = [
    'info-hint',
    icon ? 'info-hint-with-icon' : 'info-hint-text',
    align === 'right' ? 'info-hint-right' : '',
    className,
  ].filter(Boolean).join(' ');

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const margin = 12;
    const gap = 8;
    const maxWidth = Math.max(180, Math.min(280, window.innerWidth - margin * 2));
    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const width = Math.min(tooltipRect.width || maxWidth, maxWidth);
    const height = tooltipRect.height;

    let left = align === 'right' ? triggerRect.right - width : triggerRect.left;
    left = Math.min(Math.max(left, margin), window.innerWidth - width - margin);

    let top = triggerRect.bottom + gap;
    if (top + height > window.innerHeight - margin) {
      top = triggerRect.top - height - gap;
    }
    top = Math.max(top, margin);

    setTooltipStyle({
      left,
      top,
      maxWidth,
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <span
      ref={triggerRef}
      className={classes}
      tabIndex={0}
      aria-label={ariaLabel ?? `${labelText}: ${description}`}
      aria-describedby={open ? tooltipId : undefined}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={() => {
        triggerRef.current?.focus();
        setFocused(true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setHovered(false);
          setFocused(false);
          triggerRef.current?.blur();
        }
      }}
    >
      {label && <span className="info-hint-label-text">{label}</span>}
      {icon && <FaCircleInfo className="info-hint-symbol" aria-hidden="true" />}
      {open && createPortal(
        <span
          ref={tooltipRef}
          id={tooltipId}
          className="info-tooltip"
          role="tooltip"
          style={tooltipStyle}
        >
          {description}
        </span>,
        document.body,
      )}
    </span>
  );
}
