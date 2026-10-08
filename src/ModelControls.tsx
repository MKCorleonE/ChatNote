import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LoaderCircle, RefreshCw, Search, Settings2 } from 'lucide-react';
import { useI18n } from './I18nProvider';
import { activeProfile, usageUrl } from './connections';
import { supportedEfforts } from './composer-options';
import * as bridge from './bridge';
import type { ConnectionProfile, Model, ProfileStatus, ReasoningEffort, Settings } from './types';
import type { friendlyError } from './connections';

interface Props {
  settings: Settings; catalog: Model[]; status: ProfileStatus | null; loading: boolean;
  error: ReturnType<typeof friendlyError> | null; disabled: boolean;
  onProfile: (id: string) => void; onModel: (model: string) => void;
  onEffort: (effort: ReasoningEffort | undefined) => void; onRefresh: () => void;
  onSettings: () => void; onNotice: (text: string) => void;
}
export function ModelControls(props: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [custom, setCustom] = useState('');
  const root = useRef<HTMLDivElement>(null), search = useRef<HTMLInputElement>(null);
  const profile = activeProfile(props.settings)!;
  const options = supportedEfforts(profile.provider, profile.model, props.catalog);
  const chosen = options.includes(profile.reasoningEffort!) ? profile.reasoningEffort : '';
  const modelName = props.catalog.find(m => m.id === profile.model)?.name ?? profile.model;
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  useEffect(() => { setQuery(''); setCustom(''); }, [profile.id]);
  useEffect(() => { if (props.disabled) setOpen(false); }, [props.disabled]);
  function choose(id: string) { props.onModel(id); setOpen(false); setQuery(''); }
  const url = usageUrl(profile);
  const ready = profile.provider === 'chatgpt' ? props.status?.connected && props.status.planUsage : props.status?.hasKey && props.status.endpointMatches;
  return <div className="model-controls" ref={root}>
    <button type="button" className="model-picker-button" disabled={props.disabled} aria-label={t('Choose model')} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(x => !x)} title={`${profile.name} · ${modelName || t('Choose model')}`}>
      {props.loading ? <LoaderCircle size={13} className="spin" /> : <span className={`status-dot ${ready ? '' : 'neutral'}`} />}
      <span>{modelName || t('Choose model')}</span><ChevronDown size={12} />
    </button>
    <label className="effort-control" title={options.length ? t('Higher effort can use more time and allowance.') : t('This model uses its provider default.')}>
      <span className="sr-only">{t('Reasoning effort')}</span>
      <select aria-label={t('Reasoning effort')} disabled={props.disabled || !options.length} value={chosen} onChange={e => props.onEffort((e.target.value || undefined) as ReasoningEffort | undefined)}>
        <option value="">{t('Provider default')}</option>{options.map(e => <option key={e} value={e}>{t(`effort.${e}`)}</option>)}
      </select>
    </label>
    {open && <section className="model-menu" role="dialog" aria-label={t('Choose model')}>
      <header><span>{t('Model & connection')}</span><button type="button" className="icon-button" disabled={props.loading} onClick={props.onRefresh} aria-label={t('Refresh models')}><RefreshCw size={14} /></button></header>
      <label className="connection-control">{t('Active connection')}<select aria-label={t('Active connection')} value={profile.id} onChange={e => props.onProfile(e.target.value)}>{props.settings.profiles?.map((p: ConnectionProfile) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <div className="model-search"><Search size={14} /><input ref={search} aria-label={t('Search models')} placeholder={t('Search models')} value={query} onChange={e => setQuery(e.target.value)} /></div>
      {props.loading && <p className="small muted" role="status">{t('Loading models…')}</p>}
      {props.error && <p className="model-error" role="alert">{t(props.error.title)} · {t('Your selected model is kept. Try refreshing or open connection settings.')}</p>}
      <div className="model-list">{props.catalog.filter(m => `${m.name} ${m.id}`.toLowerCase().includes(query.toLowerCase())).map(m => <button type="button" className={m.id === profile.model ? 'selected' : ''} key={m.id} onClick={() => choose(m.id)}><span>{m.name}<small>{m.id}</small></span>{m.id === profile.model && <Check size={14} />}</button>)}</div>
      {!props.loading && !props.catalog.length && <p className="small muted">{t(bridge.desktop ? 'Connect an account or save a key to load available models automatically.' : 'Use the desktop app to load available models.')}</p>}
      {profile.model && !props.catalog.some(m => m.id === profile.model) && <button type="button" className="saved-model" onClick={() => choose(profile.model)}>{t('Saved selection')} · {profile.model}</button>}
      {profile.provider !== 'chatgpt' && <details className="custom-model"><summary>{t('Enter a model ID')}</summary><div><input aria-label={t('Custom model ID')} value={custom} onChange={e => setCustom(e.target.value)} /><button type="button" disabled={!custom.trim()} onClick={() => choose(custom.trim())}>{t('Use model')}</button></div></details>}
      <footer><span>{t(profile.provider === 'chatgpt' ? 'Uses Work / Codex allowance' : 'Uses this provider’s API billing')}</span>{url && <button type="button" className="text-button" onClick={() => void bridge.openUrl(url).catch(e => props.onNotice(String(e)))}>{t('Manage usage')}</button>}<button type="button" className="icon-button" aria-label={t('Connection settings')} onClick={() => {setOpen(false); props.onSettings();}}><Settings2 size={14} /></button></footer>
    </section>}
  </div>;
}
