# Submitted feature request

- Issue: [openai/codex #51373](https://github.com/openai/codex/issues/51373)
- Title: Feature request: Passage-anchored follow-up conversations
- Submitted: 2026-10-06
- Verified after submission: issue page displayed the title, issue number, Open status, enhancement label, full proposal, related-request links, two screenshots, and final demo ZIP link.
- Related requests: #26227, #12450, #26198 (linked in the issue body; no separate comments were posted).
- Public demo package: [CodexAnnotation-demo.zip](https://github.com/user-attachments/files/33110175/CodexAnnotation-demo.zip)
- Local final body: `ISSUE_BODY.md`; titled copy: `FEATURE_REQUEST.md`.
- Local screenshot of the published issue: `issue-submitted.png`.
- Video added on 2026-10-06: [demo-github.mp4](https://github.com/user-attachments/assets/7a0b6175-bb3b-4c3d-8007-51f8cdd558be), embedded under **Video walkthrough** in the issue body.
- Original recording: `demo.mp4` (15,422,351 bytes). Upload copy: `demo-github.mp4` (1,952,971 bytes); H.264, 1920×1080, 21.478 seconds, original AAC audio remuxed. The original file was kept.
- Verified after saving: GitHub rendered the inline video player; its media duration was 21.478 seconds, readyState was 4, and no media error was reported. The tagline, contact sentence, and ZIP link were preserved.
- Video upload proof: `issue-video-uploaded.png`.

## Demo verification

The dark English UI and seeded nested annotations were checked in the browser. The self-contained HTML was loaded through the local preview server and contained no external scripts or stylesheet links. Its review tree and English Markdown export preview worked. All five existing core tests passed.

The in-app browser security policy blocked navigation to the local file URL, so direct file-based opening was not tested here. The HTML embeds all required CSS and JavaScript; browser permissions may affect local saving. The Edge desktop launcher remains untested. No model was connected.

The ZIP contains only the HTML demo, English sharing guide, and two screenshots. It does not contain browser profiles or saved user conversations.
