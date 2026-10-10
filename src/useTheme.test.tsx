import { renderHook,act } from '@testing-library/react';
import { afterEach,expect,test,vi } from 'vitest';
import { useTheme } from './useTheme';
import { emptyWorkspace,exampleSession,validateWorkspace } from './core';
import type { Settings } from './types';

afterEach(()=>vi.unstubAllGlobals());
test('System theme responds to OS changes without mutating settings and unsubscribes on explicit choice',()=>{
  const change=new EventTarget(),preference={matches:true,addEventListener:change.addEventListener.bind(change),removeEventListener:vi.fn(change.removeEventListener.bind(change))};
  vi.stubGlobal('matchMedia',vi.fn(()=>preference));
  const settings={theme:'light',followSystemTheme:true} as Settings,original=structuredClone(settings);
  const view=renderHook(({value})=>useTheme(value),{initialProps:{value:settings}});
  expect(document.documentElement.dataset.theme).toBe('dark');
  act(()=>{preference.matches=false;change.dispatchEvent(new Event('change'));});expect(document.documentElement.dataset.theme).toBe('light');expect(settings).toEqual(original);
  view.rerender({value:{...settings,theme:'dark',followSystemTheme:false}});expect(preference.removeEventListener).toHaveBeenCalled();
  act(()=>{preference.matches=false;change.dispatchEvent(new Event('change'));});expect(document.documentElement.dataset.theme).toBe('dark');
  view.rerender({value:settings});view.unmount();expect(preference.removeEventListener).toHaveBeenCalledTimes(2);
});
test('Following the system persists as optional metadata while keeping the legacy theme valid and conversation records unchanged',()=>{
  const workspace=emptyWorkspace();workspace.sessions=[exampleSession()];workspace.activeId=workspace.sessions[0].id;const original=structuredClone(workspace);
  workspace.settings.followSystemTheme=true;const loaded=JSON.parse(JSON.stringify(workspace));expect(()=>validateWorkspace(loaded)).not.toThrow();
  expect(['dark','light']).toContain(loaded.settings.theme);expect(loaded.sessions).toEqual(original.sessions);expect(loaded.settings.profiles).toEqual(original.settings.profiles);
  expect(()=>validateWorkspace({...loaded,settings:{...loaded.settings,followSystemTheme:'true'}})).toThrow('Invalid settings');
  delete loaded.settings.followSystemTheme;expect(()=>validateWorkspace(loaded)).not.toThrow();
});
