import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { RichText } from './RichText';
import { sourceRange } from './source';
import { message, makeAnchor } from './core';
import type { Branch } from './types';

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
