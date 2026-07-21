# ProofPack Release Gate

**GPT-5.6 proposes. ProofPack proves—or rejects. Contradictory documents stay on `HOLD` instead of becoming fabricated mistakes.**

ProofPack is a pattern for any AI-era handoff where evidence must outrank confidence: AI proposes candidate bindings, deterministic rules judge admissibility, and humans keep release authority. Millwork fabrication is the proving ground because document contradictions can become expensive physical work.

The submitted app is a local, deterministic preflight for commercial-millwork handoffs. It compiles a bounded packet into exact source and rule traces, five transparent claim states, a `HOLD` or `READY` fabrication handoff, Markdown artifacts, and a SHA-256 reproducibility/integrity receipt.

The bundled Project Alder packet deliberately lands on `HOLD`: its finish sources disagree, its current traveler has not acknowledged the approved RFI, and its required finish sample is still pending. A recorded, schema-bound GPT-5.6 Sol proposal is reviewed locally: two exact traveler bindings are admitted, while an estimator's informal sample approval is rejected as `UNAUTHORIZED_AUTHORITY`. Applying the admitted bindings changes only the two causal claims; the independent sample blocker keeps the release on `HOLD`.

ProofPack is not trying to “magically understand any document”; it demonstrates a safer pattern for AI-era work: constrain the packet, preserve evidence anchors, classify claims transparently, and export a handoff humans can verify.

Submission media:

