import { vi,test,expect,beforeEach } from 'vitest';
import { render,screen,waitFor,within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { defaultSettings } from './core';
import { migrateConnections } from './connections';
import type { ConnectionProfile,Settings as Config } from './types';
const fake=vi.hoisted(()=>({keys:new Map<string,{key:string;endpoint:string}>(),models:vi.fn(),usage:vi.fn(),generate:vi.fn(),setKey:vi.fn(),signIn:vi.fn(),cancelSignIn:vi.fn(),checkSignInService:vi.fn()}));
vi.mock('./bridge',()=>({desktop:true,profileStatus:async(p:ConnectionProfile)=>({hasKey:fake.keys.has(p.id),endpointMatches:!fake.keys.has(p.id)||fake.keys.get(p.id)!.endpoint===p.endpoint,connected:p.provider==='chatgpt'||fake.keys.has(p.id),planUsage:p.provider==='chatgpt',email:p.provider==='chatgpt'?'test@example.invalid':undefined}),setKey:async(provider:string,key:string,endpoint:string,id:string)=>{fake.setKey(provider,key,endpoint,id);if(key)fake.keys.set(id,{key,endpoint});else fake.keys.delete(id);},models:(...args:unknown[])=>fake.models(...args),usage:(...args:unknown[])=>fake.usage(...args),generate:fake.generate,openUrl:vi.fn(),signIn:fake.signIn,cancelSignIn:fake.cancelSignIn,checkSignInService:fake.checkSignInService,signOut:vi.fn()}));
import Settings from './Settings';
import { exampleSession } from './core';

test('Privacy, experiments and contribution contacts are available; recycle bin deletion requires explicit confirmation',async()=>{
 const user=userEvent.setup(),restored=vi.fn(),purged=vi.fn(async()=>{}),entry={session:exampleSession(),deletedAt:Date.now()};render(<Settings value={migrateConnections(defaultSettings)} trash={[entry]} onRestore={restored} onPurge={purged} onChange={()=>{}} onClose={()=>{}} onNotice={()=>{}}/>);
 await user.click(screen.getByRole('button',{name:'Privacy'}));expect(screen.getByRole('heading',{name:'Privacy policy'})).toBeDefined();expect(screen.getByText('5. Retention and deletion')).toBeDefined();await user.click(screen.getByRole('button',{name:'Laboratory'}));expect(screen.getByText('Experimental features coming soon')).toBeDefined();await user.click(screen.getByRole('button',{name:'Improve ChatNote together'}));expect(screen.getByRole('heading',{name:'Suggestions & feedback'})).toBeDefined();expect(screen.getByRole('heading',{name:'Join the development plan'})).toBeDefined();expect(screen.getByText('529023573@qq.com')).toBeDefined();expect(screen.getByText('1006863642')).toBeDefined();
 await user.click(screen.getByRole('button',{name:'Recycle bin'}));await user.click(screen.getByRole('checkbox',{name:'Select conversation: '+entry.session.title}));await user.click(screen.getByRole('button',{name:'Delete selected now'}));expect(purged).not.toHaveBeenCalled();await user.click(within(screen.getByRole('dialog',{name:'Permanently delete conversations?'})).getByRole('button',{name:'Cancel'}));expect(purged).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'Delete selected now'}));await user.click(within(screen.getByRole('dialog',{name:'Permanently delete conversations?'})).getByRole('button',{name:'Delete'}));await waitFor(()=>expect(purged).toHaveBeenCalledWith([entry.session.id]));await user.click(screen.getByRole('button',{name:'Empty recycle bin'}));await user.click(within(screen.getByRole('dialog',{name:'Permanently delete conversations?'})).getByRole('button',{name:'Delete'}));await waitFor(()=>expect(purged).toHaveBeenCalledTimes(2));expect(fake.generate).not.toHaveBeenCalled();
});

