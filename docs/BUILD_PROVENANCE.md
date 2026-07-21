# ProofPack build provenance

This record describes how GPT-5.6 Sol, Codex, independent review agents, and the entrant contributed to ProofPack during the 2026-07-21 build. It is limited to artifacts visible in the primary build thread, Git history, task reports, source, and fresh verification output.

GPT-5.6 Sol and Codex are build-time collaborators, not runtime dependencies. The shipped compiler makes no model call and requires no API credential.

## Evidence boundary

- Git history establishes the commits, authorship label, timestamps, and resulting files listed below. It is not a signed attestation of who typed each line.
- The primary Codex thread is the record of prompts, specialist analyses, implementation coordination, review, and entrant approvals.
- Task reports under `.superpowers/sdd/` preserve RED/GREEN observations and reviewer outcomes locally; that directory is intentionally ignored by Git.
- No `/feedback` Session ID is present yet. The entrant must add the real ID returned by the primary thread before submission.

## Dated build record

All listed commits are dated 2026-07-21 in the repository.

| Stage | What happened | Commit evidence |
| --- | --- | --- |
| 2026-07-21 brainstorming and product design | GPT-5.6 Sol specialist passes covered competition positioning, product/demo design, and a technical red team. Codex synthesized those advisory outputs with the entrant’s constraints into the release-gate specification. | `aaaff70` — `docs: define ProofPack Release Gate design` |
| Execution plan | Codex decomposed the approved design into closed contracts, test-first tasks, review gates, and explicit submission boundaries. | `a592c9a` — `docs: add ProofPack implementation plan` |
| Task 1: contract and fixture | Codex implemented a closed validator and the fictional Project Alder packet. An independent review drove additional rejection cases and exact diagnostic-path fixes. | `f9878e3`, `598d566` |
| Task 2: compiler | Codex implemented normalization, exact anchor extraction, status algebra, and handoff derivation. Review drove fixes for JSON Pointer root handling, selector/media compatibility, timestamp scoping, and exclusive resolver membership. | `0fee4cf`, `a987bef` |
| Task 3: artifacts and CLI | Codex implemented the typed allowlist projection, operator/shareable Markdown, stage receipt, receipt comparison, causal diff, CLI, atomic publication, and privacy scan. Formal reviews drove lineage, test-gate, generated-inventory, and credential-detector hardening. | `5c518c5`, `509cf13`, `d724219` |
| Task 4: product surface | Codex implemented the single-route release cockpit, raw-source navigation, five-state ledger, replay/reset, causal diff, packet-bound human decision record, and compiled Markdown controls. Independent review drove interaction, stale-state, accessibility, and export-control labeling fixes. | `5c71f29`, `ab05eb8` |
| Task 5 steps 1–2: submission documentation | Codex audited the actual scripts, source, Git history, and test evidence before writing the README, provenance, exact 2:55 demo, submission draft, and MIT license. | `944e6d1` — `docs: prepare ProofPack Build Week submission` |
| Task 5 release | Codex directed one synthetic editorial social-card generation, inspected its exact text, resized it to 1200 × 630, bound production metadata, and published the verified build through Sites. | `26f7c7f`, `55287a6` |
| Final adversarial hardening | A pinned independent release review found public-projection, dependency-gate, and malformed UTF-8 boundaries. Codex reproduced each with a failing regression, implemented the bounded fixes, and ran the complete release gate. | `e80810b` |
| Release-gate safety follow-up | A second pinned probe proved that non-pending sample states could clear the fabrication gate. Codex added explicit `APPROVED` support, explicit `REJECTED` blocking, missing-evidence hold coverage, and new packet/rules/engine identities before re-running the release gate. | `8ff67bc` |

## Material GPT-5.6 Sol specialist contributions

Three focused specialist passes in the primary build thread materially influenced the shipped design:

- **Competition strategy:** challenged a generic evidence-tool position and recommended the concrete commercial-millwork release boundary and Work and Productivity framing.
- **Product and demo:** shaped the single-screen source → ledger → handoff triptych, the synthetic PL-17/PL-18 conflict, and the bounded append/reset proof moment.
- **Technical red team:** sharpened exact status meanings, validation failure behavior, canonical receipts, public-safety lineage, no-network verification, and the limits of `VERIFIED` and receipt claims.

