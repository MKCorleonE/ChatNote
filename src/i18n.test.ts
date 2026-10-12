import { expect, test } from 'vitest';
import ts from 'typescript';
import { catalogs, translator, resolveLanguage } from './i18n';
import { appVersion, releaseEntries } from './release-info';
import { emptyWorkspace, exampleSession, recoverWorkspace, validateWorkspace, exportMarkdown, contextFor, validAnchor } from './core';

test('Settings navigation and all release entries have translations in every locale',()=>{
  const keys=['Preferences','Models & connections','Reading & context','Appearance','Data & privacy','About','Changelog','Open-source licenses',...releaseEntries.flatMap(entry=>[entry.title,...entry.changes])];
  for(const locale of Object.values(catalogs))for(const key of keys)expect(locale[key],key).toBeDefined();
  expect(releaseEntries[0].version).toBe(appVersion);
});

test('Every locale has complete messages and matching interpolation placeholders', () => {
  const slots=(s:string)=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
  for(const catalog of Object.values(catalogs)) {
    expect(Object.keys(catalog).sort()).toEqual(Object.keys(catalogs.en).sort());
    for(const [key,text] of Object.entries(catalog)) { expect(text.trim(),key).not.toBe(''); expect(slots(text),key).toEqual(slots(catalogs.en[key])); }
  }
});
test('All literal translation calls have English fallback resources',()=>{
  const sources=import.meta.glob<string>(['./*.tsx','./core.ts'],{query:'?raw',import:'default',eager:true});
  for(const file of ['src/App.tsx','src/QuestionBubble.tsx','src/Settings.tsx','src/RichText.tsx','src/AnswerStatus.tsx','src/FollowUpTree.tsx','src/PathDirectory.tsx','src/TreeOverview.tsx','src/WelcomeGuide.tsx','src/SpeechRecorder.tsx','src/AttachmentControls.tsx','src/WindowControls.tsx','src/LearningNoteDialog.tsx','src/MindMap.tsx','src/MindMapDialog.tsx','src/mind-map.tsx','src/learning-note.tsx','src/DeleteDialog.tsx','src/RenameDialog.tsx','src/AnnotationHint.tsx','src/core.ts','src/LicenseNotices.tsx']){
    const ast=ts.createSourceFile(file,sources[file.replace('src/','./')],ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    function visit(node:ts.Node){if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='t'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))expect(catalogs.en[node.arguments[0].text],`${file}: ${node.arguments[0].text}`).toBeDefined();ts.forEachChild(node,visit);}
    visit(ast);
  }
});
test('Fallback, counts and user supplied names are handled without translating content', () => {
  expect(resolveLanguage('fr')).toBe('en');
  expect(translator('fr').t('Settings')).toBe('Settings');
  const zh=translator('zh-Hans');
  expect(zh.t('unknown provider detail')).toBe('unknown provider detail');
  expect(zh.t('usingConnection',{name:'My {name} / $&'})).toBe('正在使用 My {name} / $&。');
  expect(translator('en').plural('turnCount',1)).toBe('1 turn');
  expect(translator('en').plural('turnCount',2)).toBe('2 turns');
  expect(zh.ui('Authentication checked · 1234 models listed')).not.toContain('{count}');
  expect(translator('zh-Hant').date(1700000000000,true)).toBe(new Intl.DateTimeFormat('zh-TW',{dateStyle:'short',timeStyle:'short'}).format(1700000000000));
});
test('Older workspaces migrate locale without changing profiles, drafts, messages or anchors', () => {
  const w=emptyWorkspace();w.sessions=[exampleSession()];w.activeId=w.sessions[0].id;delete w.settings.language;
  const before=structuredClone(w); validateWorkspace(w);recoverWorkspace(w);
  expect(w.settings.language).toBe('en');expect(w.sessions).toEqual(before.sessions);expect(w.settings.profiles).toEqual(before.settings.profiles);
  (w.settings as any).language='future-language';recoverWorkspace(w);expect(w.settings.language).toBe('en');
  (w.settings as any).language=42;expect(()=>validateWorkspace(w)).toThrow('Invalid settings');
});
test('Localized export changes headings while request context and original source stay identical', () => {
  const s=exampleSession(),original=structuredClone(s),branch=s.branches[0],input=contextFor(s,branch);
  const markdown=exportMarkdown(s,'zh-Hant');expect(markdown).toContain('> 來源: '+branch.anchor.quote);
  expect(markdown).toContain(s.messages[1].text);expect(s).toEqual(original);expect(validAnchor(s,branch.anchor)).toBe(true);expect(contextFor(s,branch)).toEqual(input);
});
