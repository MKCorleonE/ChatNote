import { expect,test } from 'vitest';
import { emptyWorkspace,exampleSession,validateWorkspace } from './core';
import { highlightStyle } from './annotation-style';

test('Highlighter preferences round trip as optional metadata while original source and connection records stay intact',()=>{
  const w=emptyWorkspace();w.sessions=[exampleSession()];w.activeId=w.sessions[0].id;const original=structuredClone(w);
  for(const opacity of [0,37,100]){
    w.settings.annotationHighlight={color:'pink',opacity};const restored=JSON.parse(JSON.stringify(w));expect(()=>validateWorkspace(restored)).not.toThrow();expect(restored.sessions).toEqual(original.sessions);expect(restored.settings.profiles).toEqual(original.settings.profiles);
  }
  expect(highlightStyle(w.settings)['--annotation-highlight']).toBe('rgba(244,151,191,1)');
  expect(()=>validateWorkspace({...w,settings:{...w.settings,annotationHighlight:{color:'#ffffff',opacity:30}}})).toThrow('Invalid annotation highlight');
  expect(()=>validateWorkspace({...w,settings:{...w.settings,annotationHighlight:{color:'pink',opacity:101}}})).toThrow('Invalid annotation highlight');
  delete w.settings.annotationHighlight;expect(()=>validateWorkspace(w)).not.toThrow();
});
