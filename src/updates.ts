import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { desktop } from './bridge';

export type UpdatePhase='starting'|'idle'|'checking'|'current'|'available'|'downloading'|'ready'|'saving'|'installing'|'error'|'development';
export interface UpdateStatus {phase:UpdatePhase;version?:string|null;notes?:string|null;downloaded:number;total?:number|null;error?:string|null}
export const initialUpdate:UpdateStatus={phase:desktop?'starting':'development',downloaded:0};
export const updateBusy=(s:UpdateStatus)=>['starting','checking','downloading','saving','installing'].includes(s.phase);
export const updatePercent=(s:UpdateStatus)=>s.total&&s.total>0?Math.max(0,Math.min(100,Math.floor(s.downloaded/s.total*100))):undefined;
export const updateApi={
  enabled:desktop,
  status:()=>invoke<UpdateStatus>('update_status'),
  check:()=>invoke<UpdateStatus>('check_update'),
  download:()=>invoke<UpdateStatus>('download_update'),
  install:()=>invoke<void>('install_update'),
  listen:(callback:(status:UpdateStatus)=>void)=>listen<UpdateStatus>('chatnote-update',event=>callback(event.payload)),
};
// Installation is deliberately separate from download, and never runs if persistence fails.
export async function savedInstall(save:()=>Promise<void>,install:()=>Promise<void>){await save();await install();}
