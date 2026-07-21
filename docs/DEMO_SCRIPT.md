# ProofPack exact 2:55 demo script

## Recording setup — not on the clock

1. Run a fresh `npm run verify` in the first terminal and leave its final successful output visible for the verification beat.
2. After verification finishes, run `npm run dev` in a second terminal; open the exact local URL printed by the server.
3. Reload the page and wait for the live status to say the baseline compiled. Confirm the fingerprint is `9d8a5168a625` and no human decision is recorded.
4. Use only the bundled fictional Project Alder packet. Do not open personal files, notifications, browser history, or any real project material while recording.
5. Record at a readable desktop width. Keep the pointer still except for the actions below.

## Timed script

| Time | Exact screen action | Voiceover |
| --- | --- | --- |
| `0:00–0:18` | Start on the full product view. Point to **HOLD**, the short packet fingerprint, and the five status rows. | “This package says it is ready for fabrication, but one file calls for natural oak, a later approved RFI calls for smoked walnut, and the finish sample is still pending. ProofPack stops this fictional release before a cut ticket is issued.” |
| `0:18–0:42` | Select **The packet establishes one coordinated finish basis**. In **Exact evidence**, open `finish-schedule.md`, then open `rfi-042.json`; pause on each highlighted locator and excerpt. | “The result is not a confidence score. This `CONFLICTED` claim points to both exact source anchors and the rule that evaluated them: PL-17 in the finish schedule and PL-18 in RFI-042. No source, no claim.” |
| `0:42–1:10` | Point down the ledger rows in order, then move to **Next safe action**, **Active stop conditions**, and the packet fingerprint. | “The same bounded compiler produces all five states: verified, inferred, needs confirmation, conflicted, and blocked. `VERIFIED` means only that this packet satisfies this ruleset’s declared predicates. The SHA-256 receipt records canonical stage digests for replay; it is not a signature or proof that a source is authentic.” |
| `1:10–1:40` | Click **Append synthetic Rev C receipt**. Wait for **Replay compiled**. Show the appended raw line, the two changed rows, the causal diff, and unchanged `fabrication-release`. | “Now I append one visible synthetic traveler acknowledgement and recompile through the same core. Only finish coordination and RFI incorporation move to `VERIFIED`. The unrelated sample approval is still pending, so fabrication stays `BLOCKED` and the overall handoff stays on `HOLD`.” |
| `1:40–1:58` | Click **Reset replay**. Point to the restored short fingerprint and the returned conflict/missing states. | “Reset removes that added evidence, recompiles the original raw packet, and restores the original fingerprint. The compiler never consults the wall clock or randomness; its timestamps are explicit, normalized packet data.” |
| `1:58–2:13` | In **Human decision**, leave **Acknowledge HOLD** selected and click **Record human decision**. Point to the recorded packet fingerprint, then back to the unchanged ledger. | “The operator can acknowledge the hold or request a documented exception, but that record cannot rewrite evidence, clear a blocker, or turn `HOLD` into `READY`.” |
| `2:13–2:30` | Expand **Operator handoff** and briefly show its evidence ledger. Collapse it; expand **Allowlisted shareable export** and show its verified outcomes and digest. | “The internal handoff retains evidence detail. The shareable Markdown is a separately constructed allowlist of eligible `VERIFIED` public-lineage outcomes—not an internal report scrubbed after the fact.” |
| `2:30–2:48` | Switch to the terminal showing the completed `npm run verify`, then briefly show `git log --oneline`. | “During Build Week, GPT-5.6 Sol specialists challenged positioning, semantics, safety, and the demo. Codex turned those reviews and my constraints into tested commits for the compiler, receipt, CLI, privacy gate, and interface. The runtime uses no model or API key.” |
| `2:48–2:55` | Return to the app’s `HOLD` decision and stop moving the pointer. | “If the evidence disagrees, release stops—or the exception stays visible.” |

Total scripted runtime: **2 minutes 55 seconds**.

## Recording truth checks

- Do not say ProofPack proves truth, authenticates documents, guarantees privacy, or is tamper-proof.
- Do not imply the replay clears the fabrication gate; sample approval deliberately keeps it blocked.
- Do not call the shareable export automatic redaction.
- Do not say the application used client data or calls GPT-5.6 at runtime.
- Do not show a hosted URL, repository URL, test result, `/feedback` Session ID, or submission status until it actually exists.
