import manifest from '../package.json';

export const appVersion = manifest.version;
export const releaseEntries = [
  { version: appVersion, date: '2026-10-08', title: 'Capsule sidebar & clearer settings', changes: [
    'New conversation, history and settings in one capsule, with gentle press and panel transitions.',
    'Settings now have navigation for connections, reading, appearance, data and about.',
    'Added local changelog and searchable third-party license notices.',
    'Existing conversations, passage anchors, connections and sign-in storage are preserved.',
  ] },
  { version: '0.4.0', date: '2026-10-08', title: 'Composer & resizable annotations', changes: [
    'Resize the annotation panel and choose connection, model and reasoning effort in the composer.',
    'Enter sends; Alt+Enter adds a line. Input glow colors, brightness and speed are configurable.',
  ] },
  { version: '0.3.1', date: '2026-10-08', title: 'Lighter formula annotations', changes: [
    'Formula annotation actions appear on hover or keyboard focus without shifting the text.',
  ] },
  { version: '0.3.0', date: '2026-10-08', title: 'Reading & private notes', changes: [
    'Expanded passage selection, private annotation notes and context review before sending.',
  ] },
  { version: '0.2.1', date: '2026-10-08', title: 'Sign-in recovery', changes: [
    'Cancel stalled sign-in attempts and check sign-in connectivity without generating an answer.',
  ] },
  { version: '0.2.0', date: '2026-10-08', title: 'Interface languages', changes: [
    'English, Simplified Chinese and Traditional Chinese interfaces with immediate switching.',
  ] },
  { version: '0.1.1', date: '2026-10-08', title: 'Saved connections', changes: [
    'DeepSeek and Qwen presets, separate connection profiles and official usage links.',
  ] },
  { version: '0.1.0', date: '2026-10-08', title: 'First Windows preview', changes: [
    'Local conversations, recursive annotations, source anchors, workspace backups and Markdown export.',
  ] },
];
