(function (root) {
  'use strict';
  function segments(text, annotations) {
    const ranges = annotations.filter(a => Number.isInteger(a.start) && Number.isInteger(a.end) && a.start >= 0 && a.end <= text.length && a.end > a.start);
    const points = [...new Set([0, text.length, ...ranges.flatMap(a => [a.start, a.end])])].sort((a,b) => a-b);
    return points.slice(0,-1).map((start,i) => ({start, end:points[i+1], text:text.slice(start,points[i+1]), ids:ranges.filter(a => a.start <= start && a.end >= points[i+1]).map(a=>a.id)}));
  }
  function sourceText(state, anchor) {
    if (anchor.kind === 'main') return state.messages.flatMap(m=>m.blocks||[]).find(b=>b.id===anchor.blockId)?.text;
    return state.branches.flatMap(b=>b.messages).find(m=>m.id===anchor.blockId && m.role==='assistant')?.text;
  }
  function anchorValid(state, anchor) {
    const text = sourceText(state,anchor);
    return typeof text==='string' && Number.isInteger(anchor.start) && Number.isInteger(anchor.end) && anchor.start >= 0 && anchor.end > anchor.start && anchor.end <= text.length && text.slice(anchor.start,anchor.end)===anchor.quote;
  }
  function ancestry(branches,id) {
    const path=[],seen=new Set();let current=branches.find(b=>b.id===id);
    while(current) {if(seen.has(current.id)) throw new Error('循环父子关系');seen.add(current.id);path.unshift(current.id);current=branches.find(b=>b.id===current.parentId);}
    return path;
  }
  function validState(state) {
    if (!state || state.version!==1 || !Array.isArray(state.messages) || !Array.isArray(state.branches) || state.messages.length>1000 || state.branches.length>1000) return false;
    const ids = new Set();
    for(const message of state.messages) {
      if(!message || !['user','assistant'].includes(message.role) || typeof message.id!=='string') return false;
      if(message.role==='assistant' && (!Array.isArray(message.blocks)||message.blocks.some(b=>!b||typeof b.id!=='string'||typeof b.text!=='string'))) return false;
      if(message.role==='user' && typeof message.text!=='string') return false;
      if(ids.has(message.id)) return false;ids.add(message.id);
    }
    const branchIds=new Set();
    for(const branch of state.branches) {
      if(!branch || typeof branch.id!=='string' || branchIds.has(branch.id)||!branch.anchor || !['main','branch'].includes(branch.anchor.kind)||!Array.isArray(branch.messages)||branch.messages.some(m=>!m||typeof m.id!=='string'||typeof m.text!=='string'||!['user','assistant'].includes(m.role))) return false;
      branchIds.add(branch.id);
    }
    for(const branch of state.branches) {
      if(branch.anchor.kind==='main' && branch.parentId!==null) return false;
      if(branch.anchor.kind==='branch') {
        const parent=state.branches.find(b=>b.id===branch.parentId);
        if(!parent || !parent.messages.some(m=>m.id===branch.anchor.blockId && m.role==='assistant')) return false;
      }
      if(!anchorValid(state,branch.anchor)) return false;
      try {ancestry(state.branches,branch.id);}catch{return false;}
    }
    return true;
  }
  const api={segments,sourceText,anchorValid,ancestry,validState};
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.AnnotationCore=api;
})(typeof globalThis==='object'?globalThis:this);
