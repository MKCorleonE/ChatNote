import { useEffect } from 'react';
import type { Settings } from './types';

export function systemTheme(fallback:Settings['theme']):Settings['theme'] {
  return typeof window.matchMedia==='function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'
    : fallback;
}

export function useTheme(settings:Pick<Settings,'theme'|'followSystemTheme'>|undefined) {
  useEffect(()=>{
    if(!settings)return;
    if(!settings.followSystemTheme||typeof window.matchMedia!=='function') {
      document.documentElement.dataset.theme=settings.theme;
      return;
    }
    const preference=window.matchMedia('(prefers-color-scheme: dark)');
    const apply=()=>{document.documentElement.dataset.theme=preference.matches?'dark':'light';};
    apply();
    preference.addEventListener('change',apply);
    return()=>preference.removeEventListener('change',apply);
  },[settings?.theme,settings?.followSystemTheme]);
}
