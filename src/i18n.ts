import en from './locales/en.json' with { type: 'json' };
import hans from './locales/zh-Hans.json' with { type: 'json' };
import hant from './locales/zh-Hant.json' with { type: 'json' };

export type Language = 'en' | 'zh-Hans' | 'zh-Hant';
export const languages: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'zh-Hans', label: '简体中文' },
  { id: 'zh-Hant', label: '繁體中文' },
];
export const catalogs: Record<Language, Record<string, string>> = { en, 'zh-Hans': hans, 'zh-Hant': hant };
export function resolveLanguage(value: unknown): Language { return value === 'zh-Hans' || value === 'zh-Hant' ? value : 'en'; }
export function localeTag(language: Language) { return language === 'zh-Hans' ? 'zh-CN' : language === 'zh-Hant' ? 'zh-TW' : 'en-US'; }
export function translator(value: unknown) {
  const language = resolveLanguage(value), locale = localeTag(language);
  const n = (count: number) => new Intl.NumberFormat(locale).format(count);
  const date = (time: number, withTime = false) => !Number.isFinite(time) ? '' : new Intl.DateTimeFormat(locale, withTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }).format(time);
  const t = (key: string, params: Record<string, string | number> = {}) => {
    const template = catalogs[language][key] ?? catalogs.en[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (match, p: string) => Object.hasOwn(params, p) ? String(params[p]) : match);
  };
  const plural = (key: string, count: number) => t(count === 1 ? `${key}.one` : key, { count: n(count) });
  // Existing connection checks and save notices remain canonical in persisted records.
  const ui = (text: string) => {
    const plain = text.replace(/^Error:\s*/, '');
    const patterns: [RegExp, string, string][] = [
      [/^Using (.+)\.$/, 'usingConnection', 'name'],
      [/^Key saved for (.+)\.$/, 'keySaved', 'name'],
      [/^Authentication checked · (\d+) models listed$/, 'catalogChecked', 'count'],
      [/^(\d+) conversations imported\. Existing records were kept\.$/, 'imported', 'count'],
      [/^Could not save before closing: (.+)\. Export a backup, then try again\.$/, 'closeSaveFailed', 'detail'],
    ];
    for (const [re, key, param] of patterns) { const hit = plain.match(re); if (hit) return t(key, { [param]: param === 'count' ? n(Number(hit[1])) : hit[1] }); }
    return t(plain);
  };
  return { language, t, n, date, plural, ui };
}
export type I18n = ReturnType<typeof translator>;