test('Follow system saves a compatible fallback and switching to an explicit theme clears it without inference',async()=>{
  const saved=vi.fn(),user=userEvent.setup();render(<Settings value={migrateConnections(defaultSettings)} onChange={saved} onClose={()=>{}} onNotice={()=>{}}/>);
  await user.click(screen.getByRole('button',{name:'Appearance'}));await user.click(screen.getByRole('combobox',{name:'Theme'}));
  await user.click(screen.getByRole('option',{name:'Follow system'}));await user.click(screen.getByRole('button',{name:'Done'}));
  await waitFor(()=>expect(saved.mock.calls.at(-1)?.[0].followSystemTheme).toBe(true));expect(['dark','light']).toContain(saved.mock.calls.at(-1)![0].theme);
  await user.click(screen.getByRole('combobox',{name:'Theme'}));await user.click(screen.getByRole('option',{name:'Light'}));await user.click(screen.getByRole('button',{name:'Done'}));
  await waitFor(()=>expect(saved.mock.calls.at(-1)?.[0].followSystemTheme).toBe(false));expect(saved.mock.calls.at(-1)![0].theme).toBe('light');expect(fake.generate).not.toHaveBeenCalled();
});

test('Appearance choices, RGB reset, capsule switch and annotation style save as metadata without inference',async()=>{
  const user=userEvent.setup(),saved=vi.fn(),value=migrateConnections({...defaultSettings,composerGlow:{enabled:true,colorA:'#123456',colorB:'#654321',brightness:60,seconds:9}});
  render(<Settings value={value} onChange={saved} onClose={()=>{}} onNotice={()=>{}}/>);await user.click(screen.getByRole('button',{name:'Appearance'}));
  await user.click(screen.getByRole('switch',{name:'Ambient lighting'}));expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  await user.click(screen.getByRole('button',{name:'Glow color 1'}));expect(screen.getByRole('slider',{name:'Glow color 1 · Red'})).toBeDefined();await user.keyboard('{Escape}');expect(screen.queryByRole('group',{name:'Glow color 1'})).toBeNull();
  await user.click(screen.getByRole('button',{name:'Restore default colors'}));await user.click(screen.getByRole('button',{name:'Pink'}));
  const slider=screen.getByRole('slider',{name:'Highlight opacity'});slider.focus();await user.keyboard('{ArrowRight}');
  await user.click(screen.getByRole('button',{name:'Done'}));await waitFor(()=>expect(saved).toHaveBeenCalled());
  const config=saved.mock.calls.at(-1)![0];expect(config.composerGlow).toEqual({enabled:false,colorA:'#89d9c1',colorB:'#9c8cef',brightness:60,seconds:9});expect(config.annotationHighlight.color).toBe('pink');expect(fake.generate).not.toHaveBeenCalled();
});

test('Settings navigation retains edits across pages and saves them without inference or exposing credentials',async()=>{
  const user=userEvent.setup(),value=migrateConnections(defaultSettings),original=structuredClone(value),saved=vi.fn();
  render(<Settings value={value} onChange={saved} onClose={()=>{}} onNotice={()=>{}}/>);
  await user.clear(screen.getByLabelText('Connection name'));await user.type(screen.getByLabelText('Connection name'),'My connection');
  await user.type(screen.getByLabelText('API key'),'UNSAVED_TEST_KEY');
  await user.click(screen.getByRole('button',{name:'Reading & context'}));
  await user.click(screen.getByRole('combobox',{name:'Context budget'}));await user.click(screen.getByRole('option',{name:'96,000 characters'}));
  await user.click(screen.getByRole('button',{name:'Appearance'}));
  await user.click(screen.getByRole('combobox',{name:'Theme'}));await user.click(screen.getByRole('option',{name:'Light'}));
  await user.click(screen.getByRole('button',{name:'Models & connections'}));
  expect((screen.getByLabelText('Connection name') as HTMLInputElement).value).toBe('My connection');
  expect((screen.getByLabelText('API key') as HTMLInputElement).value).toBe('UNSAVED_TEST_KEY');
  expect(value).toEqual(original);expect(saved).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button',{name:'Done'}));
  await waitFor(()=>expect(saved.mock.calls.at(-1)?.[0].theme).toBe('light'));
  expect(saved.mock.calls.at(-1)?.[0].contextBudget).toBe(96000);
  expect(JSON.stringify(saved.mock.calls)).not.toContain('UNSAVED_TEST_KEY');expect(fake.generate).not.toHaveBeenCalled();
});

