### What variant of Codex are you using?

Codex Desktop App (Windows)

### What feature would you like to see?

#### Explore every question without losing the thread.

I believe passage-anchored follow-ups could transform how we learn complex topics through AI conversations, keeping the main explanation coherent while making deeper questions easy to revisit.

Let users select a term or passage in an assistant response and open a **persistent, multi-turn annotation conversation attached to that exact passage**, similar to comments in a document editor.

The main conversation would keep its reading order, while detailed follow-ups remain discoverable where the questions arose.

This interaction pattern could benefit **ChatGPT, Work, and Codex** wherever users need to explore details without interrupting a longer conversation. This issue requests consideration for Codex Desktop; the broader applicability is part of the product idea, not a claim that these products already support it.

#### Problem and motivation

When I use an assistant to understand a complex topic, I need a coherent main explanation and room to investigate individual details. For example, a Transformer lesson might progress through Q/K/V, attention weights, and multi-head attention. Questions about one projection matrix or one formula can take several turns.

Appending every clarification to the main chat makes the explanation difficult to reread. Moving them to separate chats makes their connection to the original passage harder to find.

This also applies to Codex workflows: understanding an unfamiliar codebase, reviewing an architectural explanation, or asking about a particular step in a plan without interrupting the main task. The learning example below illustrates the interaction rather than requiring a dedicated education mode.

#### Proposed interaction

1. Select text in an assistant response and choose **Ask in annotation**.
2. Open a side panel containing the source quote and a separate follow-up conversation. Allow multiple turns in that annotation.
3. Keep a visible indicator on the original passage. Hover or keyboard focus previews the follow-up; clicking reopens it. Tapping should provide an equivalent interaction.
4. Preserve the annotation and its source relationship when the conversation is reopened.
5. Optionally allow selecting text in an annotation answer to create a child annotation.
6. Provide a collapsible review tree of recorded follow-ups, with links back to their source passages.
7. Let users explicitly bring a useful branch conclusion into the main conversation.

#### Availability without added clutter

The feature should be **available by default, appear on demand, and be fully disableable in settings**. Ordinary chats should retain their familiar layout. Selecting text would reveal an “Ask in annotation” action; the annotation panel would open only when the user chooses it. Indicators would appear only on passages that have annotations, and the review tree would be relevant only once annotations exist. Closing the panel would return to the regular chat layout. A user who prefers a simpler experience could turn the feature off entirely.

This separates feature availability from panel visibility, so short questions do not require an annotation mode or a permanently visible sidebar.

**Example:**

```text
Main explanation: Q/K/V → attention weights → multi-head attention
  ├─ “separate learned projection matrices”
  │   └─ Why do Q and K use different matrices?
  │       └─ “Matching relationships do not have to be symmetric”
  │           └─ What does “not symmetric” mean here?
  └─ “divides by √dₖ”
      └─ Why divide by the square root of the dimension?
```

The questions stay attached to their source, while the main explanation can be read continuously.

#### Suggested first version

The core request is **text selection + a persistent annotation panel + reopening from the source passage**. A flat annotation list would be sufficient initially. Nested annotations, the review tree, and bringing conclusions back could follow later.

The tree would show actual conversation relationships. It does not need to infer a knowledge graph.

#### Context and anchor behavior

- An annotation should receive the selected passage, relevant context up to that point, and its own history. Unrelated branches should not be included by default.
- Branch messages should not silently enter the main transcript or steer an active main task. Bringing a conclusion back should be explicit.
- Anchors should identify the source message and answer version. If a response is edited or regenerated, retain the original association or show that reassociation is needed; do not silently attach the annotation to a different passage.
- Source quotes, follow-up history, and parent/child relationships should survive closing and reopening the conversation.

These are desired product behaviors, not claims that the prototype implements production context management or answer-version handling.


### Additional information

#### Interaction prototype

I built an independent, dark-theme English prototype to make the interaction concrete. It demonstrates passage selection, hover previews, multi-turn annotations, nested follow-ups, a review tree, local persistence, and Markdown note export.

**All assistant responses are predefined examples.** It does not call a model, connect to the official Codex desktop app, or read existing Codex chats. It is a demonstration of the proposed interaction, not an implementation intended for merging into Codex.

The demo is a self-contained HTML file. To try the accompanying ZIP, extract it and open `CodexAnnotation-demo.html` in a modern desktop browser. No installation, account, API key, or server is required. Local saving depends on browser permissions; exported notes provide a separate way to keep a session.

Suggested walkthrough: select a passage → ask in an annotation → continue the follow-up → select part of the answer to create a child annotation → open the tree → jump back to the source.

#### Related requests and distinct scope

- [#26227 — Persist side chats as child threads attached to the main thread](https://github.com/openai/codex/issues/26227): closely related persistence and parent/child organization. This request adds a visible anchor to a **specific selected passage** within an answer.
- [#12450 — Support for Tree-based Conversation Management](https://github.com/openai/codex/issues/12450): related branching and tree navigation. Here, the emphasis is passage-local clarification and continuous rereading of the main explanation.
- [#26198 — Selection-based comments in Markdown and HTML previews](https://github.com/openai/codex/issues/26198): related selection and source context. This request concerns assistant chat responses and keeps each follow-up transcript separate from the main conversation.

I am opening this separately to make the passage-anchored interaction and prototype easy to evaluate. If the maintainers consider it part of an existing request, I would be happy for it to be consolidated there.

Would this interaction fit Codex Desktop? Feedback on the smallest useful scope, or guidance on routing the broader learning use case to the ChatGPT team, would be welcome.


#### Demo screenshots

**Passage-attached follow-up and a nested annotation:**

![Passage-attached annotation in the independent prototype](https://github.com/user-attachments/assets/641948fe-441d-4630-8731-dc866e6fb403)

**Review tree organized by source passage:**

![Nested follow-up tree in the independent prototype](https://github.com/user-attachments/assets/7a4a7388-f806-4e18-a518-def0fec9faa6)

#### Download the interaction demo

[CodexAnnotation-demo.zip](https://github.com/user-attachments/files/33110175/CodexAnnotation-demo.zip)

I’d be happy to discuss the interaction design or provide additional prototype details. Please feel free to reach out here on GitHub.