- **90-second judge path:** [JUDGES.md](JUDGES.md)
- **General pattern:** [PATTERN.md](PATTERN.md)
- **Devpost submission:** [devpost.com/software/proofpack-release-gate](https://devpost.com/software/proofpack-release-gate)
- **Hosted demo:** [proofpack-release-gate.tito943366.chatgpt.site](https://proofpack-release-gate.tito943366.chatgpt.site)
- **Three-minute video:** [youtu.be/4BB6HDbarMw](https://youtu.be/4BB6HDbarMw)
- **Product image:** [1200 × 630 release card](https://proofpack-release-gate.tito943366.chatgpt.site/og.png)

Submission receipt:

<!-- proofpack-receipt:start -->
`64c8ad55a4e9cdc223b09b5a68a730b4e5e16903a60699029786195bc3316f38`
<!-- proofpack-receipt:end -->

Recompute it with `npm run receipt:submission`; read the exact scope and self-reference normalization in [docs/SUBMISSION_RECEIPT.md](docs/SUBMISSION_RECEIPT.md). This submission ships with its own receipt because evidence lineage is the point.

Technical proof map:

| Judge-visible claim | Implementation | Regression evidence |
| --- | --- | --- |
| GPT-5.6 cannot set status or release | [`proposal.ts`](src/proofpack/proposal.ts) plus the closed [proposal schema](schemas/proofpack-proposal.schema.json) | [`proposal.test.ts`](tests/proposal.test.ts) |
| Exact anchors drive five transparent states | [`extract.ts`](src/proofpack/extract.ts), [`classify.ts`](src/proofpack/classify.ts), [`compile.ts`](src/proofpack/compile.ts) | [`compile.test.ts`](tests/compile.test.ts), [`classify.test.ts`](tests/classify.test.ts) |
| Two admitted bindings change only two claims | [`diff.ts`](src/proofpack/diff.ts), [`proposal.ts`](src/proofpack/proposal.ts) | [`proposal.test.ts`](tests/proposal.test.ts), [`ui-logic.test.ts`](tests/ui-logic.test.ts) |
| Public output is a typed allowlist projection | [`safety.ts`](src/proofpack/safety.ts) | [`safety.test.ts`](tests/safety.test.ts), [`privacy-scan.test.mjs`](tests/privacy-scan.test.mjs) |
| Identical normalized input reproduces the receipt | [`canonical.ts`](src/proofpack/canonical.ts), [`receipt.ts`](src/proofpack/receipt.ts) | [`receipt-diff.test.ts`](tests/receipt-diff.test.ts), [`no-network.test.ts`](tests/no-network.test.ts) |

## Judge quickstart: 90-second web path, then local CLI

Follow [JUDGES.md](JUDGES.md) first: **Review proposal → inspect one authority rejection → apply two bindings → verify exactly two claims change → confirm the independent blocker keeps `HOLD` → reset the fingerprint.** No API key, account, or runtime network connection is required for the local path after `npm ci`.

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

`npm ci` may contact the npm registry on a fresh machine. After dependencies are installed, the default ProofPack compiler, CLI demo, tests, challenge, and web application require **no API key, no account, and no runtime network connection**. Application code sends no outbound service, analytics, model, or API request; a hosted page still uses HTTP to load its own app assets.

## Web quickstart

```powershell
npm ci
npm run dev
```

Open the local URL printed by the development server. The single page compiles the bundled raw fixture through the same core used by the CLI; the React components do not contain a second classification implementation.

## Optional active GPT-5.6 Sol proposal mode

The optional developer command uses the pinned Codex CLI and an existing ChatGPT login; it does **not** read or require `OPENAI_API_KEY` or `CODEX_API_KEY`:

```powershell
npm run ai:propose
```

The adapter invokes `gpt-5.6-sol` explicitly with a read-only sandbox, ephemeral session, closed output schema, prompt over stdin, and no fallback model. GPT-5.6 proposes exact candidate bindings from the synthetic operator email. ProofPack then recompiles the current packet and deterministically admits or rejects each candidate. The model cannot express claim status, evidence effect or strength, authority, `READY`/`HOLD`, rules, event text, or public copy.

The command fails closed if ChatGPT authentication is absent, the pinned CLI/model is unavailable, tool activity occurs, output is malformed or stale, or both required traveler bindings are not admitted. A successful run writes only a sanitized ignored artifact under `outputs/ai-proposal/`; raw JSONL, reasoning, stderr, thread IDs, auth material, prompts, and absolute paths are not retained. Model generation is nondeterministic; review, materialization, compilation, diffs, and receipts are deterministic for identical accepted input.

## Alternate 2:54 hands-on judge path

| Time | Screen action | What it proves |
| --- | --- | --- |
| `0:00–0:18` | Load the page and point to the baseline `HOLD`, packet fingerprint, and five ledger rows. | A package that looks ready can still contain a release blocker. |
| `0:18–0:42` | Select **The packet establishes one coordinated finish basis**. Open the `finish-schedule.md` and `rfi-042.json` evidence cards. | The `CONFLICTED` result resolves to exact PL-17 and PL-18 source anchors and the named rule version. |
| `0:42–1:10` | Point to the remaining `VERIFIED`, `INFERRED`, `NEEDS CONFIRMATION`, and `BLOCKED` rows, then the next action and stop conditions. | Status is explicit and separate from the operational `HOLD`; `VERIFIED` is packet-and-ruleset scoped. |
| `1:10–1:28` | Click **Review GPT-5.6 proposal**. Show two `ADMISSIBLE` bindings and the `REJECTED / UNAUTHORIZED_AUTHORITY` sample claim. | Model candidates stay inert until exact anchors and authority pass deterministic review. |
| `1:28–1:48` | Click **Apply 2 admissible bindings** and show the causal diff. | Only `finish-coordinated` and `rfi-incorporated` change; sample approval keeps fabrication `BLOCKED` and the handoff on `HOLD`. |
| `1:48–1:58` | Click **Reset proposal gate** and point to the restored fingerprint. | Recompiling the original input restores the original reproducibility receipt. |
| `1:58–2:13` | Leave **Acknowledge HOLD** selected and click **Record human decision**. | A human record is bound to the packet fingerprint and does not change evidence statuses or clear blockers. |
| `2:13–2:30` | Expand **Operator handoff**, then **Allowlisted shareable export**. | Internal evidence and the separately constructed public allowlist projection are different artifacts. |
| `2:30–2:48` | Show `npm run ai:propose`, then a fresh `npm run verify` result. | GPT-5.6 Sol is an actual optional proposal mode; the local deterministic compiler remains the sole release authority and default runtime. |
| `2:48–2:55` | Return to the `HOLD` card and close. | “If the evidence disagrees, release stops—or the exception stays visible.” |

The final 2:54 walkthrough is in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md). It shows the active GPT-5.6 proposal path, deterministic admission/rejection, causal recompilation, reset, human `HOLD`, and fresh verification. The validated upload master has SHA-256 `90f7eb678e3499edaaf34f033eec179075ada49ba0178d4071804569bfe6c6cb`.

## Try to make it go `READY`

Run `npm run challenge` to replay three adversarial cases: unauthorized approval, an invented source line, and a stale packet target. All must be rejected, and the handoff must remain on `HOLD`. [The complete scratch-copy challenge](JUDGES.md#try-to-make-it-go-ready) includes a source edit so judges can verify that a changed packet invalidates the checked-in proposal instead of being silently accepted.

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
- The final breaking contract is explicitly identified as packet schema `proofpack.packet/v2`, rules schema `proofpack.rules/v2`, ruleset `2.0.0`, and engine `2.0.0`; legacy v1 inputs are rejected instead of being interpreted under changed semantics.
- The CLI confines declared inputs beneath the packet directory, rejects malformed UTF-8 with fatal decoding, invokes the core once, and publishes a complete artifact bundle only after successful compilation.
- The web adapter bundles eight raw fixture files plus one recorded proposal artifact produced by the active command, invokes the same core in the browser, and owns only interaction state.
- Supported selectors are one unambiguous text/Markdown line containing a declared string, predeclared log events whose declared fields match, and JSON Pointer equality or presence checks.
- Supported claim kinds are `direct`, `inference`, `exclusive`, and `gate`, with named dependencies and an optional claim-local authority resolver for exclusive values. A gate verifies only when every declared direct support matches and every declared dependency is `VERIFIED`; dependency-only gates are allowed, while a gate with neither verification route is rejected.
- Only `manifest.publicAlias`, `claim.publicTitle`, and `claim.publicNextAction` can supply authored strings to the shareable projection. Internal titles, actions, identifiers, source paths, evidence, and diagnostics have no projection route.
- There is no arbitrary JavaScript, regular-expression editor, plug-in execution, general expression language, OCR, PDF parsing, or natural-language extraction.

## Status and decision semantics

| Status | Meaning in a valid compile |
| --- | --- |
| `VERIFIED` | Required direct predicates, gate supports, dependencies, or resolver conditions are satisfied by valid anchors with no qualifying contradiction. |
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

It runs lint, typecheck, TypeScript and privacy-scanner tests, a production build, rendered-product tests, the CLI demo, and the repository/generated-artifact privacy scan. The fresh proposal-gate release run on 2026-07-21 passed 163 TypeScript tests, 21 privacy-scanner tests, and 3 rendered-product tests; the build, CLI demo, and final privacy scan also exited successfully. `npm run verify` never invokes Codex or the network.

Useful focused commands:

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run test
npm run build
npm run demo
npm run privacy:scan
npm run challenge
npm run receipt:submission
```

The automated web checks cover server-rendered product content, built-asset forbidden strings, proposal review/application/reset semantics through the real raw-module bundle, and accessible proposal and export controls. Responsive CSS and broader accessibility behavior were source-reviewed; cross-browser clipboard, download, focus-order, and phone-layout behavior remains outside the deterministic core guarantee.

## GPT-5.6 Sol and Codex contribution

GPT-5.6 Sol and Codex contributed during development, and GPT-5.6 Sol also powers the optional bounded proposal command. The default app and compiler remain local and model-free.

| Build task | Material contribution | Git evidence |
| --- | --- | --- |
| Product definition | GPT-5.6 Sol specialist passes challenged the generic concept, sharpened the commercial-millwork wedge, designed the bounded demo, and red-teamed status, receipt, and safety claims. Codex synthesized those reviews with entrant constraints into the design and implementation plan. | `aaaff70`, `a592c9a` |
| Closed contract and synthetic fixture | Codex implemented the schema validator and Project Alder packet through failing tests, then incorporated independent review findings. | `f9878e3`, `598d566` |
| Evidence compiler | Codex implemented canonicalization, exact anchors, status algebra, and deterministic handoff behavior; review added selector and resolver boundary cases. | `0fee4cf`, `a987bef` |
| Artifacts, receipt, CLI, and privacy gate | Codex implemented typed allowlist export, stage digests, causal diff, atomic CLI publication, and the repository privacy scanner; repeated review closed verification and credential-detection gaps. | `5c518c5`, `509cf13`, `d724219` |
| Product interface | Codex implemented the single-screen triptych, bounded replay/reset, evidence navigation, non-overriding human record, and artifact controls, followed by independent review and an accessible-control labeling fix. | `5c71f29`, `ab05eb8` |
| Final adversarial hardening | Pinned independent release reviews found and Codex closed public-projection, gate-grammar, malformed UTF-8, explicit sample-approval, and version-identity boundaries with failing regressions before implementation. | `e80810b`, `8ff67bc` |
| GPT-5.6 Proposal Gate | A real pinned `gpt-5.6-sol` Codex run proposed three bindings from synthetic evidence. The deterministic reviewer admitted two exact traveler bindings, rejected informal sample authority, preserved source-line lineage, and kept the release on `HOLD`. | `dcd6e65`, `b265688` |

The detailed, evidence-bounded record is in [docs/BUILD_PROVENANCE.md](docs/BUILD_PROVENANCE.md). Git commits show the resulting artifacts; the primary Codex thread is the source record for the human/model interaction.

## Human decisions retained

The entrant retained the decisions that define the product: the commercial-millwork problem and vocabulary, the synthetic-only data boundary, the local deterministic default, the model authority firewall, the five status meanings, `READY`/`HOLD` release semantics, the rule that a human exception cannot erase evidence, the final scope, and approval of the shipped behavior and submission narrative.

ProofPack does not make an autonomous fabrication decision. It computes a declared gate from supplied evidence; a person remains responsible for the real-world release decision and for validating any packet or rules used beyond this fictional demo.

## Limitations and exclusions

- One polished synthetic scenario, one ruleset, and one web route are included.
- The web demo does not accept arbitrary uploads; the CLI accepts only the closed packet and rule grammar.
- The default web app and compiler have no runtime LLM, RAG, chat, probabilistic confidence score, or automatic document understanding. The separate optional `ai:propose` developer command requires network access and an existing ChatGPT-authenticated Codex CLI.
- There is no PDF/OCR or email ingestion, authentication, database, persistence, collaboration, connector, notification, or ticket integration.
- The allowlisted export relies on explicit `PUBLIC`/`RESTRICTED` labels and declared lineage; it is not automatic redaction, anonymity, or PII detection.
- The receipt is reproducibility evidence, not source authenticity or tamper-proof provenance.
- Browser clipboard and downloads depend on browser permissions and are not part of the deterministic core guarantee.
- The public hosted demo, repository, YouTube video, and Devpost project page are live, and the primary `/feedback` Session ID is recorded below. Devpost reported `Project submitted!` on 2026-07-21.

## Primary build-session feedback record

> **PRIMARY `/feedback` SESSION ID: `019f813e-8569-7d32-bdbc-cc1b2cf829f7`**

This is the report ID returned by `/feedback` from the primary Codex build thread. Devpost displayed `Project submitted!` and the public project page showed `Submitted to OpenAI Build Week` on 2026-07-21.

## License

ProofPack is available under the [MIT License](LICENSE). The copyright line uses the collective label `ProofPack contributors` because the entrant’s legal name is not established in the repository.
