import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import type { Connection, ConnectionProfile, Generation, Model, ProfileStatus, StreamEvent, UsageInfo, Workspace } from './types';
import { recoverWorkspace, validateWorkspace } from './core';
import { migrateConnections } from './connections';
import type { Language } from './i18n';
export const desktop = isTauri();
const browserKey = 'chatnote-workspace-v1';
let queue: Promise<void> = Promise.resolve();
const transientKeys: Record<string, string> = {};
export async function loadWorkspace(): Promise<Workspace | null> {
  let raw: string | null;
  if (desktop) raw = await invoke<string | null>('load_workspace');
  else raw = await new Promise<string | null>((resolve, reject) => { const r = indexedDB.open('chatnote', 1); r.onupgradeneeded = () => r.result.createObjectStore('workspace'); r.onerror = () => reject(new Error('Cannot open browser storage.')); r.onsuccess = () => { const db = r.result; const q = db.transaction('workspace').objectStore('workspace').get(browserKey); q.onsuccess = () => { resolve(q.result ?? null); db.close(); }; q.onerror = () => { reject(new Error('Cannot read browser storage.')); db.close(); }; }; });
  if (!raw) return null;
  const data = JSON.parse(raw); validateWorkspace(data); const info=desktop?await connection().catch(()=>null):null;data.settings=migrateConnections(data.settings,info?.legacyCompatibleEndpoint);return recoverWorkspace(data);
}
export function saveWorkspace(w: Workspace): Promise<void> {
  const raw = JSON.stringify(w);
  queue = queue.catch(() => {}).then(async () => {
    if (desktop) return invoke<void>('save_workspace', { payload: raw });
    return new Promise<void>((resolve, reject) => { const r = indexedDB.open('chatnote', 1); r.onupgradeneeded = () => r.result.createObjectStore('workspace'); r.onerror = () => reject(new Error('Cannot save in this browser. Export a backup.')); r.onsuccess = () => { const db = r.result, tx = db.transaction('workspace', 'readwrite'); tx.objectStore('workspace').put(raw, browserKey); tx.oncomplete = () => { resolve(); db.close(); }; tx.onerror = () => { reject(new Error('Saving failed. Export a backup.')); db.close(); }; }; });
  }); return queue;
}
export async function connection(): Promise<Connection> { return desktop ? invoke<Connection>('connection_status') : { apiKey: !!transientKeys.openai, compatibleKey: !!transientKeys.compatible, chatgpt: false }; }
export async function setKey(provider: string, key: string, endpoint = 'https://api.openai.com/v1',profileId?:string) { if (desktop) await invoke('set_api_key', { provider, key, endpoint,profileId }); else transientKeys[profileId ?? provider] = key; }
export async function models(provider: string, endpoint: string,profileId?:string): Promise<Model[]> { if (!desktop) throw new Error('Model connections are available in the desktop app.'); return invoke<Model[]>('list_models', { provider, endpoint,profileId }); }
export async function profileStatus(profile:ConnectionProfile):Promise<ProfileStatus>{if(!desktop)return{hasKey:false,endpointMatches:true,connected:false,planUsage:false};return invoke('profile_status',{profileId:profile.id,provider:profile.provider,endpoint:profile.endpoint});}
export async function usage(profile:ConnectionProfile):Promise<UsageInfo>{return invoke('connection_usage',{profileId:profile.id,provider:profile.provider,endpoint:profile.endpoint,preset:profile.preset});}
export async function openUrl(url:string){if(desktop){const {openUrl}=await import('@tauri-apps/plugin-opener');await openUrl(url);}else window.open(url,'_blank','noopener,noreferrer');}
export async function signIn(newAccount = false, language: Language = 'en'): Promise<Connection> { if (!desktop) throw new Error('Use the desktop app to connect ChatGPT.'); return invoke<Connection>('sign_in_chatgpt', { newAccount, language }); }
export async function cancelSignIn(): Promise<void> { if (desktop) await invoke('cancel_sign_in'); }
export async function checkSignInService(): Promise<string> { if (!desktop) throw new Error('Use the desktop app to connect ChatGPT.'); return invoke('check_sign_in_service'); }
export async function signOut(): Promise<string> { return desktop ? invoke<string>('sign_out_chatgpt') : 'Disconnected.'; }
export async function generate(req: Generation, onEvent: (event: StreamEvent) => void, signal: AbortSignal): Promise<void> {
  if (!desktop) throw new Error('This browser preview supports reading and annotations. Use the desktop app for model requests.');
  const channel = new Channel<StreamEvent>(); channel.onmessage = onEvent;
  const abort = () => { void invoke('cancel_generation', { requestId: req.requestId }); };
  signal.addEventListener('abort', abort, { once: true });
  try { if (signal.aborted) throw new Error('Stopped'); await invoke('generate', { request: req, onEvent: channel }); }
  finally { signal.removeEventListener('abort', abort); }
}
export async function saveFile(name: string, content: string) {
  if (desktop) { const { save } = await import('@tauri-apps/plugin-dialog'); const { writeTextFile } = await import('@tauri-apps/plugin-fs'); const path = await save({ defaultPath: name }); if (path) await writeTextFile(path, content); return !!path; }
  const blob = new Blob([content], { type: name.endsWith('.json') ? 'application/json' : 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); return true;
}