These were advisory design and review contributions. They did not make runtime release decisions, supply client material, or replace entrant approval.

## Material Codex contributions by task

Codex used the specialist findings and entrant-approved constraints to:

1. write the design and executable plan;
2. construct adversarial synthetic fixtures and closed-schema tests;
3. implement and review the validator, evidence compiler, status evaluators, handoff, artifacts, receipt, diff, CLI, privacy scanner, and UI;
4. run focused RED/GREEN cycles, commission independent reviews, and implement review findings;
5. run the repository gates and prepare evidence-bounded submission documentation.

The project does not claim that a model independently invented the domain rules or approved the final behavior.

## Human decisions retained by the entrant

The entrant retained and approved:

- the commercial-millwork problem, terminology, and release consequences;
- the fictional-only fixture and no-client-data boundary;
- the choice to keep runtime compilation local, deterministic, and model-free;
- the exact five claim statuses and the separate `READY`/`HOLD` operational decision;
- the rule that a human acknowledgement or exception request cannot alter evidence classifications or clear a blocker;
- the final product positioning, scope exclusions, demo story, and approval of the documented build artifact.

## Test-first and review evidence

The local task reports record these observed transitions:

| Task | Initial RED evidence | GREEN/review evidence |
| --- | --- | --- |
| Task 1 | The first validator test failed because the required module did not exist. | The initial 3 tests passed; review expanded the validator matrix to 40 passing tests and closed the reported invariants. |
| Task 2 | Four focused tests failed against the absent compiler API. | The compiler suite reached 41 focused passing tests; the formal fix pass ended with 88 cumulative TypeScript tests passing. |
| Task 3 | Safety, receipt, replay, and CLI tests first failed because those APIs and scripts did not exist. | The final formal follow-up reported 126 TypeScript, 21 privacy-scanner, and 2 rendered-shell tests passing, plus a successful build, demo, and privacy scan. |
| Task 4 | The rendered product contract first passed 0 of 2 tests against the starter shell; UI-model tests failed on their intentionally absent module/exports. | The final Task 4 gate reported 132 TypeScript, 21 privacy-scanner, and 2 rendered-product tests passing, with build, demo, and privacy scan successful. |

## Fresh final release verification

On 2026-07-21, after the documentation changes:

- `npm run verify` exited `0`.
- 140 TypeScript tests, 21 privacy-scanner tests, and 3 rendered-product tests passed.
- lint, typecheck, the production build, CLI demo, and final privacy scan completed successfully.
- the CLI demo emitted `HOLD` and all five expected statuses.
- `git diff --check` exited `0` before commit.

These are local command results, not an external certification. The automated web suite does not perform a full cross-browser clipboard/download, focus-order, or phone-layout matrix; those behaviors remain outside the deterministic core guarantee.

## Claim boundaries

- `VERIFIED` is limited to the supplied packet and named ruleset version; it does not prove universal truth or source authenticity.
- The reproducibility/integrity receipt contains unkeyed canonical SHA-256 stage digests; it is not a signature, HMAC, trusted timestamp, or tamper-proof provenance system. Its input digest is semantic rather than a hash of untouched source-file bytes, and its shareable digest covers projection material rather than rendered Markdown bytes.
- The receipt does not separately bind operator Markdown, causal diff output, human decisions, commit identity, machine identity, or the primary Codex session. Anyone able to change both the packet and receipt can recompute a matching pair.
- The allowlisted shareable export is constructed from eligible verified public-lineage outcomes; it is not heuristic scrubbing or automatic PII detection.
- The privacy scanner checks declared patterns and configured forbidden terms; it cannot establish that arbitrary future input is safe.

## Required feedback record

**PRIMARY `/feedback` SESSION ID — REPLACE BEFORE SUBMISSION:** `REPLACE_WITH_PRIMARY_THREAD_FEEDBACK_SESSION_ID`
