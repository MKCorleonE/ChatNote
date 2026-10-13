import { selectContext } from './core';
import type { ContextReport } from './types';
export function applyContextSelection(report:ContextReport,choice:string[]|undefined):ContextReport {
  if(choice===undefined)return report;
  const keys=new Set(choice);return selectContext(report,(report.candidateKeys??[]).flatMap((key,i)=>keys.has(key)?[i]:[]));
}
export function savedContextSelection(report:ContextReport):string[] {
  return (report.selected??[]).filter(i=>!report.required?.includes(i)).map(i=>report.candidateKeys?.[i]).filter((key):key is string=>!!key);
}
