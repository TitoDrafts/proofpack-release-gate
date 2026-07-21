# ProofPack Release Gate

ProofPack is a local, deterministic preflight for commercial-millwork handoffs. It compiles a bounded packet into exact source and rule traces, five transparent claim states, a `HOLD` or `READY` fabrication handoff, Markdown artifacts, and a SHA-256 reproducibility/integrity receipt.

The bundled Project Alder packet deliberately lands on `HOLD`: its finish sources disagree, its current traveler has not acknowledged the approved RFI, and its required finish sample is still pending. The judge can add one synthetic receipt, watch only the causally affected claims change, and reset to the original packet fingerprint.

ProofPack is not trying to “magically understand any document”; it demonstrates a safer pattern for AI-era work: constrain the packet, preserve evidence anchors, classify claims transparently, and export a handoff humans can verify.

Submission media:

- **Hosted demo:** [proofpack-release-gate.tito943366.chatgpt.site](https://proofpack-release-gate.tito943366.chatgpt.site)
- **Three-minute video:** `REPLACE_BEFORE_SUBMISSION_WITH_PUBLIC_YOUTUBE_URL`
- **Product image:** [1200 × 630 release card](https://proofpack-release-gate.tito943366.chatgpt.site/og.png)

## Judge quickstart: local CLI demo

Prerequisite: Node.js `>=22.13.0` and npm. The most recent repository verification used Node.js `v24.15.0` and npm `11.12.1` on Windows.

```powershell
npm ci
npm run demo
```

Expected decision and claim states:

```text
Decision: HOLD
BLOCKED fabrication-release
VERIFIED field-dimensions-current
CONFLICTED finish-coordinated
NEEDS_CONFIRMATION rfi-incorporated
INFERRED traveler-current-finish
```

`npm ci` may contact the npm registry on a fresh machine. After dependencies are installed, ProofPack compilation and replay require no API key or runtime model call, and application code sends no outbound service, analytics, model, or API request. A hosted page still uses HTTP to load its own app assets.

## Web quickstart

```powershell
npm ci
npm run dev
```

Open the local URL printed by the development server. The single page compiles the bundled raw fixture through the same core used by the CLI; the React components do not contain a second classification implementation.

## Exact 2:55 judge path

| Time | Screen action | What it proves |
| --- | --- | --- |
| `0:00–0:18` | Load the page and point to the baseline `HOLD`, packet fingerprint, and five ledger rows. | A package that looks ready can still contain a release blocker. |
| `0:18–0:42` | Select **The packet establishes one coordinated finish basis**. Open the `finish-schedule.md` and `rfi-042.json` evidence cards. | The `CONFLICTED` result resolves to exact PL-17 and PL-18 source anchors and the named rule version. |
| `0:42–1:10` | Point to the remaining `VERIFIED`, `INFERRED`, `NEEDS CONFIRMATION`, and `BLOCKED` rows, then the next action and stop conditions. | Status is explicit and separate from the operational `HOLD`; `VERIFIED` is packet-and-ruleset scoped. |
| `1:10–1:40` | Click **Append synthetic Rev C receipt** and wait for the replay status. Show the causal diff. | Only `finish-coordinated` and `rfi-incorporated` change; sample approval keeps fabrication `BLOCKED` and the handoff on `HOLD`. |
| `1:40–1:58` | Click **Reset replay** and point to the restored fingerprint. | Recompiling the original input restores the original reproducibility receipt. |
| `1:58–2:13` | Leave **Acknowledge HOLD** selected and click **Record human decision**. | A human record is bound to the packet fingerprint and does not change evidence statuses or clear blockers. |
| `2:13–2:30` | Expand **Operator handoff**, then **Allowlisted shareable export**. | Internal evidence and the separately constructed public allowlist projection are different artifacts. |
| `2:30–2:48` | Show a terminal with a fresh `npm run verify` result and the commit table below. | The product was developed through test-first tasks and reviewed fixes; GPT-5.6 Sol and Codex were build-time collaborators, not runtime dependencies. |
| `2:48–2:55` | Return to the `HOLD` card and close. | “If the evidence disagrees, release stops—or the exception stays visible.” |

The word-for-word recording script is in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## Synthetic data, no client data

Every bundled source, identifier, company, project, assembly, rule, example, and generated artifact is fictional. The demonstration uses only Northstar Millworks Lab / Project Alder / Reception Desk AW-214. No client files, names, drawings, emails, screenshots, paths, or proprietary shop data were used in the fixture.

The repository privacy gate scans tracked and unignored text plus a freshly generated CLI artifact bundle for configured forbidden terms, user-profile paths, non-`.example` email addresses, obvious hard-coded credential assignments, private-key markers, and a synthetic leakage sentinel. That scanner is a bounded release check, not automatic PII detection or a general privacy guarantee.

## What `VERIFIED` and the receipt mean

`VERIFIED` means the rule’s declared direct predicates were satisfied by admissible anchors in this supplied packet and ruleset version, with no qualifying contradiction. It does **not** establish universal truth, source authenticity, authorship, external accuracy, or approval outside this packet.

The reproducibility/integrity receipt records unkeyed SHA-256 digests for the canonical semantic input, observations, claim ledger, handoff, and typed allowlisted shareable projection, together with schema, ruleset, and engine versions. Receipt verification recompiles the original packet and compares every closed receipt field.

The input digest is not a hash of untouched source-file bytes: Unicode, line endings, timestamp offsets, and declared nonsemantic ordering are normalized. The shareable digest covers projection data rather than rendered Markdown bytes. No separate digest covers operator Markdown, the UI’s causal diff, a human decision, a commit, a machine, or a session.

The receipt is **not** a digital signature, HMAC, trusted timestamp, identity proof, source-authentication mechanism, or tamper-proof provenance claim. Anyone able to change both the packet and receipt can compute a new matching pair. It is useful only when a reviewer has the packet, rules, implementation, and a receipt value to recompute and compare.

## Architecture and bounded grammar

```text
Bundled web sources ─┐
                     ├─> validate -> normalize -> resolve exact anchors
CLI filesystem I/O ──┘              -> classify -> derive HOLD / READY
                                    -> typed public allowlist
                                    -> stage receipt
                                    -> operator + shareable Markdown
```

- The shared `src/proofpack` core receives values and owns validation, normalization, anchor resolution, classification, handoff derivation, safety lineage, artifacts, diffs, and receipts. It contains no filesystem, DOM, wall-clock, randomness, locale-sensitive formatting, or network dependency.
- The CLI confines declared inputs beneath the packet directory, rejects malformed UTF-8 with fatal decoding, invokes the core once, and publishes a complete artifact bundle only after successful compilation.
- The web adapter bundles the seven raw fixture files, invokes the same core in the browser, and owns only interaction state.
- Supported selectors are one unambiguous text/Markdown line containing a declared string, predeclared log events whose declared fields match, and JSON Pointer equality or presence checks.
- Supported claim kinds are `direct`, `inference`, `exclusive`, and `gate`, with named dependencies and an optional claim-local authority resolver for exclusive values. A gate may be established by its matched direct supports or by all declared dependencies being verified; a gate with neither route is rejected.
- Only `manifest.publicAlias`, `claim.publicTitle`, and `claim.publicNextAction` can supply authored strings to the shareable projection. Internal titles, actions, identifiers, source paths, evidence, and diagnostics have no projection route.
- There is no arbitrary JavaScript, regular-expression editor, plug-in execution, general expression language, OCR, PDF parsing, or natural-language extraction.

## Status and decision semantics

| Status | Meaning in a valid compile |
| --- | --- |
| `VERIFIED` | Required direct predicates or declared gate/resolver conditions are satisfied by valid anchors with no qualifying contradiction. |
| `INFERRED` | A named deterministic inference has complete admissible premises, but no direct verification establishes the claim. |
| `NEEDS_CONFIRMATION` | Evaluation completed, but declared evidence or a required premise is missing or insufficient. |
| `CONFLICTED` | Qualifying evidence contradicts the claim, exclusive values remain unresolved, or a dependency conflict propagates. |
| `BLOCKED` | Direct, unopposed evidence establishes a declared hard-gate blocker. Missing evidence alone is not `BLOCKED`. |

Malformed packets, rules, sources, or anchors reject the run; validation errors are not converted into claim statuses. The overall decision is `READY` only when every critical claim is `VERIFIED`; every other critical state keeps it on `HOLD`.

## Verification

The complete local gate is:

```powershell
npm run verify
```

It runs lint, typecheck, TypeScript and privacy-scanner tests, a production build, rendered-product tests, the CLI demo, and the repository/generated-artifact privacy scan. The fresh final release run on 2026-07-21 passed 139 TypeScript tests, 21 privacy-scanner tests, and 3 rendered-product tests; the build, CLI demo, and final privacy scan also exited successfully.

Useful focused commands:

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run test
npm run build
npm run demo
npm run privacy:scan
```

The automated web checks cover server-rendered product content, built-asset forbidden strings, replay semantics through the real raw-module bundle, and an accessible export-label contract. Responsive CSS and broader accessibility behavior were source-reviewed, but those checks do not replace a real-browser clipboard, download, focus-order, and phone-layout pass.

## GPT-5.6 Sol and Codex build contribution

GPT-5.6 Sol and Codex contributed during development only:

| Build task | Material contribution | Git evidence |
| --- | --- | --- |
| Product definition | GPT-5.6 Sol specialist passes challenged the generic concept, sharpened the commercial-millwork wedge, designed the bounded demo, and red-teamed status, receipt, and safety claims. Codex synthesized those reviews with entrant constraints into the design and implementation plan. | `aaaff70`, `a592c9a` |
| Closed contract and synthetic fixture | Codex implemented the schema validator and Project Alder packet through failing tests, then incorporated independent review findings. | `f9878e3`, `598d566` |
| Evidence compiler | Codex implemented canonicalization, exact anchors, status algebra, and deterministic handoff behavior; review added selector and resolver boundary cases. | `0fee4cf`, `a987bef` |
| Artifacts, receipt, CLI, and privacy gate | Codex implemented typed allowlist export, stage digests, causal diff, atomic CLI publication, and the repository privacy scanner; repeated review closed verification and credential-detection gaps. | `5c518c5`, `509cf13`, `d724219` |
| Product interface | Codex implemented the single-screen triptych, bounded replay/reset, evidence navigation, non-overriding human record, and artifact controls, followed by independent review and an accessible-control labeling fix. | `5c71f29`, `ab05eb8` |

The detailed, evidence-bounded record is in [docs/BUILD_PROVENANCE.md](docs/BUILD_PROVENANCE.md). Git commits show the resulting artifacts; the primary Codex thread is the source record for the human/model interaction.

## Human decisions retained

The entrant retained the decisions that define the product: the commercial-millwork problem and vocabulary, the synthetic-only data boundary, the model-free runtime, the five status meanings, `READY`/`HOLD` release semantics, the rule that a human exception cannot erase evidence, the final scope, and approval of the shipped behavior and submission narrative.

ProofPack does not make an autonomous fabrication decision. It computes a declared gate from supplied evidence; a person remains responsible for the real-world release decision and for validating any packet or rules used beyond this fictional demo.

## Limitations and exclusions

- One polished synthetic scenario, one ruleset, and one web route are included.
- The web demo does not accept arbitrary uploads; the CLI accepts only the closed packet and rule grammar.
- There is no runtime LLM, RAG, chat, probabilistic confidence score, or automatic document understanding.
- There is no PDF/OCR or email ingestion, authentication, database, persistence, collaboration, connector, notification, or ticket integration.
- The allowlisted export relies on explicit `PUBLIC`/`RESTRICTED` labels and declared lineage; it is not automatic redaction, anonymity, or PII detection.
- The receipt is reproducibility evidence, not source authenticity or tamper-proof provenance.
- Browser clipboard and downloads depend on browser permissions and still need the final hands-on recording pass noted above.
- The public hosted demo is live; no public repository URL, YouTube URL, `/feedback` Session ID, or submission confirmation is claimed in this repository yet.

## Required `/feedback` step

> **REQUIRED BEFORE SUBMISSION — PRIMARY `/feedback` SESSION ID: `REPLACE_WITH_PRIMARY_THREAD_FEEDBACK_SESSION_ID`**

Run `/feedback` in the primary Codex build thread, then replace that placeholder here and in the submission form. Do not treat the submission as complete until the repository, hosted demo, public YouTube video, feedback Session ID, and submission confirmation are all present.

## License

ProofPack is available under the [MIT License](LICENSE). The copyright line uses the collective label `ProofPack contributors` because the entrant’s legal name is not established in the repository.
