// Presentation normalization never changes the persisted Markdown or its anchor offsets.
export function normalizeMath(source: string) {
  let text='', i=0;const offsets:number[]=[0];
  const copy=(end:number)=>{while(i<end){text+=source[i++];offsets.push(i);}};
  const replace=(value:string,end:number)=>{const start=i;for(let j=0;j<value.length;j++){text+=value[j];offsets.push(start+Math.min(end-start,j+1));}i=end;offsets[offsets.length-1]=end;};
  while(i<source.length){
    const fence=(i===0||source[i-1]==='\n')?source.slice(i).match(/^ {0,3}(`{3,}|~{3,})[^\n]*\n/):null;
    if(fence){const run=fence[1],close=new RegExp(`^ {0,3}${run[0]}{${run.length},}[^\\n]*(?:\\n|$)`,'gm');close.lastIndex=i+fence[0].length;const found=close.exec(source);copy(found?found.index+found[0].length:source.length);continue;}
    if(source[i]==='`'){const run=source.slice(i).match(/^`+/)![0],end=source.indexOf(run,i+run.length);copy(end<0?i+run.length:end+run.length);continue;}
    if(source[i]==='\\'&&(source[i+1]==='('||source[i+1]==='[')&&(i===0||source[i-1]!=='\\')){
      const display=source[i+1]==='[',close=display?'\\]':'\\)',end=source.indexOf(close,i+2);
      if(end>=0){replace(display?'$$\n':'$',i+2);copy(end);replace(display?'\n$$':'$',end+2);continue;}
    }
    copy(i+1);
  }
  return{text,offsets};
}

export function selectedSource(range: Range, root: HTMLElement): {start:number;end:number}|null {
  const element=(node:Node)=>node.nodeType===Node.ELEMENT_NODE?node as Element:node.parentElement;
  function boundary(container:Node,offset:number,end:boolean){
    const atomic=element(container)?.closest<HTMLElement>('[data-source-atomic]');
    if(atomic&&root.contains(atomic))return Number(end?atomic.dataset.sourceEnd:atomic.dataset.sourceStart);
    let leaf=element(container)?.closest<HTMLElement>('[data-source-start]');
    if(!leaf||!root.contains(leaf)){
      const leaves=[...root.querySelectorAll<HTMLElement>('[data-source-start]')].filter(el=>range.intersectsNode(el));
      leaf=end?leaves.at(-1)??null:leaves[0]??null;
      if(!leaf)return null;return Number(end?leaf.dataset.sourceEnd:leaf.dataset.sourceStart);
    }
    if(container.nodeType!==Node.TEXT_NODE)return Number(end?leaf.dataset.sourceEnd:leaf.dataset.sourceStart);
    const map=leaf.dataset.sourceMap?.split(',').map(Number);return map?map[offset]??null:Number(leaf.dataset.sourceStart)+offset;
  }
  const start=boundary(range.startContainer,range.startOffset,false),end=boundary(range.endContainer,range.endOffset,true);
  return start===null||end===null||!Number.isFinite(start)||!Number.isFinite(end)||end<=start?null:{start,end};
}

// Build a DOM range from persisted source offsets, including escaped Markdown and math.
export function sourceRange(root:HTMLElement, start:number, end:number):Range|null {
  const leaves=[...root.querySelectorAll<HTMLElement>('[data-source-start]')].filter(el=>Number(el.dataset.sourceStart)<end&&Number(el.dataset.sourceEnd)>start);
  if(!leaves.length)return null;
  const range=document.createRange();
  const boundary=(leaf:HTMLElement, offset:number, last:boolean)=>{
    if(leaf.dataset.sourceAtomic){if(last)range.setEndAfter(leaf);else range.setStartBefore(leaf);return;}
    const map=leaf.dataset.sourceMap?.split(',').map(Number);
    const index=map?(last?map.reduce((found,n,i)=>n<=offset?i:found,0):map.findIndex(n=>n>=offset)):offset-Number(leaf.dataset.sourceStart);
    const node=leaf.firstChild;
    // Source spans can contain a mark and its tooltip. Use the rendered text only.
    const text=node?.nodeType===Node.TEXT_NODE?node:leaf.querySelector('mark')?.firstChild;
    if(text?.nodeType===Node.TEXT_NODE){const pos=Math.max(0,Math.min(text.textContent?.length??0,index));if(last)range.setEnd(text,pos);else range.setStart(text,pos);}
    else if(last)range.setEndAfter(leaf);else range.setStartBefore(leaf);
  };
  boundary(leaves[0],start,false);boundary(leaves.at(-1)!,end,true);
  return range;
}
