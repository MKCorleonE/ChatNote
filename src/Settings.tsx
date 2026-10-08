import { useEffect, useState } from 'react';
import { X, Check, ArrowUpRight, LoaderCircle, Plus } from 'lucide-react';
import type { ConnectionProfile, Model, Preset, ProfileStatus, Settings as Config, UsageInfo } from './types';
import * as bridge from './bridge';
import { languages, resolveLanguage, type Language } from './i18n';
import { useI18n } from './I18nProvider';
import { activateProfile, friendlyError, migrateConnections, newProfile, presets, syncActive, usageUrl } from './connections';
import { glowDefaults } from './composer-options';
interface Props {
  value: Config;
  onChange: (s: Config) => void | Promise<void>;
  onClose: () => void;
  onNotice: (s: string) => void;
  onLanguageChange?: (language:Language)=>void|Promise<void>;
}
export default function Settings({
  value,
  onChange,
  onClose,
  onNotice,
  onLanguageChange
}: Props) {
  const { t, n, date, ui } = useI18n();
  const [signingIn, setSigningIn] = useState(false);
  const [signInCheck, setSignInCheck] = useState('');
  async function login(newAccount: boolean) {
    setSigningIn(true);
    try { await bridge.signIn(newAccount, resolveLanguage(config.language)); setStatus(await bridge.profileStatus(profile)); setCatalog([]); edit({checkedAt:undefined,checkState:undefined,checkMessage:undefined}); }
    finally { setSigningIn(false); }
  }
  const [config, setConfig] = useState(() => migrateConnections(value)),
    [editingId, setEditingId] = useState(() => migrateConnections(value).activeProfileId!),
    [preset, setPreset] = useState<Preset>('deepseek');
  const [key, setKey] = useState(''),
    [status, setStatus] = useState<ProfileStatus | null>(null),
    [catalog, setCatalog] = useState<Model[]>([]),
    [usage, setUsage] = useState<UsageInfo | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<ReturnType<typeof friendlyError> | null>(null);
  const profile = config.profiles!.find(p => p.id === editingId)!;
  const source = presets.find(p => p.id === profile.preset)!;
  useEffect(() => {
    let live = true;
    setStatus(null);
    const timer = setTimeout(() => {
      void bridge.profileStatus(profile).then(s => {
        if (live) setStatus(s);
      }).catch(e => {
        if (live) setError(friendlyError(e));
      });
    }, 100);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [profile.id, profile.endpoint]);
  function edit(patch: Partial<ConnectionProfile>) {
    setConfig(c => syncActive({
      ...c,
      profiles: c.profiles!.map(p => p.id === editingId ? {
        ...p,
        ...patch,
        ...(('endpoint' in patch || 'model' in patch) && !('checkState' in patch) ? {
          checkedAt: undefined,
          checkState: undefined,
          checkMessage: undefined
        } : {})
      } : p)
    }));
  }
  function select(id: string) {
    setEditingId(id);
    setKey('');
    setCatalog([]);
    setUsage(null);
    setError(null);
  }
  async function action(f: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveKey() {
    if (!key.trim() || profile.provider === 'chatgpt') return;
    if (config.profiles!.some(p => !p.name.trim())) throw new Error('Give each connection a name before saving.');
    await onChange(syncActive(config));
    await bridge.setKey(profile.provider, key.trim(), profile.endpoint, profile.id);
    setKey('');
    setStatus(await bridge.profileStatus(profile));
    edit({
      checkedAt: undefined,
      checkState: undefined,
      checkMessage: undefined
    });
  }
  async function check() {
    await saveKey();
    try {
      const list = await bridge.models(profile.provider, profile.endpoint, profile.id);
      setCatalog(list);
      const suggested = list.find(m => /^(gpt|chatgpt|qwen|deepseek|o\d)/i.test(m.id) && !/audio|image|embedding|realtime|tts/.test(m.id)) ?? list[0];
      edit({
        checkedAt: Date.now(),
        checkState: 'catalog',
        checkMessage: `Authentication checked · ${list.length} models listed`,
        ...(!profile.model && suggested ? {
          model: suggested.id
        } : {})
      });
      setStatus(await bridge.profileStatus(profile));
    } catch (e) {
      edit({
        checkedAt: Date.now(),
        checkState: 'error',
        checkMessage: friendlyError(e).title
      });
      throw e;
    }
  }
  function add() {
    if (preset === 'chatgpt') {
      const existing = config.profiles!.find(p => p.provider === 'chatgpt');
      if (existing) {
        select(existing.id);
        return;
      }
    }
    const p = newProfile(preset);
    p.name=t(p.name);
    setConfig(c => ({
      ...c,
      profiles: [...c.profiles!, p]
    }));
    select(p.id);
  }
  const ready = profile.provider === 'chatgpt' ? status?.connected && status.planUsage : status?.hasKey && status.endpointMatches;
  const stateText = !bridge.desktop ? 'Desktop connection' : !status ? 'Checking saved connection…' : profile.provider === 'chatgpt' ? status.connected ? status.planUsage ? status.refreshable ? 'Saved account · automatic renewal available' : 'Account connected · plan permission enabled' : 'Account connected · plan permission missing' : status.registered ? 'Saved registration · sign in to resume' : 'Not connected' : status.hasKey ? status.endpointMatches ? 'Key saved securely' : 'Address and saved key do not match' : 'No key saved';
  const externalUrl = usage?.url ?? usageUrl(profile);
  const glow = {...glowDefaults, ...config.composerGlow};
  return <div className="modal-backdrop" onClick={e => {
    if (e.target === e.currentTarget && !busy) onClose();
  }}><section className="settings modal" role="dialog" aria-modal="true" aria-label={t("Settings")}>
    <header><div><span className="eyebrow">{t("MAKE IT YOURS")}</span><h2>{t("Settings")}</h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label={t("Close settings")}><X size={18} /></button></header>
    <div className="settings-scroll"><label>{t('Interface language')}<select aria-label={t('Interface language')} disabled={busy} value={resolveLanguage(config.language)} onChange={e=>{const chosen=resolveLanguage(e.target.value);setConfig(c=>({...c,language:chosen}));void (async()=>{try{if(onLanguageChange)await onLanguageChange(chosen);else await onChange({...value,language:chosen});}catch(error){setError(friendlyError(error));}})();}}>{languages.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select><span className="small muted">{t('Language changes apply immediately. Your conversations and model replies are not translated.')}</span></label><h3>{t("Saved connections")}</h3><p className="muted">{t("Each connection keeps its own address, model and secure key. Switching never changes your conversations.")}</p>
    <div className="connection-list">{config.profiles!.map(p => <button className={`connection-choice ${p.id === editingId ? 'selected' : ''}`} key={p.id} disabled={busy} onClick={() => select(p.id)}><span>{p.name}</span><small>{p.id === config.activeProfileId ? <><Check size={11} />{t("In use")}</> : t(presets.find(x => x.id === p.preset)?.name ?? '')}</small></button>)}</div>
    <div className="add-connection"><select aria-label={t("Connection preset")} value={preset} onChange={e => setPreset(e.target.value as Preset)} disabled={busy}>{presets.map(p => <option key={p.id} value={p.id}>{t(p.name)}</option>)}</select><button disabled={busy || config.profiles!.length >= 50} onClick={add}><Plus size={13} />{t("Add connection")}</button></div>
    <div className="connection-heading"><span className="small-label">{t(source.name)}</span><button className={profile.id === config.activeProfileId ? 'text-button' : 'primary'} disabled={busy || profile.id === config.activeProfileId || config.profiles!.some(p => !p.name.trim())} onClick={() => action(async () => {
            await saveKey();
            const next = activateProfile(config, profile.id);
            setConfig(next);
            await onChange(next);
            onNotice(`Using ${profile.name}.`);
          })}>{profile.id === config.activeProfileId ? t("Current connection") : t("Use this connection")}</button></div>
    <label>{t("Connection name")}<input aria-label={t("Connection name")} disabled={busy} value={profile.name} onChange={e => edit({
            name: e.target.value.slice(0, 70)
          })} /></label><p className="small muted">{t(source.hint)}</p>
    <div className={`connection-status ${ready ? 'ready' : ''}`}><span className="status-dot" /><span>{t(stateText)}</span>{status?.email && <small>{status.email}</small>}</div>
    {profile.provider === 'chatgpt' ? <div className="connection-card"><button className="primary" disabled={busy || !bridge.desktop} onClick={() => action(async () => {
            await login(false);
          })}>{t("Continue with ChatGPT")}<ArrowUpRight size={14} /></button>{status?.connected && <button className="text-button" disabled={busy} onClick={() => action(async () => {
            onNotice(await bridge.signOut());
            setStatus(await bridge.profileStatus(profile));
            setCatalog([]);
            edit({
              checkedAt: undefined,
              checkState: undefined,
              checkMessage: undefined
            });
          })}>{t("Disconnect")}</button>}<button className="text-button" disabled={busy || !bridge.desktop} onClick={() => action(async () => {
            await login(true);
          })}>{t("Connect a different account")}</button>{signingIn && <><p role="status">{t('Waiting for browser authorization…')}</p><button className="text-button" onClick={()=>void bridge.cancelSignIn().catch(e=>setError(friendlyError(e)))}>{t('Cancel sign-in')}</button></>}<button className="text-button" disabled={busy || !bridge.desktop} onClick={()=>action(async()=>{setSignInCheck('');setSignInCheck(await bridge.checkSignInService());})}>{t('Check sign-in connection')}</button>{signInCheck && <p className="small muted" role="status">{t(signInCheck)}</p>}<p className="small muted">{t('If the browser authorization page times out, cancel this attempt, close the old authorization tab, and start sign-in again. Check that this browser can reach ChatGPT. Your saved registration is kept.')}</p><p className="small muted">{t("One active ChatGPT account. This connection uses its existing allowance and does not import its conversations.")}</p></div> : <>
      {profile.provider === 'compatible' && <label>{t("API base URL")}<input aria-label={t("API base URL")} disabled={busy} value={profile.endpoint} onChange={e => {
              edit({
                endpoint: e.target.value
              });
              setUsage(null);
              setCatalog([]);
            }} placeholder="https://provider.example/v1" /><span className="small muted">{t("Use the URL paired with your key. Model Studio regions and plan keys have different addresses.")}</span></label>}
      <label>{t("API key")}<input aria-label={t("API key")} disabled={busy} type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder={status?.hasKey ? t("A key is saved. Enter a replacement if needed.") : t("Enter the key for this connection")} /></label>
      <div className="button-row"><button disabled={busy || !key.trim() || !bridge.desktop} onClick={() => action(async () => {
              await saveKey();
              onNotice(`Key saved for ${profile.name}.`);
            })}>{t("Save key")}</button><button disabled={busy || !status?.hasKey || !bridge.desktop} onClick={() => action(async () => {
              await bridge.setKey(profile.provider, '', profile.endpoint, profile.id);
              setStatus(await bridge.profileStatus(profile));
              setCatalog([]);
              setUsage(null);
              edit({
                checkedAt: undefined,
                checkState: undefined,
                checkMessage: undefined
              });
            })}>{t("Remove key")}</button><span className="small muted">{t("Keys stay in the system vault, outside backups.")}</span></div>
    </>}
    <label>{t("Model")}<div className="model-row"><input aria-label={t("Model")} disabled={busy} value={profile.model} onChange={e => edit({
              model: e.target.value
            })} placeholder={t("Load models or enter a model ID")} list="model-catalog" /><button disabled={busy || !bridge.desktop || !ready && !key.trim()} onClick={() => action(check)}>{t("Refresh models")}</button></div><datalist id="model-catalog">{catalog.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</datalist></label>
    <p className={`small ${profile.checkState === 'error' ? 'error' : 'muted'}`}>{profile.checkMessage ? ui(profile.checkMessage) : t("Not yet tested. This check reads the model directory; it does not send a conversation or use generation quota.")}{profile.checkedAt && <> · {date(profile.checkedAt,true)}</>}</p>{profile.checkState === 'catalog' && <p className="small muted">{t("A model directory check does not confirm that every model can generate. Your first completed answer verifies that request.")}</p>}
    <h3>{t("Balance & allowance")}</h3>
    {usage?.kind === 'balance' ? <div className="balance-card">{usage.balances?.map(b => <div key={b.currency}><span>{t("Available balance")}</span><strong>{b.currency} {b.total}</strong></div>)}<p className="small muted">{usage.available ? t("Provider reports funds available.") : t("Provider reports no funds available for calls.")}{usage.checkedAt && <>{t('checkedTime',{time:date(usage.checkedAt,true)})}</>}{t("Balance is money, not a token estimate.")}</p></div> : <p className="small muted">{profile.provider === 'chatgpt' ? t("Remaining five-hour / weekly allowance is not available through this connection. View the official usage page.") : profile.preset === 'deepseek' ? t("Check the actual balance reported by DeepSeek. No test answer is generated.") : t("Remaining allowance is not queried by this build. Check the provider console for accurate usage and billing.")}</p>}
    <div className="button-row">{profile.preset === 'deepseek' && <button disabled={busy || !bridge.desktop || !ready} onClick={() => action(async () => {
            setUsage(await bridge.usage(profile));
          })}>{t("Refresh balance")}</button>}{externalUrl && <button className="text-button" onClick={() => void bridge.openUrl(externalUrl).catch(e => setError(friendlyError(e)))}>{t("Open official usage page")}<ArrowUpRight size={12} /></button>}</div>
    {profile.preset === 'qwen' && <p className="small muted">{t("An API key may be billed by usage or by a subscription. Use the matching service address and confirm the plan allows your use of ChatNote.")}</p>}
    {busy && <p className="muted"><LoaderCircle className="spin" size={14} />{t("Working\u2026 Complete any sign-in in your browser.")}</p>}{error && <div className="connection-error" role="alert"><strong>{t(error.title)}</strong><p>{t(error.message)}</p><details><summary>{t("Provider details")}</summary><p>{error.detail}</p></details></div>}
    {!bridge.desktop && <p className="notice">{t("Browser preview: connection profiles can be arranged here. Keys, sign-in and provider requests are available in the desktop app.")}</p>}
    <h3>{t("Reading & appearance")}</h3><div className="settings-grid"><label>{t("Theme")}<select value={config.theme} onChange={e => setConfig(c => ({
              ...c,
              theme: e.target.value as Config['theme']
            }))}><option value="dark">{t("Dark")}</option><option value="light">{t("Light")}</option></select></label><label>{t("Text size")}<select value={config.fontSize} onChange={e => setConfig(c => ({
              ...c,
              fontSize: Number(e.target.value)
            }))}>{[13, 14, 15, 16, 17, 18].map(n => <option key={n} value={n}>{t('fontPixels',{count:n})}</option>)}</select></label></div>
    <h3>{t('Input glow')}</h3><label className="switch-label"><input type="checkbox" checked={glow.enabled} onChange={e=>setConfig(c=>({...c,composerGlow:{...glow,enabled:e.target.checked}}))}/>{t('Animated input border')}<span className="small muted">{t('Appears while focused or generating. Reduced-motion settings disable rotation.')}</span></label>
    <div className="settings-grid glow-settings">{(['colorA','colorB'] as const).map((key,index)=><label key={key}>{t(index?'Glow color 2':'Glow color 1')}<div className="glow-color"><input type="color" aria-label={t(index?'Glow color 2':'Glow color 1')} value={glow[key]} onInput={e=>setConfig(c=>({...c,composerGlow:{...glow,[key]:(e.target as HTMLInputElement).value}}))}/><span>{glow[key].toUpperCase()}</span></div></label>)}<label>{t('Glow brightness')}<input aria-label={t('Glow brightness')} type="range" min="0" max="100" value={glow.brightness} onChange={e=>setConfig(c=>({...c,composerGlow:{...glow,brightness:Number(e.target.value)}}))}/><span>{n(glow.brightness)}%</span></label><label>{t('Glow cycle')}<input aria-label={t('Glow cycle')} type="range" min="2" max="20" value={glow.seconds} onChange={e=>setConfig(c=>({...c,composerGlow:{...glow,seconds:Number(e.target.value)}}))}/><span>{t('glowSeconds',{count:n(glow.seconds)})}</span></label></div><p className="small muted">{t('Use the color picker to set RGB colors. Both colors are saved on this device.')}</p>
    <label className="switch-label"><input type="checkbox" checked={config.annotations} onChange={e => setConfig(c => ({
            ...c,
            annotations: e.target.checked
          }))} />{t("Passage annotations")}<span className="small muted">{t("Turning off hides indicators without deleting saved annotations.")}</span></label>
    <label>{t("Context budget")}<select value={config.contextBudget} onChange={e => setConfig(c => ({
            ...c,
            contextBudget: Number(e.target.value)
          }))}>{[16000, 48000, 96000, 192000].map(count => <option key={count} value={count}>{t('characterCount',{count:n(count)})}</option>)}</select><span className="small muted">{t("A local character budget, not an exact token limit. Older content may be abbreviated; originals remain saved.")}</span></label>
    </div><footer><span className="small muted">ChatNote · 0.4.0</span><button className="primary" disabled={busy || config.profiles!.some(p => !p.name.trim())} onClick={() => action(async () => {
          await saveKey();
          await onChange(syncActive(config));
          onClose();
        })}>{t("Done")}</button></footer>
  </section></div>;
}
