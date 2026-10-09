import type { Settings } from './types';

export const highlighterColors = [
  { id: 'yellow', label: 'Yellow', hex: '#f5d85a' },
  { id: 'green', label: 'Green', hex: '#7bdc9b' },
  { id: 'cyan', label: 'Cyan', hex: '#69d6ed' },
  { id: 'pink', label: 'Pink', hex: '#f497bf' },
  { id: 'purple', label: 'Purple', hex: '#b69af5' },
  { id: 'orange', label: 'Orange', hex: '#f5b56b' },
] as const;
export const highlightDefaults = { color: 'yellow', opacity: 30 } as const;
export function highlightStyle(settings: Pick<Settings, 'annotationHighlight'>) {
  const value = { ...highlightDefaults, ...settings.annotationHighlight };
  const color = highlighterColors.find(c => c.id === value.color) ?? highlighterColors[0];
  const channels = color.hex.slice(1).match(/../g)!.map(c => parseInt(c, 16));
  return { '--annotation-highlight': `rgba(${channels.join(',')},${value.opacity / 100})` };
}
