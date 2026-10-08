const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('./core');
test('UTF-16 selections preserve Chinese and emoji without changing the source',()=>{
  const text='学习🧠 Q/K/V 的含义';const start=text.indexOf('Q/K/V');
  const parts=C.segments(text,[{id:'a',start,end:start+5}]);
  assert.equal(parts.map(p=>p.text).join(''),text);assert.equal(parts.find(p=>p.ids.includes('a')).text,'Q/K/V');
});
test('overlapping anchors retain both references in the shared region',()=>{
  const parts=C.segments('abcdef',[{id:'one',start:1,end:4},{id:'two',start:3,end:5}]);
  assert.deepEqual(parts.find(p=>p.text==='d').ids,['one','two']);assert.equal(parts.map(p=>p.text).join(''),'abcdef');
});
test('changed text cannot silently bind an old quote to a wrong location',()=>{
  const state={messages:[{blocks:[{id:'p',text:'new phrase'}]}],branches:[]};
  assert.equal(C.anchorValid(state,{kind:'main',blockId:'p',start:0,end:3,quote:'old'}),false);
});
test('ancestry keeps nested follow-ups in order and rejects cycles',()=>{
  assert.deepEqual(C.ancestry([{id:'root',parentId:null},{id:'child',parentId:'root'}],'child'),['root','child']);
  assert.throws(()=>C.ancestry([{id:'a',parentId:'b'},{id:'b',parentId:'a'}],'a'),/循环/);
});
test('saved nested anchors must point to an assistant answer in their actual parent',()=>{
  const state={version:1,messages:[{id:'m',role:'assistant',blocks:[{id:'p',text:'hello'}]}],branches:[
    {id:'a',parentId:null,anchor:{kind:'main',blockId:'p',start:0,end:5,quote:'hello'},messages:[{id:'answer',role:'assistant',text:'world'}]},
    {id:'b',parentId:'a',anchor:{kind:'branch',blockId:'answer',start:0,end:5,quote:'world'},messages:[]}
  ]};
  assert.equal(C.validState(state),true);state.branches[1].parentId='missing';assert.equal(C.validState(state),false);
});
