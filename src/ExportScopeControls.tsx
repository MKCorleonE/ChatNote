import type { ExportScope } from './export-scope';
import { personalExport, sharedExport } from './export-scope';
import { useI18n } from './I18nProvider';
export function ExportScopeControls({value,onChange,disabled=false,attachments=true,organized=true}:{value:ExportScope;onChange:(value:ExportScope)=>void;disabled?:boolean;attachments?:boolean;organized?:boolean}){
 const {t}=useI18n();
 return <fieldset className="export-scope" disabled={disabled}><legend>{t('Export contents')}</legend><div className="button-row"><button type="button" onClick={()=>onChange({...sharedExport})}>{t('For sharing')}</button><button type="button" onClick={()=>onChange({...personalExport})}>{t('For personal use')}</button></div><div className="export-options">{([['notes','Include private notes'],['history','Include saved message versions'],...(attachments?[['attachments','Include attachment files']]:[]),...(organized?[['organized','Include model-organized draft']]:[])] as [keyof ExportScope,string][]).map(([key,label])=><label key={key}><input type="checkbox" checked={value[key]} onChange={e=>onChange({...value,[key]:e.target.checked})}/>{t(label)}</label>)}</div><p className="small muted">{t('Exact source passages needed by follow-ups remain in the export. Review the file before sharing.')}</p></fieldset>;
}
