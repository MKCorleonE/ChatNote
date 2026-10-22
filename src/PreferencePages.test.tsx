import {test,expect,vi,beforeEach} from 'vitest';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import capability from '../src-tauri/capabilities/default.json';
const fake=vi.hoisted(()=>({openUrl:vi.fn()}));
vi.mock('./bridge',()=>({openUrl:fake.openUrl}));
import {ImproveChatNote} from './PreferencePages';

beforeEach(()=>{fake.openUrl.mockReset().mockResolvedValue(undefined);});

test('Contributor buttons open the intended profiles and desktop permissions allow both exact URLs',async()=>{
  const user=userEvent.setup(),notice=vi.fn();
  render(<ImproveChatNote onNotice={notice}/>);
  const opener=capability.permissions.find(p=>typeof p==='object'&&p.identifier==='opener:allow-open-url');
  expect(typeof opener).toBe('object');
  for(const [name,url] of [['sinpangky','https://github.com/sinpangky'],['pppp','https://github.com/pppp-PENG']]){
    await user.click(screen.getByRole('button',{name}));
    expect(fake.openUrl).toHaveBeenLastCalledWith(url);
    expect(typeof opener==='object'&&opener.allow.some(entry=>entry.url===url)).toBe(true);
  }
  expect(notice).not.toHaveBeenCalled();
});

test('An unsuccessful profile launch shows a notice without an unhandled rejection',async()=>{
  const user=userEvent.setup(),notice=vi.fn();fake.openUrl.mockRejectedValue(new Error('Launch failed'));
  render(<ImproveChatNote onNotice={notice}/>);
  await user.click(screen.getByRole('button',{name:'pppp'}));
  await waitFor(()=>expect(notice).toHaveBeenCalledWith('Could not open the website.'));
});
