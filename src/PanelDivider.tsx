import { useRef, useState } from 'react';
import { useI18n } from './I18nProvider';
import { clampPanel, panelBounds } from './composer-options';

export function PanelDivider({ width, viewport, onChange }: { width: number; viewport: number; onChange: (width: number) => void }) {
  const { t } = useI18n();
  const drag = useRef<{ x: number; width: number; pointer: number } | null>(null);
  const [active, setActive] = useState(false);
  const { min, max } = panelBounds(viewport);
  return <div className={`panel-divider ${active ? 'dragging' : ''}`} role="separator" aria-label={t('Resize annotation panel')} aria-orientation="vertical" aria-valuemin={min} aria-valuemax={max} aria-valuenow={width} tabIndex={0} title={t('Drag to resize. Double-click to reset.')} onPointerDown={e => {
    if (e.button !== 0) return;
    e.preventDefault(); drag.current = { x: e.clientX, width, pointer: e.pointerId }; setActive(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }} onPointerMove={e => {
    if (!drag.current || drag.current.pointer !== e.pointerId) return;
    onChange(clampPanel(drag.current.width + drag.current.x - e.clientX, viewport));
  }} onPointerUp={e => { drag.current = null; setActive(false); if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }} onLostPointerCapture={() => {drag.current = null; setActive(false);}} onPointerCancel={() => {drag.current = null; setActive(false);}} onDoubleClick={() => onChange(clampPanel(370, viewport))} onKeyDown={e => {
    let next: number;
    if (e.key === 'ArrowLeft') next = width + (e.shiftKey ? 60 : 24);
    else if (e.key === 'ArrowRight') next = width - (e.shiftKey ? 60 : 24);
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else return;
    e.preventDefault(); onChange(clampPanel(next, viewport));
  }} />;
}
