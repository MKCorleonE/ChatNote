import { storageSnapshot, storageWorkspace, unpackWorkspace } from './workspace-storage';
import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import type { Connection, ConnectionProfile, Generation, Model, ProfileStatus, StreamEvent, UsageInfo, Workspace } from './types';
import { recoverWorkspace, validateWorkspace } from './core';
import { migrateConnections } from './connections';
import type { Language } from './i18n';
import type { Attachment } from './types';
import { sessionMessages } from './message-history';
import { maxAttachmentBytes, validateAttachment, transcriptionModel } from './attachments';
import { expiredTrash, purgeTrash } from './trash';
export const desktop = isTauri();
const browserKey = 'chatnote-workspace-v1';
let queue: Promise<void> = Promise.resolve();
const sessionCache=new WeakMap<import('./types').Session,string>();
let storedRecords=new Map<string,string>();
const transientKeys: Record<string, string> = {};
export async function loadWorkspace(): Promise<Workspace | null> {
  let raw: string | null;
  if (desktop) raw = await invoke<string | null>('load_workspace');
  else raw = await new Promise<string | null>((resolve, reject) => { const r = indexedDB.open('chatnote', 2); r.onupgradeneeded = () => {if(!r.result.objectStoreNames.contains('workspace'))r.result.createObjectStore('workspace');if(!r.result.objectStoreNames.contains('attachments'))r.result.createObjectStore('attachments');}; r.onerror = () => reject(new Error('Cannot open browser storage.')); r.onsuccess = () => { const db = r.result; const q = db.transaction('workspace').objectStore('workspace').get(browserKey); q.onsuccess = () => { resolve(q.result ?? null); db.close(); }; q.onerror = () => { reject(new Error('Cannot read browser storage.')); db.close(); }; }; });
  storedRecords=new Map();
  if (!raw) return null;
  const data = unpackWorkspace(JSON.parse(raw)); validateWorkspace(data); const info=desktop?await connection().catch(()=>null):null;data.settings=migrateConnections(data.settings,info?.legacyCompatibleEndpoint);recoverWorkspace(data);
  const expired=expiredTrash(data);if(!expired.length)return data;const next=purgeTrash(data,expired);await purgeWorkspace(data,next,expired);return next;
}
export function saveWorkspace(w: Workspace): Promise<void> {
  const snapshot=storageSnapshot(w,sessionCache);
  const raw=desktop?null:storageWorkspace(w);
  queue = queue.catch(() => {}).then(async()=>{
    if(!desktop)return persistWorkspace(raw!);
    const changes=[...snapshot.records].filter(([id,payload])=>storedRecords.get(id)!==payload).map(([id,payload])=>({id,payload}));
    await invoke('save_workspace_delta',{head:snapshot.head,changes});storedRecords=snapshot.records;
  });return queue;
}
async function persistWorkspace(raw:string):Promise<void> {
    if (desktop) return invoke<void>('save_workspace', { payload: raw });
    return new Promise<void>((resolve, reject) => { const r = indexedDB.open('chatnote', 2); r.onupgradeneeded = () => {if(!r.result.objectStoreNames.contains('workspace'))r.result.createObjectStore('workspace');if(!r.result.objectStoreNames.contains('attachments'))r.result.createObjectStore('attachments');}; r.onerror = () => reject(new Error('Cannot save in this browser. Export a backup.')); r.onsuccess = () => { const db = r.result, tx = db.transaction('workspace', 'readwrite'); tx.objectStore('workspace').put(raw, browserKey); tx.oncomplete = () => { resolve(); db.close(); }; tx.onerror = () => { reject(new Error('Saving failed. Export a backup.')); db.close(); }; }; });
}
export function purgeWorkspace(before:Workspace,next:Workspace,sessionIds:string[]):Promise<void> {
  validateWorkspace(next);const raw=storageWorkspace(next);
  queue=queue.catch(()=>{}).then(async()=>{
    // Flush the pre-deletion state before the atomic purge, including recently moved items.
    if(desktop){const snapshot=storageSnapshot(before);await invoke('save_workspace_delta',{head:snapshot.head,changes:[...snapshot.records].map(([id,payload])=>({id,payload}))});}else await persistWorkspace(storageWorkspace(before));
    if(desktop){await invoke('purge_conversations',{payload:raw,sessionIds});storedRecords=new Map();return;}
    const candidates=referencedAttachments({...before,sessions:(before.trash??[]).filter(e=>sessionIds.includes(e.session.id)).map(e=>e.session),trash:[]}),retained=new Set(referencedAttachments(next).map(a=>a.id));
    await new Promise<void>((resolve,reject)=>{const request=indexedDB.open('chatnote',2);request.onerror=()=>reject(new Error('Could not open the recycle bin'));request.onsuccess=()=>{const db=request.result,tx=db.transaction(['workspace','attachments'],'readwrite');tx.objectStore('workspace').put(raw,browserKey);for(const a of candidates)if(!retained.has(a.id))tx.objectStore('attachments').delete(a.id);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=tx.onerror=()=>{db.close();reject(new Error('Recycle bin cleanup failed. Your saved records were preserved.'));};};});
  });return queue;
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
  const blob = new Blob([content], { type: name.endsWith('.json') ? 'application/json' : name.endsWith('.html') ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); return true;
}
export interface StoredAttachment { attachment:Attachment; data:string }
async function browserAttachment(id:string, record?:StoredAttachment):Promise<StoredAttachment> {
  return new Promise((resolve,reject)=>{const request=indexedDB.open('chatnote',2);request.onupgradeneeded=()=>{for(const name of ['workspace','attachments'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};request.onerror=()=>reject(new Error('Could not open local attachments'));request.onsuccess=()=>{const db=request.result,tx=db.transaction('attachments',record?'readwrite':'readonly'),store=tx.objectStore('attachments'),read=store.get(id);let value:StoredAttachment|undefined;read.onsuccess=()=>{value=read.result;if(record){if(value&&JSON.stringify(value)!==JSON.stringify(record)){tx.abort();return;}store.put(record,id);value=record;}};tx.oncomplete=()=>{db.close();value?resolve(value):reject(new Error('A local attachment is missing. Attach the original file again.'));};tx.onabort=tx.onerror=()=>{db.close();reject(new Error('Could not save attachment; the existing file was preserved.'));};};});
}
export async function storeAttachment(record:StoredAttachment) {
  if(!validateAttachment(record.attachment)||record.data.length>Math.ceil(maxAttachmentBytes*4/3)+4)throw new Error('Choose a supported file under 10 MB.');
  try {const decoded=atob(record.data);if(decoded.length!==record.attachment.size)throw new Error();if(record.attachment.kind==='text')new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(decoded,c=>c.charCodeAt(0)));}catch{throw new Error('Invalid attachment encoding or size.');}
  if(desktop)await invoke('store_attachment',{...record});else await browserAttachment(record.attachment.id,record);
}
export async function readAttachment(id:string):Promise<StoredAttachment> {return desktop?invoke('read_attachment',{id}):browserAttachment(id);}
export function fileBase64(file:Blob):Promise<string> {return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Could not read the selected file'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file);});}
export function referencedAttachments(w:Workspace):Attachment[] {const records=new Map<string,Attachment>();const collect=(items:Attachment[]|undefined)=>{for(const a of items??[])records.set(a.id,a);};for(const s of [...w.sessions,...(w.trash??[]).map(e=>e.session)]){for(const m of sessionMessages(s)){collect(m.attachments);for(const item of m.context?.items??[])collect(item.attachments);}for(const b of s.branches)for(const item of b.sourceContext)collect(item.attachments);for(const list of Object.values(s.view.attachmentDrafts??{}))collect(list);}return [...records.values()];}
export async function backupWorkspace(w:Workspace) {const bundledAttachments=[];for(const a of referencedAttachments(w))bundledAttachments.push(await readAttachment(a.id));return {...w,bundledAttachments};}
export async function restoreAttachments(w:Workspace & {bundledAttachments?:StoredAttachment[]}) {const references=referencedAttachments(w);if(w.bundledAttachments!==undefined&&(!Array.isArray(w.bundledAttachments)||w.bundledAttachments.length>2000))throw new Error('Invalid attachment backup');for(const a of references){const record=w.bundledAttachments?.find(r=>r.attachment?.id===a.id);if(record){if(JSON.stringify(record.attachment)!==JSON.stringify(a))throw new Error('Invalid attachment backup');await storeAttachment(record);}else await readAttachment(a.id);}delete w.bundledAttachments;}
export async function transcribe(profile:ConnectionProfile,blob:Blob):Promise<string> {if(!desktop)throw new Error('Speech transcription is available in the desktop app.');return invoke('transcribe',{provider:profile.provider,endpoint:profile.endpoint,profileId:profile.id,model:transcriptionModel(profile),data:await fileBase64(blob),mime:blob.type});}
export async function downloadAttachment(attachment:Attachment){const record=await readAttachment(attachment.id),bytes=Uint8Array.from(atob(record.data),c=>c.charCodeAt(0));if(desktop){const {save}=await import('@tauri-apps/plugin-dialog'),{writeFile}=await import('@tauri-apps/plugin-fs');const path=await save({defaultPath:attachment.name});if(path)await writeFile(path,bytes);}else{const url=URL.createObjectURL(new Blob([bytes],{type:attachment.mime})),link=document.createElement('a');link.href=url;link.download=attachment.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}}
