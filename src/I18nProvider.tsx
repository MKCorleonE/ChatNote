import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { translator, type Language } from './i18n';
const Context=createContext(translator('en'));
export function I18nProvider({language,children}:{language:Language;children:ReactNode}){const value=useMemo(()=>translator(language),[language]);return <Context.Provider value={value}>{children}</Context.Provider>;}
export function useI18n(){return useContext(Context);}
