import type { Session } from './types';
export function validateSessionExtensions(session:Session,checkAttachments:(items:unknown)=>void) {
  const map=session.view?.map;
  const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=100000;
  if(map!==undefined){
    if(!map||typeof map!=='object'||!map.positions||typeof map.positions!=='object'||Array.isArray(map.positions)||Object.keys(map.positions).length>20000||!Array.isArray(map.collapsed)||map.collapsed.length>20000||map.collapsed.some(id=>typeof id!=='string')||Object.values(map.positions).some(p=>!p||!finite(p.x)||!finite(p.y)))throw new Error('Invalid canvas layout.');
    const camera=map.camera;if(camera&&(!finite(camera.x)||!finite(camera.y)||!Number.isFinite(camera.zoom)||camera.zoom<.15||camera.zoom>2))throw new Error('Invalid canvas layout.');
  }
  for(const thread of [session,...session.branches])for(const message of [...thread.messages,...(thread.messageHistory??[]).flat()]){
    const record=message.merge;if(record===undefined)continue;
    if(!record||message.role!=='user'||!Number.isFinite(record.createdAt)||!Array.isArray(record.sources)||!record.sources.length||record.sources.length>2000)throw new Error('Invalid merge sources.');
    for(const source of record.sources){
      if(!source||['sessionId','branchId','title','messageId'].some(key=>typeof source[key as keyof typeof source]!=='string')||!source.anchor||typeof source.anchor.quote!=='string'||typeof source.anchor.messageId!=='string'||typeof source.anchor.revision!=='string'||!Number.isInteger(source.anchor.start)||!Number.isInteger(source.anchor.end)||source.anchor.start<0||source.anchor.end<=source.anchor.start||typeof source.anchor.prefix!=='string'||typeof source.anchor.suffix!=='string'||!Array.isArray(source.versions)||source.versions.length>20000||source.versions.some(v=>!v||typeof v.id!=='string'||typeof v.revision!=='string')||!Array.isArray(source.context)||source.context.length>20000||source.context.some(item=>!item||!['user','assistant'].includes(item.role)||typeof item.content!=='string'))throw new Error('Invalid merge sources.');
      for(const item of source.context)checkAttachments(item.attachments);
    }
  }
}