test('Data actions, about, local release history and searchable original license notices are reachable',async()=>{
  const user=userEvent.setup(),backup=vi.fn(),restore=vi.fn();
  render(<Settings value={migrateConnections(defaultSettings)} onChange={()=>{}} onClose={()=>{}} onNotice={()=>{}} onBackup={backup} onImport={restore}/>);
  await user.click(screen.getByRole('button',{name:'Data & backups'}));
  await user.click(screen.getByRole('button',{name:'Back up workspace'}));await user.click(screen.getByRole('button',{name:'Import backup'}));
  expect(backup).toHaveBeenCalledTimes(1);expect(restore).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button',{name:'About'}));await user.click(screen.getByRole('button',{name:'View changelog'}));
  expect(screen.getByRole('heading',{name:'Capsule sidebar & clearer settings'})).toBeDefined();
  await user.click(screen.getByRole('button',{name:'Open-source licenses'}));
  await user.type(await screen.findByRole('textbox',{name:'Search licenses'}),'lucide-react');
  const list=document.querySelector('.license-list')!;
  expect(list.querySelectorAll('details')).toHaveLength(1);expect(list.textContent).toContain('ISC');expect(list.textContent).toContain('Permission');
  expect(within(screen.getByRole('navigation',{name:'Settings navigation'})).getByRole('button',{name:'Open-source licenses'}).getAttribute('aria-current')).toBe('page');
  expect(fake.generate).not.toHaveBeenCalled();expect(fake.models).not.toHaveBeenCalled();expect(fake.usage).not.toHaveBeenCalled();
});

