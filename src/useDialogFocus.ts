import { useEffect, useRef, type KeyboardEvent } from 'react';
export function useDialogFocus(onClose:()=>void,blocked:()=>boolean=()=>false) {
  const ref=useRef<HTMLElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement;ref.current?.querySelector<HTMLElement>('button:not(:disabled),input,textarea')?.focus({preventScroll:true});return()=>{if(previous?.isConnected)previous.focus({preventScroll:true});};},[]);
  function onKeyDown(e:KeyboardEvent<HTMLElement>){if(e.key==='Escape'&&!blocked()){e.stopPropagation();onClose();}if(e.key==='Tab'){const controls=[...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],summary,[tabindex="0"]')].filter(el=>!el.closest('details:not([open])')||el===el.closest('details:not([open])')?.querySelector('summary'));if(!e.currentTarget.contains(document.activeElement)){e.preventDefault();controls[0]?.focus();}else if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0]?.focus();}}}
  return {ref,onKeyDown};
}
