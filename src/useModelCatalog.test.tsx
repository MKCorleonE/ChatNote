import { test, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ConnectionProfile, Model } from './types';
const mock=vi.hoisted(()=>({models:vi.fn()}));
vi.mock('./bridge',()=>({desktop:true,profileStatus:async()=>({hasKey:true,endpointMatches:true,connected:true,planUsage:true}),models:(...args:unknown[])=>mock.models(...args)}));
import { useModelCatalog } from './useModelCatalog';

test('A catalog arriving after a connection switch cannot replace the new connection catalog',async()=>{
  const a:ConnectionProfile={id:'connection-a',name:'A',preset:'custom',provider:'compatible',endpoint:'https://a.example/v1',model:'a-model'};
  const b:ConnectionProfile={...a,id:'connection-b',name:'B',endpoint:'https://b.example/v1',model:'b-model'};
  let finishA:(models:Model[])=>void=()=>{};
  mock.models.mockImplementation((_provider:string,_endpoint:string,id:string)=>id===a.id?new Promise<Model[]>(resolve=>{finishA=resolve;}):Promise.resolve([{id:'b-model',name:'B model'}]));
  const save=vi.fn(),hook=renderHook(({profile})=>useModelCatalog(profile,undefined,save,0),{initialProps:{profile:a}});
  await waitFor(()=>expect(mock.models).toHaveBeenCalledWith(a.provider,a.endpoint,a.id));
  hook.rerender({profile:b});await waitFor(()=>expect(hook.result.current.catalog[0]?.id).toBe('b-model'));
  await act(async()=>finishA([{id:'a-model',name:'Late A model'}]));
  expect(hook.result.current.catalog).toEqual([{id:'b-model',name:'B model'}]);expect(save).toHaveBeenCalledTimes(1);expect(save.mock.calls[0][0]).toBe(b.id);
});
