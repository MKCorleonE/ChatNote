import { translator, type Language } from './i18n';
import { noteSources } from './learning-note';
import type { Generation, LearningPreferences, Session, Settings } from './types';

export const subjects = ['general', 'math', 'computing', 'science', 'humanities'] as const;
export type Subject = typeof subjects[number];
export const subjectKeys: Record<Subject, string> = { general: 'General learning', math: 'Mathematics', computing: 'Computer science', science: 'Natural sciences', humanities: 'Humanities & social sciences' };
export function presetPrompt(subject: Subject, language: Language) {
  const { t } = translator(language);
  return `${t('notebook.formatPrompt')}\n\n${t(`notebook.subject.${subject}`)}`;
}
export function learningPrompt(preferences: LearningPreferences | undefined, language: Language) {
  const id = preferences?.selectedId ?? 'general';
  if (id === 'custom') return preferences?.customPrompt ?? presetPrompt('general', language);
  const saved = preferences?.presets?.find(p => p.id === id);
  return saved?.prompt ?? presetPrompt(subjects.includes(id as Subject) ? id as Subject : 'general', language);
}
// Use the same immutable snapshot for preview and send. Never include vault values or local notes.
export function learningRequest(session: Session, settings: Settings, language: Language): Generation {
  return { requestId: crypto.randomUUID(), provider: settings.provider, endpoint: settings.endpoint,
    profileId: settings.activeProfileId, model: settings.model,
    input: [{ role: 'user', content: noteSources(session) }],
    instructions: `${learningPrompt(settings.learningPreferences, language).trim()}\n\n${translator(language).t('notebook.evidencePrompt')}`, imageInput: false };
}
