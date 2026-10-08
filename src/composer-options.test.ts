import { test, expect } from 'vitest';
import { supportedEfforts, clampPanel } from './composer-options';
import { emptyWorkspace, validateWorkspace } from './core';

test('Reasoning controls use account capabilities and never send OpenAI options to compatible providers', () => {
  expect(supportedEfforts('chatgpt', 'gpt-5.6-sol')).toContain('none');
  expect(supportedEfforts('chatgpt', 'gpt-6.1-sol')).not.toContain('none');
  expect(supportedEfforts('chatgpt', 'gpt-6.1-sol', [{id:'gpt-6.1-sol',name:'Sol',reasoningEfforts:['low','high']}])).toEqual(['low','high']);
  expect(supportedEfforts('compatible','gpt-6.1-sol')).toEqual([]);
  expect(supportedEfforts('openai','unknown-model')).toEqual([]);
});
test('Dragging is bounded to retain a readable main column on narrow desktop windows', () => {
  expect(clampPanel(760, 1024)).toBe(542);
  expect(clampPanel(240, 1440)).toBe(300);
  expect(clampPanel(500, 1440)).toBe(500);
});
test('Old backups remain valid and invalid appearance or effort settings cannot be imported', () => {
  const old=emptyWorkspace(); expect(()=>validateWorkspace(old)).not.toThrow();
  expect(()=>validateWorkspace({...old,settings:{...old.settings,panelWidth:9000}})).toThrow('Invalid panel width');
  expect(()=>validateWorkspace({...old,settings:{...old.settings,composerGlow:{enabled:true,colorA:'url(evil)',colorB:'#123456',brightness:30,seconds:7}}})).toThrow('Invalid input glow');
});
