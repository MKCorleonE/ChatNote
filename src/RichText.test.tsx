import {test,expect,vi} from 'vitest';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {RichText} from './RichText';
import {message,exampleSession} from './core';
import {selectedSource,normalizeMath} from './source';

test('ChatGPT math delimiters render while original source offsets remain unchanged',async()=>{
  const raw='Before \\(x_1 + y_2\\) and after.\n\n\\[\\frac{a}{b}=c\\]\n\n```python\nprint("\\(not math\\)")\n```';
  const m=message('assistant',raw),select=vi.fn();render(<RichText message={m} branches={[]} enabled onOpen={()=>{}} onSelectBlock={select}/>);
  expect(document.querySelectorAll('.katex')).toHaveLength(2);expect(m.text).toBe(raw);
  const user=userEvent.setup();const buttons=screen.getAllByRole('button',{name:'Annotate formula'});expect(buttons).toHaveLength(2);
  await user.click(buttons[0]);const [,start,end]=select.mock.calls[0];expect(raw.slice(start,end)).toBe('\\(x_1 + y_2\\)');
  await user.click(screen.getByRole('button',{name:'Annotate code'}));const [,cs,ce]=select.mock.calls.at(-1)!;expect(raw.slice(cs,ce)).toContain('```python');expect(raw.slice(cs,ce)).toContain('print');
});
test('Cross-format and cross-paragraph selections map to exact original Markdown',()=>{
  const raw='A **bold detail** and *italic ending*.\n\nSecond paragraph.';const m=message('assistant',raw);render(<RichText message={m} branches={[]} enabled onOpen={()=>{}}/>);
  const spans=[...document.querySelectorAll<HTMLElement>('[data-source-start]')].filter(el=>el.firstChild?.nodeType===Node.TEXT_NODE);
  const first=spans.find(el=>el.textContent==='bold detail')!,last=spans.find(el=>el.textContent==='Second paragraph.')!;
  const range=document.createRange();range.setStart(first.firstChild!,0);range.setEnd(last.firstChild!,6);
  const bounds=selectedSource(range,document.querySelector('.rich-text')! as HTMLElement)!;
  expect(raw.slice(bounds.start,bounds.end)).toBe('bold detail** and *italic ending*.\n\nSecond');
});
test('Inline code remains literal and normalization preserves every content boundary',()=>{
  const raw='`\\(literal\\)` then \\(z\\).';const normalized=normalizeMath(raw);expect(normalized.text).toBe('`\\(literal\\)` then $z$.');
  const at=normalized.text.indexOf('z');expect(raw[normalized.offsets[at]]).toBe('z');expect(normalized.offsets.at(-1)).toBe(raw.length);
});

test('Annotation hover counts rounds, truncates the first question and leaves source selection and opening intact',async()=>{
 const s=exampleSession(),b=s.branches[0],m=s.messages[1];b.messages[0].text='🧠'+('First question '.repeat(4));b.messages.push(message('user','Another question'),message('assistant','Another answer'));const original=m.text,open=vi.fn(),user=userEvent.setup();render(<RichText message={m} branches={s.branches} enabled onOpen={open}/>);const mark=document.querySelector('mark')!;expect(mark.hasAttribute('title')).toBe(false);await user.hover(mark);const tooltip=await screen.findByRole('tooltip');expect(tooltip.textContent).toBe('2 follow-up questions'+Array.from(b.messages[0].text.trim()).slice(0,18).join('')+'…');expect(document.querySelector('.rich-text')!.contains(tooltip)).toBe(false);
 const range=document.createRange();range.selectNodeContents(mark);const bounds=selectedSource(range,document.querySelector('.rich-text')! as HTMLElement)!;expect(m.text.slice(bounds.start,bounds.end)).toBe(mark.textContent);expect(m.text).toBe(original);await user.click(mark);expect(open).toHaveBeenCalledWith(b.id);await user.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('tooltip')).toBeNull());
});