test('Settings traps keyboard focus, Escape closes, and unmount restores the trigger',async()=>{
  const user=userEvent.setup(),close=vi.fn();const trigger=document.createElement('button');document.body.append(trigger);trigger.focus();
  const view=render(<Settings value={migrateConnections(defaultSettings)} onChange={()=>{}} onClose={close} onNotice={()=>{}}/>);
  expect(document.activeElement).toBe(screen.getByRole('button',{name:'Close settings'}));
  await user.tab({shift:true});expect(document.activeElement).toBe(screen.getByRole('button',{name:'Done'}));
  await user.tab();expect(document.activeElement).toBe(screen.getByRole('button',{name:'Close settings'}));
  await user.keyboard('{Escape}');expect(close).toHaveBeenCalledTimes(1);view.unmount();expect(document.activeElement).toBe(trigger);trigger.remove();
});
test('A stalled browser sign-in can be cancelled and retried without replacing connection metadata',async()=>{
  const user=userEvent.setup(),value=migrateConnections({...defaultSettings,provider:'chatgpt'}),original=structuredClone(value),saved=vi.fn();
  let rejectAttempt:(reason:string)=>void=()=>{};
  fake.signIn.mockImplementationOnce(()=>new Promise((_,reject)=>{rejectAttempt=reject;})).mockResolvedValueOnce({chatgpt:true});
  fake.cancelSignIn.mockImplementation(async()=>{rejectAttempt('Sign-in was cancelled. Your previous connection was kept.');});
  render(<Settings value={value} onChange={saved} onClose={()=>{}} onNotice={()=>{}}/>);
  await user.click(screen.getByRole('button',{name:'Continue with ChatGPT'}));await screen.findByText('Waiting for browser authorization…');
  await user.click(screen.getByRole('button',{name:'Cancel sign-in'}));await screen.findByText('Sign-in cancelled');
  expect(fake.cancelSignIn).toHaveBeenCalledTimes(1);expect(saved).not.toHaveBeenCalled();expect(value).toEqual(original);
  await user.click(screen.getByRole('button',{name:'Continue with ChatGPT'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Continue with ChatGPT'}).hasAttribute('disabled')).toBe(false));
  expect(fake.signIn).toHaveBeenCalledTimes(2);expect(fake.signIn).toHaveBeenLastCalledWith(false,'en');expect(fake.generate).not.toHaveBeenCalled();
});
test('The sign-in connection check reports reachability without credentials, inference or sign-in',async()=>{
  const user=userEvent.setup(),saved=vi.fn();fake.checkSignInService.mockResolvedValue('Sign-in service is reachable. Browser authorization can still fail independently.');
  render(<Settings value={migrateConnections({...defaultSettings,provider:'chatgpt'})} onChange={saved} onClose={()=>{}} onNotice={()=>{}}/>);
  await user.click(screen.getByRole('button',{name:'Check sign-in connection'}));await screen.findByText('Sign-in service is reachable. Browser authorization can still fail independently.');
  expect(fake.checkSignInService).toHaveBeenCalledTimes(1);expect(fake.signIn).not.toHaveBeenCalled();expect(fake.generate).not.toHaveBeenCalled();expect(saved).not.toHaveBeenCalled();
});
beforeEach(()=>{fake.keys.clear();vi.clearAllMocks();fake.models.mockResolvedValue([{id:'qwen-test',name:'Qwen test'}]);fake.usage.mockResolvedValue({kind:'balance',available:true,balances:[{currency:'CNY',total:'12.34',granted:'2.00',toppedUp:'10.34'}],url:'https://platform.deepseek.com/usage',checkedAt:Date.now()});});
test('DeepSeek and Qwen save separate keys, keep models and activate with one action',async()=>{const user=userEvent.setup(),saved:Config[]=[];render(<Settings value={migrateConnections({...defaultSettings,provider:'chatgpt',model:'existing-plan-model'})} onChange={s=>{saved.push(structuredClone(s));}} onClose={()=>{}} onNotice={()=>{}}/>);await user.click(screen.getByRole('button',{name:/Add connection/}));await user.type(screen.getByLabelText('API key'),'fake-deepseek-key');await user.click(screen.getByRole('button',{name:'Save key'}));await waitFor(()=>expect(fake.setKey).toHaveBeenCalledTimes(1));await user.click(screen.getByRole('combobox',{name:'Connection preset'}));await user.click(screen.getByRole('option',{name:'Qwen · Alibaba Model Studio'}));await user.click(screen.getByRole('button',{name:/Add connection/}));await user.type(screen.getByLabelText('API key'),'fake-qwen-key');await user.type(screen.getByLabelText('Model'),'qwen-test');await user.click(screen.getByRole('button',{name:'Save key'}));await waitFor(()=>expect(fake.setKey).toHaveBeenCalledTimes(2));expect(fake.keys.size).toBe(2);expect([...fake.keys.values()].map(x=>x.key).sort()).toEqual(['fake-deepseek-key','fake-qwen-key']);await user.click(screen.getByRole('button',{name:'Use this connection'}));await waitFor(()=>expect(saved.at(-1)?.model).toBe('qwen-test'));await user.click(screen.getByRole('button',{name:/^DeepSeek/}));expect((screen.getByLabelText('Model')as HTMLInputElement).value).toBe('deepseek-flash');expect((screen.getByLabelText('API key')as HTMLInputElement).value).toBe('');expect(fake.generate).not.toHaveBeenCalled();expect(JSON.stringify(saved)).not.toContain('fake-deepseek-key');});
test('Catalog check and balance refresh do not call inference or fabricate token allowance',async()=>{const user=userEvent.setup();render(<Settings value={migrateConnections({...defaultSettings,provider:'chatgpt'})} onChange={()=>{}} onClose={()=>{}} onNotice={()=>{}}/>);await screen.findByText('Account connected · plan permission enabled');await user.click(screen.getByRole('button',{name:'Refresh models'}));await screen.findByText(/Authentication checked/);expect(fake.generate).not.toHaveBeenCalled();expect(screen.getByText(/Remaining five-hour/)).toBeDefined();await user.click(screen.getByRole('button',{name:/Add connection/}));await user.type(screen.getByLabelText('API key'),'fake-key');await user.click(screen.getByRole('button',{name:'Save key'}));await screen.findByText('Key saved securely');await user.click(screen.getByRole('button',{name:'Refresh balance'}));await screen.findByText('CNY 12.34');expect(screen.getByText(/Balance is money/)).toBeDefined();expect(fake.generate).not.toHaveBeenCalled();});
test('Provider errors keep the saved key and show a useful recovery explanation',async()=>{fake.models.mockRejectedValue('HTTP 429 [subscription_sharing_usage_limit_exceeded] · App allowance reached');const user=userEvent.setup();render(<Settings value={migrateConnections({...defaultSettings,provider:'chatgpt'})} onChange={()=>{}} onClose={()=>{}} onNotice={()=>{}}/>);await screen.findByText('Account connected · plan permission enabled');await user.click(screen.getByRole('button',{name:'Refresh models'}));await screen.findByRole('alert');expect(screen.getAllByText('Usage limit reached').length).toBeGreaterThan(0);expect(screen.getByText(/No automatic billing fallback/)).toBeDefined();expect(fake.generate).not.toHaveBeenCalled();});
