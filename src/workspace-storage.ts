import type { Session, Workspace } from './types';

// Storage-only encoding. In-memory requests, source anchors and public backups stay verbatim.
export function packSession(session:Session):string {
 const pool:string[]=[],index=new Map<string,number>();
 const value=JSON.parse(JSON.stringify(session,(_key,item)=>{
  if(item&&typeof item==='object'&&['user','assistant'].includes(item.role)&&typeof item.content==='string'){
   let ref=index.get(item.content);if(ref===undefined){ref=pool.length;index.set(item.content,ref);pool.push(item.content);}
   return {...item,content:'',storageContentRef:ref};
  }
  return item;
 }));
 return JSON.stringify({...value,storageCodec:1,storageText:pool});
}
export function unpackSession(raw:unknown):Session {
 const value=raw as Session&{storageCodec?:number;storageText?:string[]};
 if(value.storageCodec===undefined)return value;
 if(value.storageCodec!==1||!Array.isArray(value.storageText)||value.storageText.some(t=>typeof t!=='string'))throw new Error('Invalid stored conversation.');
 const pool=value.storageText;
 const session=JSON.parse(JSON.stringify(value),(_key,item)=>{
  if(item&&typeof item==='object'&&'storageContentRef'in item){const ref=item.storageContentRef;if(!Number.isSafeInteger(ref)||ref<0||ref>=pool.length)throw new Error('Invalid stored context.');const {storageContentRef:_,...rest}=item;return {...rest,content:pool[ref]};}return item;
 });
 delete session.storageCodec;delete session.storageText;return session;
}
export function unpackWorkspace(raw:unknown):Workspace {
 const w=raw as Workspace;return {...w,sessions:w.sessions.map(unpackSession),...(w.trash?{trash:w.trash.map(e=>({...e,session:unpackSession(e.session)}))}:{})};
}
export function storageSnapshot(w:Workspace,cache?:WeakMap<Session,string>){
 const records=new Map<string,string>();
 const pack=(s:Session)=>{let payload=cache?.get(s);if(payload===undefined){payload=packSession(s);cache?.set(s,payload);}records.set(s.id,payload);return s.id;};
 const head=JSON.stringify({...w,sessions:w.sessions.map(pack),trash:(w.trash??[]).map(e=>({id:pack(e.session),deletedAt:e.deletedAt}))});
 return {head,records};
}
export function storageWorkspace(w:Workspace):string {
 const {head,records}=storageSnapshot(w),data=JSON.parse(head);
 return JSON.stringify({...data,sessions:data.sessions.map((id:string)=>JSON.parse(records.get(id)!)),trash:data.trash.map((e:{id:string;deletedAt:number})=>({deletedAt:e.deletedAt,session:JSON.parse(records.get(e.id)!)}))});
}
