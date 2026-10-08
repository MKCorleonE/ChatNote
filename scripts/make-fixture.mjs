import fs from 'node:fs';
import { emptyWorkspace, makeAnchor, message, newSession, uid } from '../src/core.ts';
const w=emptyWorkspace(),s=newSession('[Test fixture] Long conversation');s.example=true;
for(let i=0;i<500;i++){
  const m=message('assistant',`## Topic ${i+1}\n\nA clear explanation keeps the main thread readable. This passage explains concept ${i+1} and connects it to the learning goal. Details can be explored in an annotation without interrupting the reading order.\n\nThe original source stays available when returning from a follow-up.`);
  s.messages.push(m);const quote=`concept ${i+1}`,start=m.text.indexOf(quote);
  s.branches.push({id:uid(),parentId:null,anchor:makeAnchor(m,start,start+quote.length),messages:[message('user',`Explain concept ${i+1} in more detail`),message('assistant','This is synthetic performance-test content, not a generated model response.')],createdAt:Date.now(),sourceContext:[{role:'assistant',content:m.text}]});
}
w.sessions=[s];w.activeId=s.id;
fs.mkdirSync('docs/test-fixtures',{recursive:true});fs.writeFileSync('docs/test-fixtures/long-conversation.json',JSON.stringify(w));
console.log('Created synthetic fixture: 500 main messages, 500 annotations.');
