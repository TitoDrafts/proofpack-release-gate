# ProofPack 2:54 judge demo

## Recording setup — not on the clock

1. Run a real `npm run ai:propose` using the saved ChatGPT login. Record the explicit `gpt-5.6-sol`, read-only, ephemeral, closed-schema invocation and sanitized result. Do not show raw JSONL, auth files, notifications, or personal paths.
2. Run a fresh `npm run verify` and leave the successful summary visible.
3. Run `npm run dev`, reload the page, wait for baseline compilation, and confirm fingerprint `5e1bb8bc75f1`.
4. Use only the bundled fictional Project Alder packet.

## Timed script

| Time | Exact screen action | Voiceover |
| --- | --- | --- |
| `0:00–0:15` | Title, then baseline `HOLD` and Proposal Gate. | “In my drafting work, the shop prices one proposal, but the architect’s signed-off set governs fabrication. When those sources disagree, a PM or estimating miss can send the drawings—and the shop—in the wrong direction. ProofPack is the stop before that waste.” |
| `0:15–0:49` | Show the source → ledger → handoff flow, then the exact PL-17 and PL-18 anchors. | “ProofPack is a bounded deterministic compiler, not a confidence score. This conflicted claim points to the exact finish schedule and approved RFI lines. Every claim carries a status, evidence, rule, next action, and stop condition.” |
| `0:49–0:57` | Select `operator-email.md`; point back to unchanged `HOLD`. | “The synthetic operator email names Revision C, RFI-042, and PL-18. Raw prose alone has no authority, so HOLD does not change.” |
| `0:57–1:16` | Show the real `npm run ai:propose` terminal run. Shorten only dead wait time and label the edit. | “This optional AI mode invokes Codex with GPT-5.6 Sol explicitly pinned, read-only, ephemeral, and schema-constrained. It uses saved ChatGPT authentication, strips API-key variables, and fails instead of silently falling back. Every input is synthetic.” |
| `1:16–1:41` | Click **Review GPT-5.6 proposal**. Hold on two `ADMISSIBLE` cards and one `REJECTED / UNAUTHORIZED_AUTHORITY` card with exact source lines. | “The model returns candidate bindings, never claim statuses or a release decision. ProofPack admits the two exact traveler bindings. The estimator’s ‘sample looks approved’ line is rejected: only the sample register owns that authority. GPT-5.6 proposes; deterministic code decides what may enter.” |
| `1:41–1:58` | Click **Apply 2 admissible bindings**. Show exactly two changed claims, lineage fields, `fabrication-release = BLOCKED`, and `HOLD`. | “Human application materializes fixed resolver fields with source-line and review-digest lineage, then recompiles through the same core. Exactly two claims change. The independent sample gate remains blocked, so release stays on HOLD.” |
| `1:58–2:09` | Reset, then record a human HOLD acknowledgement. | “Reset restores the original input and receipt. A human can acknowledge the hold or request an exception, but that record cannot rewrite evidence or clear the blocker.” |
| `2:09–2:23` | Show runtime card and allowlisted export. | “The AI command is optional. The default app, compiler, tests, and demo stay local with no key or model call. Shareable Markdown is a typed allowlist, not an internal report scrubbed afterward.” |
| `2:23–2:32` | Show the fresh successful `npm run verify`. | “The release gate covers the compiler, proposal authority firewall, interface, privacy scanner, production build, and command-line demo.” |
| `2:32–2:46` | Entrant statement slide. | “I was surprised by how quickly this became clear and usable, and by how strong the AI-assisted voiceover and build process were. I’m proud to be learning AI while running my business and already putting it into my day-to-day work.” |
| `2:46–2:54` | Close on product rule and `HOLD`. | “GPT-5.6 proposes. ProofPack proves—or rejects. No source, no claim. No evidence, no release.” |

Total target runtime: **2 minutes 54 seconds**.

## Truth checks

- Model generation is nondeterministic; deterministic review and compilation begin after a candidate is supplied.
- The recorded run proves the requested workflow and sanitized result, not cryptographic backend identity or evidence truth.
- Do not say ProofPack authenticates documents, guarantees privacy, or is tamper-proof.
- Do not imply the admitted pair clears fabrication; the sample register deliberately keeps it blocked.
- Do not call the shareable export automatic redaction.
- Do not imply the default web app makes a model or API call.
