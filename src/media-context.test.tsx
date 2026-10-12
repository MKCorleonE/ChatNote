import { expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { contextFor, exampleSession, message, selectContext } from './core';
import { newProfile } from './connections';
import { attachmentError, supportsDocuments, transcriptionModel, voiceProfile } from './attachments';
import { clipboardImages, prepareAttachments } from './AttachmentControls';
import { emptyWorkspace } from './core';
import { MindMap } from './MindMap';
import { buildMindMap } from './mind-map';
const storage=vi.hoisted(()=>({store:vi.fn(async()=>{})}));
vi.mock('./bridge',()=>({storeAttachment:storage.store,fileBase64:async()=> 'aQ=='}));

test('Clipboard images with empty names are normalized; text-only paste stays ordinary text',()=>{
  const png=new File(['i'],'',{type:'image/png'}),data={items:[{kind:'file',type:'image/png',getAsFile:()=>png}],files:[png]} as unknown as DataTransfer;
  const files=clipboardImages(data);expect(files).toHaveLength(1);expect(files[0].name).toMatch(/\.png$/);expect(files[0].size).toBe(1);
  expect(clipboardImages({items:[{kind:'string',type:'text/plain'}],files:[]} as unknown as DataTransfer)).toEqual([]);
});
test('File picker and clipboard validate capability and request limits before storing any bytes',async()=>{
  storage.store.mockClear();const p=newProfile('deepseek'),image=new File(['i'],'screen.png',{type:'image/png'});
  const items=await prepareAttachments([image],[],p);expect(items[0].kind).toBe('image');expect(storage.store).toHaveBeenCalledOnce();
  storage.store.mockClear();await expect(prepareAttachments([new File(['i'],'lecture.pdf')],[],p)).rejects.toThrow('DeepSeek');expect(storage.store).not.toHaveBeenCalled();
  await expect(prepareAttachments(Array.from({length:9},()=>image),[],p)).rejects.toThrow('8 attachments');expect(storage.store).not.toHaveBeenCalled();
});
test('Document and voice support follow the actual endpoint and model, not OpenAI compatibility alone',()=>{
  const q=newProfile('qwen'),d=newProfile('deepseek'),w=emptyWorkspace();q.model='qwen-long';expect(supportsDocuments(q)).toBe(true);expect(transcriptionModel(q)).toBe('qwen3-asr-flash');expect(supportsDocuments(d)).toBe(false);
  q.model='qwen-plus';expect(supportsDocuments(q)).toBe(false);q.model='qwen-long';q.endpoint='https://example.com';expect(supportsDocuments(q)).toBe(false);
  const pdf={id:crypto.randomUUID(),name:'a.pdf',mime:'application/pdf',kind:'document' as const,size:1};expect(attachmentError([pdf],d)).toContain('DeepSeek');expect(transcriptionModel(newProfile('openai'))).toBe('gpt-4o-mini-transcribe');
  const compatible=newProfile('custom');compatible.endpoint='https://api.siliconflow.cn/v1';compatible.transcriptionModel='FunAudioLLM/SenseVoiceSmall';w.settings.profiles=[d,compatible];w.settings.activeProfileId=d.id;expect(voiceProfile(w.settings)?.id).toBe(compatible.id);
});
test('Context selection excludes unchecked source and branch history while retaining exact passage and current question',()=>{
  const s=exampleSession(),b=s.branches[0];b.messages.push(message('user','CURRENT_SELECTION_QUESTION'));b.note='PRIVATE_NOTE';s.messages.push(message('user','FUTURE_MAIN'));const before=structuredClone(s),report=contextFor(s,b);
  const selected=selectContext(report,[]),payload=JSON.stringify(selected.items);expect(selected.items).toHaveLength(2);expect(payload).toContain(b.anchor.quote);expect(payload).toContain('CURRENT_SELECTION_QUESTION');expect(payload).not.toMatch(/PRIVATE_NOTE|FUTURE_MAIN/);expect(payload).not.toContain(b.messages[0].text);expect(s).toEqual(before);
  expect(selectContext(report,report.candidates!.map((_,i)=>i)).items).toEqual(report.items);
});
test('Text attachment size counts toward history budget, and unchecked attachments are absent from the request',()=>{
  const s=exampleSession();s.messages[0].attachments=[{id:crypto.randomUUID(),name:'large.txt',mime:'text/plain',kind:'text',size:10000}];s.messages.push(message('user','LATEST'));
  const report=contextFor(s,null,8000);expect(report.summarized).toBe(true);expect(report.characters).toBeLessThanOrEqual(8000);expect(report.items.flatMap(i=>i.attachments??[])).toEqual([]);
  const selected=selectContext(report,[report.candidates!.length-1]);expect(selected.summarized).toBe(false);expect(selected.items[0].content).toBe('LATEST');
});
test('Map width changes all cards, and exported maps keep resizing and shared connector geometry without scripts',()=>{
  const s=exampleSession();render(<MindMap session={s}/>);fireEvent.change(screen.getByRole('slider',{name:'Card width'}),{target:{value:'600'}});expect((document.querySelector('.map-card') as HTMLElement).style.width).toBe('600px');
  const html=buildMindMap(s,'en');expect(html).toContain('resize:horizontal');expect(html).toContain('class="mind-map"');expect(html).toContain('.map-row>ul:before');expect(html).not.toContain('<script');
});
