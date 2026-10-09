import manifest from '../package.json';

export const appVersion = manifest.version;
export const releaseEntries = [
  { version: appVersion, date: '2026-10-09', title: 'Forest & exploration identity', changes: [
    'Adopted the five staggered outline trees and winding exploration thread selected by the author.',
    'Updated application, Windows installer, startup, welcome, about and browser tab icons.',
    'Prepared icon sizes for other platforms; Windows remains the delivered platform.',
    'Existing conversations, passage anchors, connections and sign-in storage are preserved.',
  ] },
  { version: '0.7.0', date: '2026-10-09', title: 'Smoother details & unified highlights', changes: [
    'Delete an answer together with its question and retries, with linked annotation impact confirmation.',
    'A simpler follow-up tree with a tree icon, return to overview and precise passage navigation.',
    'Context previews open with or without a draft and never send a model request.',
    'Spring menus across appearance, models, connections and more actions; click outside to dismiss.',
    'Rounded notes and ambient lighting with a capsule switch, RGB sliders and default color reset.',
    'Six highlighter colors and linear opacity apply equally to annotated text and formulas.',
    'Existing conversations, passage anchors, connections and sign-in storage are preserved.',
  ] },
  { version: '0.6.0', date: '2026-10-09', title: 'Cleaner conversations & deeper follow-ups', changes: [
    'Blank new conversations enter history only after a message is sent; unsent drafts are preserved.',
    'Formula passages render in annotation sources and the follow-up tree without changing original anchors.',
    'Adaptive cyan question bubbles, edit and regenerate with saved versions, icon actions and contextual timestamps.',
    'Delete conversations, individual answers and failed responses with linked annotation impact confirmation.',
    'Pin history into a three-column layout and expand each follow-up round and its nested questions.',
    'Rounded spring menus, animated renaming and concise annotation previews; clearer composer prompts and AI reminder.',
    'Windows system proxy support, bounded pre-send reconnects and clearer secure connection diagnostics.',
    'Existing conversations, passage anchors, connections and sign-in storage are preserved.',
  ] },
  { version: '0.5.0', date: '2026-10-08', title: 'Capsule sidebar & clearer settings', changes: [
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
