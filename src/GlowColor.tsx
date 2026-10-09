import { useEffect, useRef, useState } from 'react';
import { usePresence } from './usePresence';
import { useI18n } from './I18nProvider';

export function GlowColor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false), presence = usePresence(open), root = useRef<HTMLDivElement>(null);
  const rgb = value.slice(1).match(/../g)!.map(c => parseInt(c, 16));
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div className="glow-color-control" ref={root} onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); root.current?.querySelector('button')?.focus(); } }}>
    <button type="button" className="glow-color-trigger" aria-label={label} aria-expanded={open} onClick={() => setOpen(x => !x)}><span style={{ background: value }} /><strong>{value.toUpperCase()}</strong><small>RGB</small></button>
    {presence.rendered && <div className={`color-popover ${presence.leaving ? 'leaving' : ''}`} inert={presence.leaving} aria-hidden={presence.leaving} role="group" aria-label={label}>
      <div className="color-presets">{['#89d9c1', '#9c8cef', '#69d6ed', '#f497bf', '#f5d85a', '#f5b56b'].map(color => <button type="button" key={color} style={{ background: color }} aria-label={`${label} ${color}`} onClick={() => onChange(color)} />)}</div>
      {['Red', 'Green', 'Blue'].map((channel, i) => <label className="rgb-channel" key={channel}><span>{t(channel)}</span><input type="range" min="0" max="255" aria-label={`${label} · ${t(channel)}`} value={rgb[i]} onChange={e => { const next = [...rgb]; next[i] = Number(e.target.value); onChange('#' + next.map(c => c.toString(16).padStart(2, '0')).join('')); }} /><output>{rgb[i]}</output></label>)}
    </div>}
  </div>;
}
