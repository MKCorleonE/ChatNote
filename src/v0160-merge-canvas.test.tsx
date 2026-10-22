import {expect,test,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {fireEvent,render,screen,within,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {exampleSession,emptyWorkspace,message,validateWorkspace,contextFor,makeAnchor,snapshot} from './core';
import {commitMerge,planMerge,remapMergeSessions} from './branch-merge';
import {appendThread,activeMessages,editThread,switchThreadPath} from './message-history';
import {packSession,unpackSession} from './workspace-storage';
import {applyContextSelection} from './context-preferences';
import {mapNodes,buildMindMap} from './mind-map';
import {mapGeometry,cardSize} from './map-geometry';
import offlineScript from './map-export-script.js?raw';
import {MindMap} from './MindMap';
import {MergeDialog} from './MergeDialog';
import {I18nProvider} from './I18nProvider';
import {scopedSession,sharedExport} from './export-scope';

function fixture(){const w=emptyWorkspace(),s=exampleSession();w.settings.language='en';w.sessions=[s];w.activeId=s.id;return {w,s,b:s.branches[0]};}
test('Bring-back preserves messages, anchors, notes, drafts, connections and exact snapshots across storage',()=>{
  const {w,s,b}=fixture();b.note='PRIVATE_NOTE';s.view.drafts.main='Unsent question';const before=structuredClone(w),plan=planMerge(s,[b.id],'append','en'),out=commitMerge(w,plan,[b.id],'en');
  expect(w).toEqual(before);expect(out.sessions[0].messages.slice(0,s.messages.length)).toEqual(s.messages);expect(out.settings).toEqual(w.settings);expect(out.sessions[0].branches).toEqual(s.branches);expect(out.sessions[0].view.drafts.main).toBe('Unsent question');
  expect(plan.content).toContain(b.messages[1].text);expect(plan.content).not.toContain(s.messages[0].text);expect(plan.content).not.toContain('PRIVATE_NOTE');expect(plan.content).not.toContain('Unsent question');
  const restored=unpackSession(JSON.parse(packSession(out.sessions[0])));expect(restored).toEqual(out.sessions[0]);expect(()=>validateWorkspace({...out,sessions:[restored]})).not.toThrow();expect(contextFor(restored,null).items.at(-1)?.content).toBe(plan.content);
});
test('Repeated imports are no-ops and source growth or rewriting adds only the changed continuation',()=>{
  const {w,s,b}=fixture();let out=commitMerge(w,planMerge(s,[b.id],'append','en'),[b.id],'en');let current=out.sessions[0];
  const repeat=planMerge(current,[b.id],'append','en');expect(repeat.content).toBe('');expect(commitMerge(out,repeat,[b.id],'en')).toBe(out);
  current={...current,branches:[appendThread(b,message('user','New research'),message('assistant','New finding'))]};out={...out,sessions:[current]};let plan=planMerge(current,[b.id],'append','en');expect(plan.content).toContain('New finding');expect(plan.content).not.toContain(b.messages[1].text);
  current={...current,branches:[{...current.branches[0],messages:current.branches[0].messages.map((m,i)=>i===1?{...m,revision:crypto.randomUUID(),text:'Revised finding'}:m)}]};plan=planMerge(current,[b.id],'append','en');expect(plan.content).toContain('Revised finding');expect(out.sessions[0].messages.at(-1)?.text).toContain(b.messages[1].text);
});
test('Nested sources retain the captured parent-focus context; private notes never become merge material',()=>{
 const {w,s,b}=fixture(),anchor=makeAnchor(b.messages[1],0,12),child={id:crypto.randomUUID(),parentId:b.id,anchor,messages:[message('user','Nested research'),message('assistant','Nested conclusion')],createdAt:Date.now(),sourceContext:snapshot(s,b.id,anchor),note:'PRIVATE_NESTED'};s.branches.push(child);
 const plan=planMerge(s,[b.id,child.id],'append','en');expect(plan.content.split(s.messages[0].text)).toHaveLength(1);expect(plan.content).toContain(b.messages[1].text);expect(plan.content).toContain('Nested conclusion');expect(plan.content).not.toContain('PRIVATE_NESTED');expect(()=>validateWorkspace(commitMerge(w,plan,[b.id,child.id],'en'))).not.toThrow();
});
test('New merged discussion uses independent message IDs and keeps source workspaces untouched',()=>{
 const {w,s,b}=fixture(),before=structuredClone(w),out=commitMerge(w,planMerge(s,[b.id],'new','en'),[b.id],'en'),target=out.sessions[0];expect(w).toEqual(before);expect(out.sessions[1]).toBe(s);expect(target.id).not.toBe(s.id);expect(target.messages[0].text).toBe(s.messages[0].text);expect(target.messages[0].id).not.toBe(s.messages[0].id);expect(target.messages.at(-1)?.merge?.sources[0].sessionId).toBe(s.id);expect(()=>validateWorkspace(out)).not.toThrow();
});
test('Stale previews and streaming sources are rejected, while a reverted target path allows re-import',()=>{
 const {w,s,b}=fixture(),plan=planMerge(s,[b.id],'append','en');b.messages.push(message('assistant','Changed'));expect(()=>commitMerge(w,plan,[b.id],'en')).toThrow('source changed');b.messages.at(-1)!.status='streaming';expect(()=>planMerge(s,[b.id],'append','en')).toThrow('Stop generation');b.messages.pop();
 const merged=commitMerge(w,planMerge(s,[b.id],'append','en'),[b.id],'en').sessions[0];const edited=editThread(merged,merged.messages[0].id,'Other path',message('assistant','Different answer'));expect(planMerge(edited,[b.id],'append','en').sources).toHaveLength(1);expect(planMerge(switchThreadPath(edited,activeMessages(merged)),[b.id],'append','en').sources).toHaveLength(0);
});
test('Existing context choices explicitly include the newly merged material without losing other choices',()=>{
 const {w,s,b}=fixture();s.view.contextSelections={main:[`message:${s.messages[0].id}:${s.messages[0].revision}`]};const target=commitMerge(w,planMerge(s,[b.id],'append','en'),[b.id],'en').sessions[0],report=applyContextSelection(contextFor(target,null),target.view.contextSelections?.main);expect(report.items.some(i=>i.content===target.messages.at(-1)!.text)).toBe(true);expect(target.view.contextSelections!.main[0]).toBe(s.view.contextSelections.main[0]);
});
test('Imported provenance follows remapped sessions and never resolves to an unrelated local source',()=>{
 const {w,s,b}=fixture(),out=commitMerge(w,planMerge(s,[b.id],'new','en'),[b.id],'en');const ids=new Map(out.sessions.map(s=>[s.id,crypto.randomUUID()])),imported=remapMergeSessions(out.sessions,ids);expect(imported[0].messages.at(-1)?.merge?.sources[0].sessionId).toBe(ids.get(s.id));const partial=remapMergeSessions([out.sessions[0]],new Map([[out.sessions[0].id,'copy']]));expect(partial[0].messages.at(-1)?.merge?.sources[0].sessionId).toBe('unavailable:'+s.id);
});
test('Malformed persisted canvas positions and merge snapshots fail validation',()=>{
 const {w,s,b}=fixture();s.view.map={positions:{a:{x:Infinity,y:0}},collapsed:[]};expect(()=>validateWorkspace(w)).toThrow('canvas');delete s.view.map;const out=commitMerge(w,planMerge(s,[b.id],'append','en'),[b.id],'en');out.sessions[0].messages.at(-1)!.merge!.sources[0].context[0].role='system' as 'user';expect(()=>validateWorkspace(out)).toThrow('merge sources');
});
test('Canvas layout avoids initial overlaps, persists dragging-independent positions, and draws return provenance',()=>{
 const {w,s,b}=fixture(),target=commitMerge(w,planMerge(s,[b.id],'append','en'),[b.id],'en').sessions[0],roots=mapNodes(target,'en'),g=mapGeometry(roots,target);
 for(const a of g.placed)for(const c of g.placed)if(a!==c)expect(a.x+cardSize.width<=c.x||c.x+cardSize.width<=a.x||a.y+cardSize.height<=c.y||c.y+cardSize.height<=a.y).toBe(true);
 expect(g.edges.some(e=>e.kind==='merge')).toBe(true);const view={positions:{[g.placed[0].node.id]:{x:135,y:246}},collapsed:[],camera:{x:1,y:2,zoom:.8}};expect(mapGeometry(roots,target,view).placed[0]).toMatchObject({x:135,y:246});
});
test('Canvas selection opens the default bring-back preview; zoom and arrange are saved without modifying text',async()=>{
 const {s,b}=fixture(),change=vi.fn(),merge=vi.fn(),before=structuredClone(s),user=userEvent.setup();render(<I18nProvider language="en"><MindMap session={s} onViewChange={change} onMerge={merge}/></I18nProvider>);
 await user.click(screen.getByRole('checkbox',{name:'Select follow-up: '+b.messages[0].text}));await user.click(screen.getByRole('button',{name:/Merge discussions/}));expect(merge).toHaveBeenCalledWith([b.id]);await user.click(screen.getByRole('button',{name:'Zoom in'}));expect(change.mock.calls.at(-1)![0].camera.zoom).toBeGreaterThan(.8);await user.click(screen.getByRole('button',{name:'Auto arrange'}));expect(change.mock.calls.at(-1)![0].positions).toEqual({});expect(s).toEqual(before);
});
test('Merge dialog previews the exact payload and defaults to bringing results back to main',async()=>{
 const {s,b}=fixture(),commit=vi.fn(),user=userEvent.setup();render(<I18nProvider language="en"><MergeDialog session={s} initial={[b.id]} onClose={()=>{}} onCommit={commit}/></I18nProvider>);const dialog=screen.getByRole('dialog',{name:'Merge discussions'}),buttons=within(dialog).getAllByRole('button',{name:'Bring back to main'});expect(buttons[0].getAttribute('aria-pressed')).toBe('true');await user.click(buttons[1]);expect(commit.mock.calls[0][0].content).toBe(planMerge(s,[b.id],'append','en').content);
});
test('Offline exports authorize only the trusted control script, escape injection and respect private-note scope',()=>{
 const {s}=fixture();s.title='</title><script>BAD()</script>';s.branches[0].note='SECRET_NOTE';s.view.map={positions:{},collapsed:[]};const html=buildMindMap(scopedSession(s,sharedExport),'en');expect(html).toContain("script-src 'sha256-"+createHash('sha256').update(offlineScript.replace(/\r\n/g,'\n')).digest('base64')+"'");expect(html.match(/<script>/g)).toHaveLength(1);expect(html).not.toContain('SECRET_NOTE');expect(html).not.toContain('<script>BAD');expect(html).not.toMatch(/src="https?:|onerror=|<iframe/);expect(html).toContain('prefers-reduced-motion');expect(html).toContain('offline-transcript');
});
test('Exported controls open details, zoom and return to the canvas without remote dependencies',()=>{
 const {s}=fixture(),html=buildMindMap(s,'en'),doc=new DOMParser().parseFromString(html,'text/html'),previous=document.body.innerHTML;
 try{document.body.replaceChildren(...[...doc.body.children].filter(el=>el.tagName!=='SCRIPT'));new Function(offlineScript)();const open=document.querySelector('.canvas-node.branch .canvas-node-open')!;fireEvent.click(open);const panel=document.querySelector('.map-inspector') as HTMLElement;expect(panel.hidden).toBe(false);expect(panel.textContent).toContain('Matching relationships do not have to be symmetric.');const before=document.querySelector('output')!.textContent;fireEvent.click(document.querySelector('[data-action="in"]')!);expect(document.querySelector('output')!.textContent).not.toBe(before);fireEvent.click(document.querySelector('[data-action="close"]')!);expect(panel.hidden).toBe(true);}finally{document.body.innerHTML=previous;document.documentElement.classList.remove('map-js');}
});


test('A narrow resized viewport fits saved desktop positions instead of leaving cards off screen',async()=>{
 const {s}=fixture();s.view.map={positions:{},collapsed:[],camera:{x:900,y:10,zoom:1}};const save=vi.fn();render(<I18nProvider language="en"><MindMap session={s} onViewChange={save}/></I18nProvider>);
 const viewport=screen.getByRole('region',{name:'Discussion canvas'});Object.defineProperty(viewport,'clientWidth',{configurable:true,value:390});Object.defineProperty(viewport,'clientHeight',{configurable:true,value:600});fireEvent(window,new Event('resize'));
 await waitFor(()=>expect(save).toHaveBeenCalled());const camera=save.mock.calls.at(-1)![0].camera;expect(camera.x).toBeLessThan(390);expect(camera.zoom).toBeLessThan(1);
});
