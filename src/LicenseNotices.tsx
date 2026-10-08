import { useState } from 'react';
import { useI18n } from './I18nProvider';
import notices from './third-party-notices.json';

export default function LicenseNotices() {
  const { t, n } = useI18n();
  const [search, setSearch] = useState('');
  const filtered = notices.filter(entry => `${entry.name} ${entry.license}`.toLowerCase().includes(search.toLowerCase()));
  return <><h3 className="settings-page-title">{t('Open-source licenses')}</h3>
    <p className="muted">{t('ChatNote uses the following third-party components. License texts are provided in their original language.')}</p>
    <p className="small muted">{t('This list includes frontend dependencies and native build dependencies. It does not grant a license to ChatNote itself.')}</p>
    <label className="license-search">{t('Search licenses')}<input aria-label={t('Search licenses')} value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Package name or license')}/></label>
    <p className="small muted" role="status">{t('licenseCount', { count: n(filtered.length) })}</p>
    <div className="license-list">{filtered.map(entry => <details key={`${entry.ecosystem}:${entry.name}:${entry.version}`}><summary><span>{entry.name} <small>{entry.version}</small></span><span>{entry.license}</span></summary><p className="small muted">{entry.ecosystem}</p><pre>{entry.text || t('The package declares this license; its source package contains the applicable license terms.')}</pre></details>)}</div>
    {!filtered.length && <p className="muted">{t('No matching components.')}</p>}
  </>;
}
