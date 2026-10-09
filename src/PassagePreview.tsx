import { memo, useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { normalizeMath } from './source';

// Render the complete quote; clipping is visual only, so math delimiters stay intact.
export const PassagePreview=memo(function PassagePreview({text,compact=false}:{text:string;compact?:boolean}) {
  const normalized=useMemo(()=>normalizeMath(text).text,[text]);
  return <div className={`passage-preview ${compact?'compact':''}`}><Markdown remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[[rehypeKatex,{strict:'ignore',trust:false}]]} components={{a:({children})=><span>{children}</span>,img:({alt})=><span>{alt}</span>}}>{normalized}</Markdown></div>;
});
