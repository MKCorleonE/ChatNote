import manifest from '../package.json';

export const appVersion = manifest.version;
export const releaseEntries = [
  { version: '0.10.0', date: '2026-10-12', title: 'Materials, context choices & learning milestones', changes: [
    'Paste images into either composer; document input follows the selected provider and model.',
    'Fixed the speech model default and added Qwen ASR alongside compatible transcription providers.',
    'Choose source and conversation history per request; review the actual budgeted context.',
    'Connected map cards resize in the app and offline HTML; round markers follow your reading position.',
    'Notifications last 2.5 seconds with spring motion; successful notebook and map exports celebrate with confetti.',
  ] },
  { version: '0.9.0', date: '2026-10-12', title: 'Learning tools & branching maps', changes: [
    'A larger startup identity and a new motto introduce the learning workspace.',
    'Notebook and mind map shortcuts sit beside the follow-up tree.',
    'Visible subject prompts can be customized, saved and restored; preview exact organization context.',
    'Organization shows elapsed time, streaming text and a quiet loading indicator.',
    'Export expandable offline mind maps and switch the tree overview to a horizontal card layout.',
    'Anchored introduction bubbles explain the real controls with spring motion.',
    'Existing conversations, passage anchors, connections and sign-in storage are preserved.',
  ] },
  { version: '0.8.0', date: '2026-10-11', title: 'Learning paths, materials & offline notebooks', changes: [
    'Integrated window controls remove the mismatched native title bar.',
    'Local attachments support text, vision images and OpenAI document inputs, with portable backups.',
    'Record, pause, transcribe and either review or send; speech uses an API-key provider.',
    'Question-first path directory and expanded main-line trail preserve exact sources and saved versions.',
    'Five-step welcome guide appears on first launch and after each version upgrade.',
    'Export self-contained offline learning notebooks, optionally organized by the selected model.',
    'Math delimiter normalization and readable fallbacks prevent malformed formulas from swallowing prose.',
    'Existing conversations, passage anchors, connections and sign-in storage are preserved.',
  ] },
  { version: '0.7.1', date: '2026-10-09', title: 'Forest & exploration identity', changes: [
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
