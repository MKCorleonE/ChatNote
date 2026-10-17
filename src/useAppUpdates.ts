import { useCallback, useEffect, useRef, useState } from 'react';
import { initialUpdate, savedInstall, updateApi, type UpdateStatus } from './updates';
export function useAppUpdates(loaded:boolean,save:()=>Promise<void>) {
  const [status,setStatus]=useState(initialUpdate),operation=useRef(false),started=useRef(false),saveRef=useRef(save);
  saveRef.current=save;
  useEffect(()=>{
    if(!updateApi.enabled)return;
    let live=true,dispose:(()=>void)|undefined;
    // Listen before reading to avoid missing a startup installation failure/status change.
    void updateApi.listen(s=>{if(live)setStatus(s);}).then(async off=>{if(!live){off();return;}dispose=off;const state=await updateApi.status();if(live)setStatus(state);}).catch(()=>{if(live)setStatus({phase:'error',downloaded:0,error:'update.checkFailed'});});
    return()=>{live=false;dispose?.();};
  },[]);
  const download=useCallback(async()=>{
    if(operation.current)return;operation.current=true;
    try{setStatus(await updateApi.download());}catch{setStatus(s=>({...s,phase:'available',error:'update.downloadFailed'}));}finally{operation.current=false;}
  },[]);
  const check=useCallback(async()=>{
    if(operation.current)return;operation.current=true;started.current=true;
    try{
      const state=await updateApi.check();setStatus(state);
      if(state.phase==='available'){
        try{setStatus(await updateApi.download());}
        catch{setStatus({...state,error:'update.downloadFailed'});}
      }
    }catch{setStatus(s=>({...s,phase:'error',error:'update.checkFailed'}));}finally{operation.current=false;}
  },[]);
  useEffect(()=>{
    if(!loaded||!updateApi.enabled||started.current||status.phase==='starting'||status.phase==='development')return;
    if(status.phase==='ready'){started.current=true;return;}
    const timer=setTimeout(()=>void check(),2500);return()=>clearTimeout(timer);
  },[loaded,status.phase,check]);
  const restart=useCallback(async()=>{
    if(operation.current)return;operation.current=true;
    setStatus(s=>({...s,phase:'saving',error:null}));
    let saved=false;
    try{await savedInstall(async()=>{await saveRef.current();saved=true;},async()=>{setStatus(s=>({...s,phase:'installing'}));await updateApi.install();});}
    catch(error){setStatus(s=>({...s,phase:'ready',error:saved?'update.installFailed':String(error).includes('update.wait')?'update.wait':'update.saveFailed'}));}
    finally{operation.current=false;}
  },[]);
  return {status,check,download,restart};
}
export type AppUpdates=ReturnType<typeof useAppUpdates>;
