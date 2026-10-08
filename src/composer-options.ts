import type { ComposerGlow, Model, ProviderKind, ReasoningEffort } from './types';

export const efforts: ReasoningEffort[] = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
export const glowDefaults: ComposerGlow = { enabled: true, colorA: '#89d9c1', colorB: '#9c8cef', seconds: 7, brightness: 45 };
export function supportedEfforts(provider: ProviderKind, model: string, catalog: Model[] = []): ReasoningEffort[] {
  if (provider === 'compatible') return [];
  const listed = catalog.find(m => m.id === model)?.reasoningEfforts;
  if (listed) return listed.filter(e => efforts.includes(e));
  // These fallbacks cover documented models only. Unknown models keep the provider default.
  if (/^gpt-6\.1-sol(?:-|$)/.test(model)) return ['low', 'medium', 'high', 'xhigh', 'max'];
  if (/^gpt-5\.6(?:-sol)?(?:-\d{4}-\d{2}-\d{2})?$/.test(model)) return ['none', 'low', 'medium', 'high', 'xhigh', 'max'];
  return [];
}
export function panelBounds(viewport: number) {
  return { min: 300, max: Math.max(300, Math.min(760, viewport - 62 - 420)) };
}
export function clampPanel(width: number, viewport: number) {
  const { min, max } = panelBounds(viewport);
  return Math.min(max, Math.max(min, width));
}
