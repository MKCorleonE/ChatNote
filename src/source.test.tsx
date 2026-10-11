import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { RichText } from './RichText';
import { sourceRange } from './source';
import { message, makeAnchor } from './core';
import type { Branch } from './types';
import { normalizeMath } from './source';

test('Inline display delimiters do not consume following headings and malformed math falls back without red prose',()=>{
  const text='2. Formula\n\n$$x=\\frac{-b+\\sqrt{b^2-4ac}}{2a}$$\n\n注意是 $-b$，不是 $b$。\n\n## Practice\n\n1. Solve $x^2-7x+12=0$.\n\n$$\\notACommand{x}$$\n\n## End\n\nOrdinary prose.\n\n$$ unmatched';
  const m=message('assistant',text),{container}=render(<RichText message={m} branches={[]} enabled onOpen={()=>{}}/>);
  expect(container.querySelector('.katex-error')).toBeNull();expect(container.querySelector('.math-fallback')).not.toBeNull();expect([...container.querySelectorAll('h2')].map(el=>el.textContent)).toEqual(['Practice','End']);expect(container.textContent).toContain('Ordinary prose.');expect(container.textContent).toContain('$$ unmatched');expect(m.text).toBe(text);
  const normalized=normalizeMath(text);expect(normalized.offsets).toHaveLength(normalized.text.length+1);expect(normalized.offsets.at(-1)).toBe(text.length);expect(normalized.offsets.every((value,i)=>i===0||value>=normalized.offsets[i-1])).toBe(true);
});

test('Source navigation selects the exact text across Markdown spans and escaped punctuation',()=>{
  const m=message('assistant','First paragraph.\n\nLong **marked** paragraph with escaped \\* and a precise target near its end.');
  const start=m.text.indexOf('marked'),end=m.text.indexOf(' target')+7;
  const anchor=makeAnchor(m,start,end),branch:Branch={id:'b',parentId:null,anchor,messages:[],sourceContext:[],createdAt:0};
  const {container}=render(<RichText message={m} branches={[branch]} enabled onOpen={()=>{}}/>);
  const range=sourceRange(container,start,end)!;
  expect(range.toString()).toBe('marked paragraph with escaped * and a precise target');
  expect(range.toString()).not.toContain('First paragraph');
});

test('Source navigation returns a whole rendered formula with its original mapped offsets',()=>{
  const m=message('assistant','Text before.\n\n\\[x^2 + y^2\\]\n\nText after.'),start=m.text.indexOf('\\['),end=m.text.indexOf('\\]')+2;
  const {container}=render(<RichText message={m} branches={[]} enabled onOpen={()=>{}}/>);
  const range=sourceRange(container,start,end)!;
  expect(range.cloneContents().querySelector('.katex')).not.toBeNull();
  expect(range.toString()).not.toContain('Text before');
  expect(sourceRange(container,200,210)).toBeNull();
});
