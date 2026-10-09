import { expect, test } from 'vitest';
import { contextFor, emptyWorkspace, exampleSession, exportMarkdown, makeAnchor, message, snapshot, validateWorkspace, validAnchor } from './core';
import { activeMessages, appendThread, editThread, questionTime, questionVersions, restoreSourcePath, switchThreadPath } from './message-history';

test('Editing an earlier question excludes its old answer and later turns, while preserving anchors and backup recovery', () => {
  const original = exampleSession(), q = original.messages[0], branch = original.branches[0];
  original.messages.push(message('user', 'OLD_FUTURE_QUESTION'), message('assistant', 'OLD_FUTURE_ANSWER'));
  const before = structuredClone(original), answer = message('assistant', 'NEW_ANSWER');
  const edited = editThread(original, q.id, 'NEW_QUESTION 中文🧠', answer);
  expect(original).toEqual(before);
  expect(activeMessages(edited).map(m => m.text)).toEqual(['NEW_QUESTION 中文🧠', 'NEW_ANSWER']);
  expect(activeMessages(edited)[0].revision).not.toBe(q.revision);
  expect(edited.messages.slice(0,original.messages.length)).toEqual(original.messages);
  expect(validAnchor(edited, branch.anchor)).toBe(true);
  expect(snapshot(edited, null, branch.anchor)).toEqual(snapshot(original, null, branch.anchor));
  expect(JSON.stringify(contextFor(edited, null).items)).not.toMatch(/OLD_FUTURE|Three representations/);
  const w = emptyWorkspace(); w.sessions = [edited]; w.activeId = edited.id;
  expect(() => validateWorkspace(JSON.parse(JSON.stringify(w)))).not.toThrow();
  const markdown = exportMarkdown(edited, 'zh-Hans');
  expect(markdown).toContain('已保留的问题版本'); expect(markdown).toContain('OLD_FUTURE_ANSWER'); expect(markdown).toContain(branch.anchor.quote);
  const restored = restoreSourcePath(edited, branch.anchor, null);
  expect(activeMessages(restored)).toEqual(original.messages);
  expect(restored.messageHistory?.[0]).toEqual(activeMessages(edited));
});

test('Multiple edits and switching preserve each continuation and archived child annotation sources', () => {
  const s = exampleSession(), b = s.branches[0], q = b.messages[0], anchor = makeAnchor(b.messages[1], 0, 5);
  const child = {...b, id: crypto.randomUUID(), parentId: b.id, anchor, messages: [], sourceContext: snapshot(s, b.id, anchor)};
  const editedBranch = editThread(b, q.id, 'Edited branch question', message('assistant', 'Edited branch answer'));
  const edited = {...s, branches:[editedBranch, child]};
  expect(validAnchor(edited, anchor)).toBe(true);
  const w = emptyWorkspace(); w.sessions = [edited]; w.activeId = edited.id;
  expect(()=>validateWorkspace(w)).not.toThrow();
  expect(activeMessages(restoreSourcePath(edited, anchor, b.id).branches[0])).toEqual(b.messages);
  const editedAgain = editThread(editedBranch, activeMessages(editedBranch)[0].id, 'Third question', message('assistant', 'Third answer'));
  const versions = questionVersions(editedAgain, q.id); expect(versions).toHaveLength(3);
  const first = switchThreadPath(editedAgain, versions[0].messages);
  const last = switchThreadPath(first, questionVersions(first, q.id)[2].messages);
  expect(activeMessages(last).at(-1)?.text).toBe('Third answer'); expect(questionVersions(last, q.id)).toHaveLength(3);
});

test('Corrupt archived messages, duplicate IDs and revision rewrites are rejected', () => {
  const w = emptyWorkspace(), s = exampleSession(); w.sessions = [s]; w.activeId = s.id;
  s.messageHistory = [[...s.messages]];
  expect(()=>validateWorkspace(w)).not.toThrow();
  s.messageHistory[0] = [{...s.messages[1], text:'Changed original source'}];
  expect(()=>validateWorkspace(w)).toThrow('Invalid saved question versions');
  s.messageHistory[0] = [s.messages[0], s.messages[0]];
  expect(()=>validateWorkspace(w)).toThrow('Invalid message');
  (s as any).messageHistory = [null]; expect(()=>validateWorkspace(w)).toThrow('Invalid saved question versions');
});

test('Continuing a selected version and turns appended by older clients never resurrect an archived answer', () => {
  const original=exampleSession(),q=original.messages[0];
  const edited=editThread(original,q.id,'Current edited question',message('assistant','Current answer'));
  const continued=appendThread(edited,message('user','Continue current version'),message('assistant','Current continuation'));
  expect(activeMessages(continued).map(m=>m.text)).toEqual(['Current edited question','Current answer','Continue current version','Current continuation']);
  expect(JSON.stringify(contextFor(continued,null).items)).not.toContain('Three representations');
  const legacyTurn=message('user','Added by older client');continued.messages.push(legacyTurn);
  expect(activeMessages(continued).at(-1)).toBe(legacyTurn);
  const w=emptyWorkspace();w.sessions=[continued];w.activeId=continued.id;const corrupt=structuredClone(w);corrupt.sessions[0].activeMessageIds=['missing'];
  expect(()=>validateWorkspace(corrupt)).toThrow('Invalid saved question versions');
});

test('Question times always use local zero-padded 24-hour HH:mm', () => {
  expect(questionTime(new Date(2026, 9, 9, 0, 5).getTime())).toBe('00:05');
  expect(questionTime(new Date(2026, 9, 9, 23, 9).getTime())).toBe('23:09');
  expect(questionTime(Number.NaN)).toBe('');
});
