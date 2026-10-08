# CodexAnnotation — interactive concept demo

An independent prototype of persistent follow-up conversations attached to selected passages in a desktop chat. This is a design proposal, not an official OpenAI application or extension.

## Open the demo

Unzip the package, then open **CodexAnnotation-demo.html** in a modern desktop browser such as Edge, Chrome, Firefox, or Safari. The HTML file contains its own styles and scripts: no installation, server, account, API key, or internet connection is needed. Keep JavaScript enabled.

## Try it in one minute

1. Click a highlighted passage to reopen its annotation. Hover or focus it to preview the question and answer.
2. Select a new passage within a single paragraph. Click **Ask in annotation**, type a question, and send it.
3. Ask another question in the annotation. The main conversation stays in its original order.
4. Select text in an annotation answer to create a nested follow-up.
5. Open **Follow-up tree** to explore the parent/child relationships. Click a question, then **Jump to source**.
6. Use **Export notes** to preview, copy, or download the main conversation and nested annotations.

Ctrl+Enter (Cmd+Enter on macOS) sends the current input. Highlighted passages can be focused with the keyboard and opened with Enter.

To start over, click **Reset demo**, then **Restore original examples**. This replaces only this demo's saved conversation and annotations. **Cancel** leaves your records unchanged; export notes first if you want to keep them.

## What this demo does and does not do

- All assistant responses are predefined examples. Arbitrary questions do not receive model-generated answers.
- Records stay in this browser. Sending someone the HTML shares the demo and seeded examples, not your browser's saved conversations.
- Local saving depends on browser permissions. File-based storage behavior varies between browsers, and moving the file may change which saved records are available. Use Export notes to keep an important review session.
- No network requests, analytics, official chat access, or account synchronization are implemented.
- Anchors currently support text within a single paragraph. Cross-paragraph selections, editable/regenerated answers, rich formulas, and code blocks are outside this demo's scope.

## Files

- **CodexAnnotation-demo.html** — self-contained interaction demo.
- **desktop-preview.png** — passage annotation view.
- **desktop-tree.png** — nested review tree.

The screenshot files are visual aids only; the HTML works without them.
