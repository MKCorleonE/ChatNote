import { FileText, Image, LoaderCircle, Paperclip, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Attachment, ConnectionProfile } from './types';
import { useI18n } from './I18nProvider';
import { attachmentError, attachmentType, maxAttachmentBytes } from './attachments';
import * as bridge from './bridge';
// Used by the file picker and clipboard so both paths enforce the same limits.
export async function prepareAttachments(files:File[],items:Attachment[],profile:ConnectionProfile):Promise<Attachment[]> {
  const additions=files.map(file=>{const type=attachmentType(file.name);if(!type)throw new Error('Unsupported attachment type.');if(!file.size||file.size>maxAttachmentBytes)throw new Error('Choose a supported file under 10 MB.');return{id:crypto.randomUUID(),name:file.name,mime:type.mime,kind:type.kind,size:file.size};});
  const error=attachmentError([...items,...additions],profile);if(error)throw new Error(error);
  for(let i=0;i<files.length;i++)await bridge.storeAttachment({attachment:additions[i],data:await bridge.fileBase64(files[i])});
  return [...items,...additions];
}
export function clipboardImages(data:DataTransfer):File[] {
  const images=[...data.items??[]].filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter((file):file is File=>!!file);
  const files=images.length?images:[...data.files??[]].filter(file=>file.type.startsWith('image/'));
  return files.map((file,i)=>attachmentType(file.name)?.kind==='image'?file:new File([file],`pasted-${Date.now()}-${i}.${({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'} as Record<string,string>)[file.type]??'unsupported'}`,{type:file.type}));
}
export function AttachmentList({items,onRemove,onNotice}:{items:Attachment[];onRemove?:(id:string)=>void;onNotice:(text:string)=>void}){const {t}=useI18n();return <div className="attachment-list">{items.map(a=><div className="attachment-chip" key={a.id}>{a.kind==='image'?<Image size={15}/>:<FileText size={15}/>}<button type="button" title={a.name} aria-label={t('Save attachment')+` · ${a.name}`} onClick={()=>void bridge.downloadAttachment(a).catch(e=>onNotice(String(e)))}><span>{a.name}</span><small>{(a.size/1024/1024).toFixed(1)} MB</small></button>{onRemove&&<button type="button" className="icon-button" aria-label={t('Remove attachment')+` · ${a.name}`} onClick={()=>onRemove(a.id)}><X size={13}/></button>}</div>)}</div>;}
export function AttachmentControls({items,profile,disabled,onChange,onNotice,onBusy}:{items:Attachment[];profile:ConnectionProfile;disabled:boolean;onChange:(items:Attachment[])=>void;onNotice:(text:string)=>void;onBusy:(busy:boolean)=>void}){const {t}=useI18n(),input=useRef<HTMLInputElement>(null),[busy,setBusy]=useState(false);async function attach(files:File[]){if(!files.length)return;setBusy(true);onBusy(true);try{onChange(await prepareAttachments(files,items,profile));}catch(e){onNotice(t(e instanceof Error?e.message:String(e)));}finally{setBusy(false);onBusy(false);if(input.current)input.current.value='';}}return <><button type="button" className="icon-button composer-attach" disabled={disabled||busy} aria-label={t('Attach files')} title={t('Attach files')} onClick={()=>input.current?.click()}>{busy?<LoaderCircle size={17} className="spin"/>:<Paperclip size={17}/>}</button><input ref={input} type="file" multiple hidden accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.tsv,.json,.xml,.html,.css,.js,.ts,.tsx,.jsx,.py,.rs,.sql,.yaml,.yml,.log,.tex" onChange={e=>void attach([...e.target.files??[]])}/></>;}
