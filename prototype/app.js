(() => {
  'use strict';
  const C=window.AnnotationCore, key='codex-annotation-desktop-en-v2';
  const $=id=>document.getElementById(id);
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const uid=prefix=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
  const sampleQ='Each token’s input vector is multiplied by three separate learned projection matrices to produce Query (Q), Key (K), and Value (V). Q describes what a position is looking for, K provides features to match against, and V carries the information to aggregate.';
  const sampleScale='Attention computes the dot products of Q with each K, divides by √dₖ, and applies softmax to obtain weights. Here, dₖ is the key dimension. A weighted sum of V then produces a new representation for the current position.';
  const qAnswer='Q and K serve different roles: one expresses “what I need” and the other “what I can match.” Separate projections let the model learn these representations independently. In a simple setting without masks or additional constraints, sharing the projection makes the raw dot-product scores symmetric. Matching relationships do not have to be symmetric.';
  function anchored(kind,blockId,text,quote){const start=text.indexOf(quote);return {kind,blockId,start,end:start+quote.length,quote};}
  function seed(){return {version:1,messages:[
    {id:'u-intro',role:'user',text:'Help me understand Transformers step by step. Start with Q, K, and V.'},
    {id:'m-qkv',role:'assistant',title:'01 / Three representations, three roles',blocks:[{id:'p-qkv',text:sampleQ},{id:'p-role',text:'Think of Q as a search request, K as an index label, and V as the information behind that label. This analogy helps distinguish their roles; all three are actually vectors learned by the model.'}]},
    {id:'m-scale',role:'assistant',title:'02 / From match scores to attention weights',blocks:[{id:'p-scale',text:sampleScale},{id:'p-next',text:'The main sequence is: generate Q/K/V → compute match scores → scale and normalize → aggregate V. Next, we can explore multi-head attention.'}]}
  ],branches:[
    {id:'b-projection',parentId:null,anchor:anchored('main','p-qkv',sampleQ,'separate learned projection matrices'),messages:[{id:'bq-1',role:'user',text:'Why do Q and K use different projection matrices?'},{id:'ba-1',role:'assistant',text:qAnswer}]},
    {id:'b-scaling',parentId:null,anchor:anchored('main','p-scale',sampleScale,'divides by √dₖ'),messages:[{id:'bq-2',role:'user',text:'Why divide by the square root of the dimension?'},{id:'ba-2',role:'assistant',text:'Under a simplifying assumption that Q and K components are independent, have zero mean, and unit variance, the sum of dₖ products has variance about dₖ. Dividing by √dₖ keeps the score scale more stable and reduces overly peaked softmax outputs and small gradients. Real training distributions need not satisfy these assumptions exactly.'}]},
    {id:'b-asymmetric',parentId:'b-projection',anchor:anchored('branch','ba-1',qAnswer,'Matching relationships do not have to be symmetric'),messages:[{id:'bq-3',role:'user',text:'What does “not symmetric” mean here?'},{id:'ba-3',role:'assistant',text:'The score from position A to B need not equal the score from B to A. A verb may need information from its subject, while the subject may not need to attend to the verb equally. This refers to scores before softmax; row-normalized weights can differ even when the scores are symmetric.'}]}
  ],ui:{mode:'thread',activeId:'b-projection'}};}
  let state=seed(),storageAvailable=true,loadNotice='';
  try{const raw=localStorage.getItem(key);if(raw){const parsed=JSON.parse(raw);if(C.validState(parsed))state=parsed;else loadNotice='Loaded the demo examples; saved data could not be read.';}}catch{storageAvailable=false;loadNotice='Local storage is unavailable. You can still interact and export your notes.';}
  let activeId=state.branches.some(b=>b.id===state.ui?.activeId)?state.ui.activeId:'b-projection';
  if(!state.branches.some(b=>b.id===activeId))activeId=state.branches[0]?.id||null;
  let mode=['thread','tree','closed'].includes(state.ui?.mode)?state.ui.mode:'thread';
  let draft=null,selected=null,hoverTimer,toastTimer;
  function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
  function save(){state.ui={mode,activeId};try{localStorage.setItem(key,JSON.stringify(state));storageAvailable=true;$('save-status').textContent='Saved locally';}catch{storageAvailable=false;$('save-status').textContent='Not saved · export available';toast('Saving is unavailable. Use Export notes to keep this session.');}}
  function branchTitle(branch){return branch.messages.find(m=>m.role==='user')?.text||'New annotation';}
  function forBlock(kind,id){return state.branches.filter(b=>b.anchor.kind===kind && b.anchor.blockId===id).map(b=>({...b.anchor,id:b.id}));}
  function block(text,kind,id){
    const n=el('p','message-block');n.dataset.anchorBlock=id;n.dataset.anchorKind=kind;
    for(const segment of C.segments(text,forBlock(kind,id))){
      if(!segment.ids.length)n.append(document.createTextNode(segment.text));
      else{const mark=el('span','anchor-mark'+(segment.ids.includes(activeId)&&mode==='thread'?' active-anchor':''),segment.text);mark.dataset.branches=segment.ids.join(',');mark.setAttribute('role','button');mark.tabIndex=0;mark.setAttribute('aria-label','Open annotation: '+segment.text);n.append(mark);}
    }return n;
  }
  function renderTranscript(){
    const transcript=$('transcript');transcript.replaceChildren();
    for(const message of state.messages){
      const card=el('article','message '+(message.role==='user'?'user':'assistant'));card.dataset.messageId=message.id;
      if(message.role==='user')card.append(el('div','user-message',message.text));
      else{
        const label=el('div','message-label');label.append(el('span','assistant-symbol','◈'),el('span','','Learning assistant'),el('span','sample-tag','Example response'));card.append(label);
        if(message.title)card.append(el('h3','',message.title));
        message.blocks.forEach(p=>card.append(block(p.text,'main',p.id)));
        const count=state.branches.filter(b=>b.anchor.kind==='main'&&message.blocks.some(p=>p.id===b.anchor.blockId)).length;
        if(count){const caption=el('div','annotation-caption');caption.append(el('span','','◌'),el('span','',count+(count===1?' annotation':' annotations')+' · hover to preview, click to open'));card.append(caption);}
      }transcript.append(card);
    }
  }
  function sourceCard(anchor,parentId){const n=el('div','source-card');n.append(el('small','',anchor.kind==='main'?'SOURCE · MAIN CONVERSATION':'SOURCE · PARENT ANNOTATION'),el('p','',anchor.quote));const button=el('button','source-link','↗ Jump to source');button.type='button';button.addEventListener('click',()=>goSource(anchor,parentId));n.append(button);return n;}
  function suggestion(question){const button=el('button','',question);button.type='button';button.addEventListener('click',()=>{$('branch-input').value=question;$('branch-input').focus();});return button;}
  function renderPanel(){
    const panel=$('annotation-panel'),body=$('panel-body');panel.hidden=mode==='closed';document.querySelector('.content-layout').classList.toggle('panel-closed',mode==='closed');
    $('tree-button').setAttribute('aria-pressed',String(mode==='tree'));$('tree-count').textContent=state.branches.length;$('side-count').textContent=state.branches.length;
    body.replaceChildren();$('branch-form').hidden=true;
    if(mode==='closed')return;
    if(mode==='tree'){renderTree(body);return;}
    $('panel-eyebrow').textContent=draft?'SELECTED PASSAGE':'PASSAGE FOLLOW-UP';$('panel-title').textContent=draft?'New annotation':'Annotation';
    const branch=state.branches.find(b=>b.id===activeId);
    if(draft){
      body.append(sourceCard(draft.anchor,draft.parentId));body.append(el('p','panel-description','This follow-up stays attached to the selected passage. The main conversation keeps its reading order.'));
      const list=el('div','suggestion-list');
      const quote=draft.anchor.quote;
      const questions=/√|dimension|scal|softmax/i.test(quote)?['Why scale the scores this way?','Can you give a numerical example?']:['Why is it designed this way?','Can you explain with an example?'];
      questions.forEach(q=>list.append(suggestion(q)));body.append(list);$('branch-input').placeholder='Ask about this passage…';$('branch-form').hidden=false;return;
    }
    if(!branch){body.append(el('p','empty-state','Select text in an assistant response to create an annotation.'));return;}
    body.append(sourceCard(branch.anchor,branch.parentId));
    const info=el('div','thread-info'),turns=branch.messages.filter(m=>m.role==='user').length;info.append(el('span','',C.ancestry(state.branches,branch.id).length>1?'Level '+C.ancestry(state.branches,branch.id).length+' annotation':'Main conversation annotation'),el('span','',turns+(turns===1?' follow-up turn':' follow-up turns')));
    if(branch.parentId){const up=el('button','','← Parent annotation');up.type='button';up.addEventListener('click',()=>showBranch(branch.parentId));info.append(up);}body.append(info);
    for(const message of branch.messages){
      const n=el('div','branch-message '+(message.role==='assistant'?'branch-answer':''));
      if(message.role==='user')n.append(el('div','branch-question',message.text));
      else{const label=el('div','message-label');label.append(el('span','assistant-symbol','◈'),el('span','','Example response'));n.append(label,block(message.text,'branch',message.id));
        const children=state.branches.filter(b=>b.parentId===branch.id&&b.anchor.blockId===message.id);
        children.forEach(child=>{const childButton=el('button','source-link','↳ Child annotation: '+branchTitle(child));childButton.type='button';childButton.addEventListener('click',()=>showBranch(child.id));n.append(childButton);});}
      body.append(n);
    }
    const tools=el('div','branch-tools'),promote=el('button','','Bring this answer into the main conversation');promote.type='button';promote.addEventListener('click',()=>promoteBranch(branch));tools.append(promote);body.append(tools);
    $('branch-input').placeholder='Continue this annotation…';$('branch-form').hidden=false;
  }
  function renderTree(body){
    $('panel-eyebrow').textContent='REVIEW & NAVIGATE';$('panel-title').textContent='Follow-up tree';body.append(el('p','panel-description','Explore follow-ups by source passage. Click a question to reopen it.'));
    const root=el('div','tree-root','◈ Understanding Transformers');body.append(root);
    for(const message of state.messages.filter(m=>m.role==='assistant')){
      const roots=state.branches.filter(b=>b.parentId===null&&message.blocks.some(p=>p.id===b.anchor.blockId));if(!roots.length)continue;
      body.append(el('div','tree-heading',message.title||'Main response'));
      const list=el('ul','tree-list');roots.forEach(b=>list.append(treeNode(b,new Set())));body.append(list);
    }
    if(!state.branches.length)body.append(el('p','empty-state','No annotations yet. Select a passage to get started.'));
    body.append(el('p','demo-note','The tree shows recorded follow-up relationships. Every annotation links back to its source.'));
  }
  function treeNode(branch,seen){
    const li=el('li','tree-node');if(seen.has(branch.id))return li;seen.add(branch.id);
    const row=el('div','tree-node-row'),button=el('button','tree-open');button.type='button';button.append(el('small','',branch.anchor.quote),el('span','',branchTitle(branch)));button.addEventListener('click',()=>showBranch(branch.id));row.append(button);li.append(row);
    const children=state.branches.filter(b=>b.parentId===branch.id);if(children.length){const list=el('ul','tree-list');children.forEach(b=>list.append(treeNode(b,new Set(seen))));li.append(list);const toggle=el('button','tree-toggle','−');toggle.type='button';toggle.setAttribute('aria-label','Expand or collapse children: '+branchTitle(branch));toggle.setAttribute('aria-expanded','true');toggle.addEventListener('click',()=>{list.hidden=!list.hidden;toggle.textContent=list.hidden?'+':'−';toggle.setAttribute('aria-expanded',String(!list.hidden));});row.append(toggle);}return li;
  }
  function renderAll(){renderTranscript();renderPanel();if(!storageAvailable)$('save-status').textContent='Not saved · export available';}
  function hideTransient(){selected=null;$('selection-toolbar').hidden=true;$('hover-preview').hidden=true;clearTimeout(hoverTimer);}
  function showBranch(id){hideTransient();draft=null;activeId=id;mode='thread';$('branch-input').value='';renderAll();save();if(window.innerWidth<650)$('annotation-panel').scrollIntoView({behavior:'smooth',block:'start'});}
  function flashSource(anchor){const n=[...document.querySelectorAll('[data-anchor-block]')].find(n=>n.dataset.anchorBlock===anchor.blockId&&n.dataset.anchorKind===anchor.kind);if(n){n.scrollIntoView({behavior:'smooth',block:'center'});n.classList.remove('flash-source');void n.offsetWidth;n.classList.add('flash-source');}}
  function goSource(anchor,parentId){if(anchor.kind==='branch')showBranch(parentId);flashSource(anchor);}
  function captureSelection(){
    const selection=window.getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount){$('selection-toolbar').hidden=true;selected=null;return;}
    const range=selection.getRangeAt(0),container=node=>node.nodeType===Node.ELEMENT_NODE?node:node.parentElement;
    const first=container(range.startContainer)?.closest('[data-anchor-block]'),last=container(range.endContainer)?.closest('[data-anchor-block]');
    if(!first||first!==last){hideTransient();if(first||last)toast('Select text within one paragraph to create an annotation.');return;}
    const prefix=range.cloneRange();prefix.selectNodeContents(first);prefix.setEnd(range.startContainer,range.startOffset);
    const start=prefix.toString().length,quote=range.toString();if(!quote.trim())return;if(quote.length>600){hideTransient();toast('Select a passage of up to 600 characters.');return;}
    const kind=first.dataset.anchorKind,blockId=first.dataset.anchorBlock;
    const anchor={kind,blockId,start,end:start+quote.length,quote};if(!C.anchorValid(state,anchor)){hideTransient();toast('The selection could not be located. Please select it again.');return;}
    const parentId=kind==='branch'?state.branches.find(b=>b.messages.some(m=>m.id===blockId))?.id:null;
    if(kind==='branch'&&!parentId)return;
    selected={anchor,parentId};$('hover-preview').hidden=true;$('selected-preview').textContent=quote;
    const rect=range.getBoundingClientRect(),bar=$('selection-toolbar');bar.hidden=false;
    bar.style.left=Math.max(10,Math.min(rect.left,window.innerWidth-bar.offsetWidth-10))+'px';
    bar.style.top=Math.max(10,Math.min(rect.bottom+8,window.innerHeight-bar.offsetHeight-10))+'px';
  }
  function askSelection(){if(!selected)return;draft=selected;activeId=null;mode='thread';$('branch-input').value='';window.getSelection()?.removeAllRanges();hideTransient();renderAll();$('branch-input').focus();if(window.innerWidth<650)$('annotation-panel').scrollIntoView({behavior:'smooth',block:'start'});}
  function answer(question,quote){
    if(/symmetr|shar|different|projection/i.test(question+' '+quote))return qAnswer;
    if(/√|dimension|scal|softmax/i.test(question+' '+quote))return seed().branches[1].messages[1].text;
    if(/\b[QKV]\b|vector|represent|search/i.test(quote))return 'Think in terms of roles: Q supplies the search request, K supplies matching clues, and V supplies the information to aggregate. Each position compares its Q with other positions’ K vectors, normalizes the scores, and uses those weights to sum V. “Search” is an analogy for the computation.';
    return 'Your question is attached to the selected passage. This prototype demonstrates where annotation answers live and how they are saved. Responses are predefined examples, so arbitrary questions do not receive generated explanations. Continue the follow-up, annotate this answer, or return to the main conversation.';
  }
  function sendBranch(event){event.preventDefault();const input=$('branch-input'),question=input.value.trim();if(!question)return;
    let branch=state.branches.find(b=>b.id===activeId);
    if(draft){if(!C.anchorValid(state,draft.anchor)){toast('The source has changed. Please select it again.');return;}branch=state.branches.find(b=>b.anchor.kind===draft.anchor.kind&&b.anchor.blockId===draft.anchor.blockId&&b.anchor.start===draft.anchor.start&&b.anchor.end===draft.anchor.end);
      if(!branch){branch={id:uid('branch'),parentId:draft.parentId,anchor:draft.anchor,messages:[]};state.branches.push(branch);}activeId=branch.id;draft=null;}
    if(!branch)return;branch.messages.push({id:uid('question'),role:'user',text:question},{id:uid('answer'),role:'assistant',text:answer(question,branch.anchor.quote)});input.value='';hideTransient();renderAll();save();toast('Saved to the annotation. Main conversation order is preserved.');
  }
  function sendMain(event){event.preventDefault();const input=$('main-input'),question=input.value.trim();if(!question)return;const id=uid('main');state.messages.push({id:uid('user'),role:'user',text:question});
    const text=/multi[ -]?head/i.test(question)?'Multi-head attention computes attention with several sets of projections. Each head has its own Q/K/V representations and attention weights. The outputs are concatenated and passed through an output projection. This lets the model learn different relationships, but does not guarantee that each head corresponds to a fixed human concept.':'This is a new main conversation message. You can annotate this answer too. The demo uses predefined content; generating answers to arbitrary questions would require a model connection.';
    state.messages.push({id,role:'assistant',title:/multi[ -]?head/i.test(question)?'03 / Learning multiple relationships':'Continue the main conversation',blocks:[{id:uid('paragraph'),text}]});input.value='';renderAll();save();document.querySelector('[data-message-id="'+id+'"]').scrollIntoView({behavior:'smooth',block:'center'});}
  function promoteBranch(branch){const answer=branch.messages.filter(m=>m.role==='assistant').at(-1);if(!answer)return;const id=uid('promoted');state.messages.push({id,role:'assistant',title:'Answer brought back from an annotation',blocks:[{id:uid('summary'),text:'Source: '+branch.anchor.quote+'\n\n'+answer.text}]});renderAll();save();toast('Added this example answer to the main conversation.');}
  function exportNotes(){
    const lines=['# Understanding Transformers: conversation and annotations','','> Independent ChatNote interaction demo. Assistant responses are predefined examples.',''];
    function appendBranch(branch,depth,seen){if(seen.has(branch.id))return;seen.add(branch.id);lines.push('#'.repeat(Math.min(depth+2,6))+' Annotation: '+branchTitle(branch),'','> Source: '+branch.anchor.quote,'');branch.messages.forEach(m=>lines.push('**'+(m.role==='user'?'Question':'Example response')+'**',m.text,''));state.branches.filter(b=>b.parentId===branch.id).forEach(b=>appendBranch(b,depth+1,seen));}
    state.messages.forEach(m=>{lines.push('## '+(m.role==='user'?'My main conversation question':m.title||'Main response'),'');if(m.role==='user')lines.push(m.text,'');else{m.blocks.forEach(b=>lines.push(b.text,''));state.branches.filter(b=>b.parentId===null&&m.blocks.some(p=>p.id===b.anchor.blockId)).forEach(b=>appendBranch(b,1,new Set()));}});
    const note=lines.join('\n'),url=URL.createObjectURL(new Blob(['\uFEFF'+note],{type:'text/markdown;charset=utf-8'}));
    const dialog=el('dialog','export-dialog');dialog.setAttribute('aria-labelledby','export-title');const heading=el('h2','','Export learning notes');heading.id='export-title';dialog.append(heading,el('p','panel-description','Includes the main conversation, source quotes, and nested follow-ups. Download the file, or select all and copy.'));
    const area=el('textarea','note-preview');area.readOnly=true;area.value=note;area.setAttribute('aria-label','Learning notes');dialog.append(area);
    const actions=el('div','export-actions'),select=el('button','quiet-button','Select all'),download=el('a','download-note','Download Markdown'),close=el('button','quiet-button','Close');select.type='button';select.addEventListener('click',()=>{area.focus();area.select();});download.href=url;download.download='Transformer-learning-notes.md';close.type='button';close.addEventListener('click',()=>dialog.close());actions.append(select,download,close);dialog.append(actions);document.body.append(dialog);dialog.addEventListener('close',()=>{URL.revokeObjectURL(url);dialog.remove();});dialog.showModal();
  }
  function resetDemo(){
    const dialog=el('dialog','export-dialog');dialog.setAttribute('aria-labelledby','reset-title');
    const heading=el('h2','','Reset demo?');heading.id='reset-title';
    dialog.append(heading,el('p','panel-description','This replaces this demo’s saved conversation, annotations, and unsent input with the original examples. Export notes first if you want to keep your work.'));
    const actions=el('div','export-actions'),cancel=el('button','quiet-button','Cancel'),reset=el('button','quiet-button','Restore original examples');
    cancel.type=reset.type='button';cancel.addEventListener('click',()=>dialog.close());
    reset.addEventListener('click',()=>{state=seed();activeId=state.ui.activeId;mode=state.ui.mode;draft=null;hideTransient();$('main-input').value='';$('branch-input').value='';renderAll();save();dialog.close();document.querySelector('.lesson-header').scrollIntoView({behavior:'smooth'});if(storageAvailable)toast('Original examples restored and saved.');});
    actions.append(cancel,reset);dialog.append(actions);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();$('reset-button').focus();});dialog.showModal();cancel.focus();
  }
  function hover(mark){if(window.getSelection()?.toString())return;clearTimeout(hoverTimer);const ids=mark.dataset.branches.split(','),branch=state.branches.find(b=>b.id===ids[0]);if(!branch)return;const popup=$('hover-preview');popup.replaceChildren();popup.append(el('small','',ids.length>1?ids.length+' annotations':'Passage annotation'),el('strong','',branchTitle(branch)));const text=branch.messages.find(m=>m.role==='assistant')?.text||'';popup.append(el('p','',text.slice(0,110)+(text.length>110?'…':'')));const open=el('button','','Open full follow-up →');open.type='button';open.addEventListener('click',()=>showBranch(branch.id));popup.append(open);popup.hidden=false;const r=mark.getBoundingClientRect();popup.style.left=Math.max(12,Math.min(r.left,window.innerWidth-popup.offsetWidth-12))+'px';popup.style.top=Math.max(12,Math.min(r.bottom+9,window.innerHeight-popup.offsetHeight-12))+'px';}
  document.addEventListener('pointerup',event=>{if(event.target.closest('#selection-toolbar,#hover-preview'))return;setTimeout(captureSelection,0);});
  document.addEventListener('keyup',event=>{if(event.key==='Shift')captureSelection();if(event.key==='Escape'){window.getSelection()?.removeAllRanges();hideTransient();}});
  document.addEventListener('click',event=>{const mark=event.target.closest('.anchor-mark');if(mark&&!window.getSelection()?.toString())showBranch(mark.dataset.branches.split(',')[0]);});
  document.addEventListener('keydown',event=>{const mark=event.target.closest('.anchor-mark');if(mark&&['Enter',' '].includes(event.key)){event.preventDefault();showBranch(mark.dataset.branches.split(',')[0]);}});
  document.addEventListener('pointerover',event=>{const mark=event.target.closest('.anchor-mark');if(mark)hover(mark);});
  document.addEventListener('pointerout',event=>{if(event.target.closest('.anchor-mark'))hoverTimer=setTimeout(()=>$('hover-preview').hidden=true,220);});
  document.addEventListener('focusin',event=>{const mark=event.target.closest('.anchor-mark');if(mark)hover(mark);});
  document.addEventListener('focusout',event=>{if(event.target.closest('.anchor-mark')&&!event.relatedTarget?.closest('#hover-preview'))$('hover-preview').hidden=true;});
  $('hover-preview').addEventListener('pointerenter',()=>clearTimeout(hoverTimer));$('hover-preview').addEventListener('pointerleave',()=>$('hover-preview').hidden=true);
  window.addEventListener('scroll',()=>hideTransient(),{passive:true});window.addEventListener('resize',()=>hideTransient());
  $('ask-selection').addEventListener('pointerdown',e=>e.preventDefault());$('ask-selection').addEventListener('click',askSelection);
  $('branch-form').addEventListener('submit',sendBranch);$('main-form').addEventListener('submit',sendMain);
  function showTree(){hideTransient();draft=null;mode='tree';renderAll();save();if(window.innerWidth<650)$('annotation-panel').scrollIntoView({behavior:'smooth',block:'start'});}
  $('tree-button').addEventListener('click',showTree);$('sidebar-tree').addEventListener('click',showTree);
  $('close-panel').addEventListener('click',()=>{hideTransient();draft=null;mode='closed';renderAll();save();});
  $('session-button').addEventListener('click',()=>{document.querySelector('.lesson-header').scrollIntoView({behavior:'smooth'});});
  $('export-button').addEventListener('click',exportNotes);
  $('reset-button').addEventListener('click',resetDemo);
  for(const id of ['main-input','branch-input'])$(id).addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$(id).form.requestSubmit();}});
  renderAll();if(loadNotice)toast(loadNotice);
})();
