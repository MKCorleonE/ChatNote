import type { Attachment, ConnectionProfile, Settings } from './types';
export const maxAttachmentBytes = 10 * 1024 * 1024;
export const maxRequestAttachmentBytes = 20 * 1024 * 1024;
const images:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'};
const documents:Record<string,string>={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
const textExtensions=new Set(['txt','md','csv','tsv','json','xml','html','css','js','ts','tsx','jsx','py','rs','sql','yaml','yml','log','tex']);
export function attachmentType(name:string):Pick<Attachment,'kind'|'mime'>|null {
  const ext=name.split('.').at(-1)?.toLowerCase()??'';
  if(images[ext])return{kind:'image',mime:images[ext]};
  if(documents[ext])return{kind:'document',mime:documents[ext]};
  return textExtensions.has(ext)?{kind:'text',mime:'text/plain'}:null;
}
export function supportsImages(profile:ConnectionProfile):boolean {
  if(profile.imageInput!==undefined)return profile.imageInput;
  if(profile.provider==='openai'||profile.provider==='chatgpt')return !/^(o1|o3-mini)|embedding|audio|whisper|tts|realtime/i.test(profile.model);
  return /qwen.*(?:vl|3\.6)|qvq|deepseek-flash|deepseek-v4-flash-vision/i.test(profile.model);
}
export function attachmentError(items:Attachment[],profile:ConnectionProfile):string|null {
  if(items.length>8||items.reduce((n,a)=>n+a.size,0)>maxRequestAttachmentBytes)return 'Use up to 8 attachments and 20 MB per request.';
  if(items.some(a=>a.kind==='image')&&!supportsImages(profile))return 'Choose a vision model or enable image input for this connection.';
  if(items.some(a=>a.kind==='document')&&profile.provider!=='openai')return 'PDF and Office documents require an OpenAI API connection. Other connections support text files and compatible vision images.';
  return null;
}
export function voiceProfile(settings:Settings):ConnectionProfile|undefined {
  const eligible=(p:ConnectionProfile)=>p.provider==='openai'||p.provider==='compatible'&&!!p.transcriptionModel?.trim();
  if(settings.voiceProfileId)return settings.profiles?.find(p=>p.id===settings.voiceProfileId&&eligible(p));
  return settings.profiles?.find(p=>p.id===settings.activeProfileId&&eligible(p))??settings.profiles?.find(eligible);
}
export function validateAttachment(a:Attachment):boolean {
  const type=attachmentType(a?.name??'');
  return !!a&&/^[0-9a-f-]{36}$/i.test(a.id)&&typeof a.name==='string'&&a.name.length<=240&&!!type&&a.kind===type.kind&&a.mime===type.mime&&Number.isInteger(a.size)&&a.size>0&&a.size<=maxAttachmentBytes;
}
