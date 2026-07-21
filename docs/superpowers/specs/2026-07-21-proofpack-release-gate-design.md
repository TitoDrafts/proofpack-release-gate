# ProofPack Release Gate Design

**Date:** 2026-07-21

**Track:** OpenAI Build Week 2026 — Work and Productivity

**Runtime posture:** Fully local and deterministic; no API key, model call, analytics, external font, CDN asset, or outbound network request

**Data posture:** Synthetic fixtures only; no client files, names, drawings, email, paths, identifiers, screenshots, or proprietary shop data

## Product Thesis

ProofPack Release Gate is the handoff flight recorder for commercial millwork. It compiles a bounded packet of raw synthetic finish schedules, RFI records, revision receipts, shop notes, and approvals into an evidence-linked fabrication handoff: what is verified, what is inferred, what is missing, what conflicts, what blocks release, and the next safe action.

The product does not claim to understand arbitrary documents, prove universal truth, authenticate source origin, or make probabilistic trust judgments. It proves that the supplied packet was transformed reproducibly under a named ruleset and that every emitted decision traces to validated evidence anchors.

Public promise:

> No source, no claim. No evidence, no release.

README sentence:

> ProofPack is not trying to “magically understand any document”; it demonstrates a safer pattern for AI-era work: constrain the packet, preserve evidence anchors, classify claims transparently, and export a handoff humans can verify.

## Audience and Problem

The primary user is a commercial-millwork drafter, project manager, procurement coordinator, or shop lead receiving a package at a release boundary. Small mismatches between an approved RFI, finish schedule, traveler, sample register, and release note can survive in separate files until fabrication begins.

ProofPack provides an inspectable preflight before a package crosses that boundary. The initial wedge is commercial millwork because the builder has firsthand domain knowledge; the implementation remains a reusable bounded compiler rather than a hard-coded dashboard.

## Success Criteria

The submitted version succeeds when it can:

1. Load one polished synthetic commercial-millwork packet containing Markdown, JSON, and log sources.
2. Validate the packet and its finite rules before producing any authoritative artifact.
3. Resolve declared anchors to exact text lines, JSON pointers, or log events.
4. Normalize admissible observations with stable IDs, source metadata, stance, strength, safety label, and locator.
5. Classify claims into `VERIFIED`, `INFERRED`, `NEEDS_CONFIRMATION`, `CONFLICTED`, or `BLOCKED` using pure functions and explicit reason codes.
6. Derive a separate overall operational decision of `READY` or `HOLD`.
7. Show the exact source → anchor → rule → claim → handoff trace.
8. Let a judge append one synthetic evidence receipt and recompile through the real core.
9. Show a causal diff: affected observations, status transitions, handoff changes, and unchanged unrelated claims.
10. Produce a canonical SHA-256 reproducibility receipt and restore the original receipt after replay reset.
11. Generate an internal operator handoff and a separately constructed allowlisted shareable Markdown export.
12. Produce the same semantic ledger and public digest from the web UI and CLI.
13. Pass deterministic, mutation, conflict, anchor, safety, no-outbound-network, UI/CLI parity, lint, typecheck, build, and browser-flow verification.

## Synthetic Scenario

The bundled packet is fictional:

- Company: Northstar Millworks Lab.
- Project: Project Alder.
- Assembly: Reception Desk AW-214.
- No value is copied or derived from a real client artifact.

Raw sources:

- `handoff-draft.md`: says finish coordination is complete and the assembly is ready to fabricate.
- `finish-schedule.md`: identifies exposed faces as `PL-17 Natural Oak`.
- `rfi-042.json`: a later approved response specifies `PL-18 Smoked Walnut`.
- `shop-notes.log`: records that traveler Rev B has PL-17 stock staged and lacks an RFI acknowledgment.
- `field-check.json`: directly verifies current field dimensions.
- `sample-register.json`: records PL-18 sample approval as pending.
- `incoming-receipts.log`: initially empty; the replay appends a synthetic Rev C acknowledgment.
- `release-rules.json`: declares the finite candidate claims, anchors, dependencies, hard gates, visibility projections, next actions, and stop conditions.

Baseline claim outcomes:

- `VERIFIED`: field dimensions are current.
- `INFERRED`: the active traveler likely still uses PL-17.
- `NEEDS_CONFIRMATION`: incorporation of RFI-042 into a current traveler has no direct receipt.
- `CONFLICTED`: the packet does not establish a single coordinated finish basis.
- `BLOCKED`: AW-214 may not be released to fabrication while critical finish and sample prerequisites are unresolved.

Baseline handoff:

> HOLD RELEASE. Dimensions are verified, but the finish basis conflicts and RFI incorporation is unconfirmed. Do not issue a cut ticket. Next: issue traveler Rev C citing RFI-042 and attach PL-18 sample approval.

The replay appends this visibly to `incoming-receipts.log`:

```text
traveler_ack rfi=RFI-042 rev=C finish=PL-18 cut_started=false
```

Recompilation resolves only the RFI-incorporation and finish-coordination consequences. Fabrication remains on hold because sample approval is still pending. This restraint is intentional and demonstrates that one favorable input does not turn unrelated gates green.

## Status Algebra

Packet or rule validation errors reject the run atomically; they never degrade into a claim status.

An observation is admissible only when its source exists, selector resolves, timestamp is valid or explicitly absent, stance/strength/safety labels are recognized, and its locator and excerpt match normalized source bytes.

Evidence strengths:

- `DIRECT`: explicitly establishes the target or gate value.
- `CORROBORATING`: satisfies a named deterministic inference premise.
- `CONTEXT`: may be displayed but cannot establish a claim.

Status semantics:

| Status | Meaning |
| --- | --- |
| `BLOCKED` | Direct, unopposed evidence establishes that a rule-declared hard prerequisite is false. Missing evidence alone is not blocked. |
| `CONFLICTED` | Qualifying evidence conflicts with the target or mutually exclusive values remain active. A critical gate with mixed evidence is conflicted and still forces overall `HOLD`. |
| `VERIFIED` | Every direct verification predicate is satisfied by valid anchors with no qualifying contradiction. It means verified against this packet and ruleset version only. |
| `INFERRED` | A named deterministic inference rule is satisfied by admissible premises, with no direct verification or qualifying contradiction. The emitted trace includes the full premise chain. |
| `NEEDS_CONFIRMATION` | Evaluation completed but declared evidence is missing, contextual, stale, or insufficient. |

Precedence for a valid claim evaluation:

1. Mixed mutually exclusive evidence → `CONFLICTED`.
2. Unopposed direct blocker on a hard gate → `BLOCKED`.
3. Other qualifying contradiction → `CONFLICTED`.
4. Complete direct predicates → `VERIFIED`.
5. Complete named inference premises → `INFERRED`.
6. Otherwise → `NEEDS_CONFIRMATION`.

A gate is positively established only when every declared direct support matches and every declared dependency is `VERIFIED`. A dependency-only gate may derive from verified dependencies; a gate with neither a direct-support route nor a dependency route is invalid rather than an unresolvable status.

Every claim result contains `status`, stable `reasonCodes`, `ruleId`, `ruleVersion`, sorted `evidenceIds`, sorted `missingPredicates`, `nextAction`, and `stopCondition` where applicable. No numeric confidence or arbitrary trust score is used.

Overall operational decision:

- `HOLD` when any critical claim is `BLOCKED`, `CONFLICTED`, `INFERRED`, or `NEEDS_CONFIRMATION`.
- `READY` only when every critical claim is `VERIFIED`.

A human decision record may acknowledge `HOLD` or request a documented exception. It never changes evidence classifications, removes an active blocker, or converts `HOLD` to `READY`.

## Architecture

One repository contains one pure TypeScript compiler core and two thin adapters:

```text
Web adapter ─┐
             ├─ validate → normalize sources → resolve anchors
CLI adapter ─┘              → observations → classify claims
                              → derive handoff → receipt
                              → internal projection
                              → allowlisted shareable projection → Markdown
```

### Core

The core receives packet data and source text as values. It has no filesystem, DOM, wall-clock, randomness, locale dependency, or network access. It owns schema validation, canonicalization, anchor resolution, observation derivation, status algebra, handoff derivation, public-safety lineage, canonical serialization, SHA-256 receipts, and artifact diffs.

The final breaking identity is packet schema `proofpack.packet/v2`, rules schema `proofpack.rules/v2`, ruleset `2.0.0`, and engine `2.0.0`. Earlier v1 packets are rejected so changed public-field and gate semantics cannot be confused with the published final contract.

The finite selector set is:

- Markdown/text/log exact-line contains.
- Predeclared log key/value event match.
- JSON Pointer equality or presence.
- Simple `all` / `any` composition over declared predicates.

There is no arbitrary JavaScript, `eval`, plugin execution, free-form regex editor, general expression language, OCR, PDF parser, or natural-language extraction.

### Web Adapter

The web app is a single route and a single coherent product surface. It loads bundled raw synthetic inputs, invokes the shared compiler in the browser, renders source/rule diagnostics, supports the bounded append/reset replay, shows the causal diff and receipt, records a non-overriding human decision, and downloads/copies Markdown.

The app makes no outbound requests and uses no remote assets, runtime API route, server action, analytics, authentication, database, or persistence. Device state is limited to the active in-memory replay during the session.

### CLI Adapter

The CLI reads the same packet and source directory, invokes the shared core, prints the operational decision and receipt, writes requested artifacts only after the complete run succeeds, and can verify a receipt by recompiling the original packet.

Exit codes:

- `0`: valid evaluation, regardless of `READY` or `HOLD`.
- `2`: invalid packet, rule, source, or anchor; no authoritative output.
- `3`: shareable export rejected; no shareable artifact.
- `70`: unexpected invariant failure.

### Determinism

- `asOf` is explicit packet data; the compiler never calls the clock.
- Text normalizes Unicode to NFC and CRLF/CR to LF.
- Timestamp offsets normalize to UTC.
- Path separators normalize for semantic locators.
- IDs derive from canonical content rather than array position or randomness.
- Non-semantic arrays and object keys sort explicitly.
- Artifacts use stable reason codes and trusted templates.
- Expected artifacts live only in tests and are not importable by application code.

Receipt fields:

- schema version;
- ruleset ID/version;
- engine version;
- SHA-256 algorithm identifier;
- canonical input digest;
- normalized observation digest;
- ledger digest;
- internal handoff digest;
- shareable artifact digest.

The receipt is a reproducibility/integrity receipt, not a digital signature, authenticity proof, or tamper-proof provenance claim.

## Public-Safety Model

ProofPack does not generate an internal document and scrub it heuristically.

Each source-derived value is labeled `PUBLIC` or `RESTRICTED`; missing or ambiguous labels reject shareable export. Safety lineage propagates through observations, claims, explanations, handoffs, and derived text. The shareable export is built from a separate typed allowlisted view model.

The authored shareable string boundary is explicit: `manifest.publicAlias`, `claim.publicTitle`, and `claim.publicNextAction` are the only input strings allowed into that projection. Internal packet titles and next actions never supply shareable text, and missing explicit public fields reject the packet contract.

The shareable projection:

- uses fictional public aliases;
- excludes restricted filenames, locators, IDs, hashes, excerpts, diagnostics, counts, and reason text when they could leak restricted facts;
- escapes untrusted Markdown;
- disallows raw HTML and source-provided links/images;
- exposes a digest of the final shareable projection only;
- rejects output when restricted text reaches a public field or safety lineage is ambiguous.

Automated regressions seed the bounded projection's internal authored fields and scan shareable JSON, Markdown, and generated artifacts for a recognizable sentinel. Separate rendered-product tests and a hands-on browser pass cover the built interface and export controls; this is bounded release evidence, not proof that every arbitrary string surface is safe.

The UI and README call this an “allowlisted shareable export,” not a guarantee that arbitrary input is automatically safe or anonymous.

## Product Experience

The first viewport is an executive-first single-screen triptych:

```text
┌ ProofPack Release Gate · LOCAL · DETERMINISTIC · packet fingerprint ┐
│ Sources 7 → Anchors → Observations → Claims 5 → Handoff             │
├──────────────────┬────────────────────────┬─────────────────────────┤
│ RELEASE PACKET   │ RELEASE LEDGER         │ FABRICATION HANDOFF     │
│ source list      │ five claim rows        │ HOLD / READY            │
│ raw excerpt      │ selected rule trace    │ Done / Not done         │
│ append/reset     │ causal diff            │ Next action / Gates     │
└──────────────────┴────────────────────────┴─────────────────────────┘
```

Interaction principles:

- Clicking a claim highlights its exact source anchor and rule trace.
- Status uses text and iconography in addition to color.
- The append replay visibly changes raw input before recompilation.
- The diff highlights only changed claims and handoff lines.
- Reset recompiles and restores the exact original receipt.
- The human decision control preserves machine classifications.
- Internal and shareable Markdown previews are clearly separated.

Visual language:

- Warm stock-paper canvas.
- Graphite typography and borders.
- Safety-orange accent.
- Restrained semantic status colors with accessible contrast.
- Monospace for evidence, locators, fingerprints, and rules.
- Plain sans-serif for decisions and handoff prose.
- No AI sparkles, generic gradients, cockpit gauges, stock imagery, remote fonts, or decorative animation.

## Error Handling

The compiler rejects a run atomically for unknown schema/rule/operator versions, unknown enum values, duplicate IDs, missing source references, malformed timestamps, unsafe paths, invalid JSON pointers or line locators, anchor/excerpt mismatches, rule cycles, output collisions, or invariant failures.

A well-formed selector that finds no evidence is a legitimate missing predicate and may yield `NEEDS_CONFIRMATION`. A malformed selector or source is a run error.

Diagnostics use stable codes, deterministic ordering, JSON paths or source locators, and safe messages without raw stack traces or restricted excerpts. All artifacts are computed in memory before any file is written.

The web app displays a bounded error panel and preserves the last valid packet only as a clearly labeled previous run; it never presents partial output as current.

## Verification Strategy

Test-driven development is mandatory for production behavior. Every new core function begins with a failing test observed for the expected reason.

Required automated evidence:

- Table-driven boundary test for every status and precedence collision.
- Repeated-run determinism.
- Shuffled non-semantic input ordering.
- CRLF/LF and Unicode normalization.
- Locale/timezone independence.
- Anchor re-resolution, off-by-one, and tamper rejection.
- Relevant mutation changes the expected observation, claim, digest, and handoff.
- Unrelated claims remain semantically identical after mutation.
- Contradiction-only, mixed evidence, mutually exclusive values, and hard-gate disagreement.
- Restricted-sentinel leakage and Markdown injection.
- Missing safety label and ambiguous lineage rejection.
- Disabled `fetch`, XHR, WebSocket, `http`, and `https` during core tests.
- UI/CLI semantic ledger and shareable digest parity.
- Input schema rejects precomputed statuses or output artifacts.
- Clean install, lint, typecheck, unit/integration tests, production build, CLI compile, receipt verification, privacy scan, and one browser end-to-end replay/export flow.

The repository exposes one `npm run verify` command for the complete local gate and one `npm run demo` command for the judge path.

## Three-Minute Demo

- **0:00–0:18:** “This package looks ready for fabrication. It isn’t.” Explain natural oak versus smoked walnut and what release means.
- **0:18–0:38:** Introduce the local deterministic compiler and operator-authored rules.
- **0:38–0:58:** Compile raw sources through anchors, observations, claims, and handoff; show `HOLD`.
- **0:58–1:25:** Inspect the finish conflict’s exact source anchors and applied rule.
- **1:25–1:58:** Append the Rev C acknowledgment, recompile, show causal diff and changed receipt; note the unrelated sample gate remains.
- **1:58–2:18:** Reset and restore the exact original receipt.
- **2:18–2:36:** Record the human `HOLD` decision; evidence statuses do not change.
- **2:36–2:48:** Show/copy the allowlisted shareable Markdown.
- **2:48–2:57:** Show the green verification command and explain precise GPT-5.6/Codex contributions.
- **2:57–3:00:** “If the evidence disagrees, release stops—or the exception stays visible.”

## Codex and GPT-5.6 Build Provenance

GPT-5.6 Sol and Codex are build-time collaborators, not runtime dependencies. The README and demo will document their material contributions:

- competition and adjacent-product analysis;
- domain-wedge selection;
- status algebra and failure semantics;
- adversarial fixture design;
- architecture decomposition;
- test-first implementation and review;
- deterministic receipt and replay design;
- public-safety threat modeling;
- UX and demo sequencing.

Human decisions retained by the entrant include the commercial-millwork problem, synthetic-only boundary, runtime determinism, release semantics, final product positioning, and approval of the shipped behavior.

The primary build thread’s `/feedback` Session ID must be added to the submission and README before final submission.

## Ruthless Scope Exclusions

The Build Week version has one route, one ruleset, and one primary fixture. It does not include:

- runtime LLM/API calls, embeddings, agents, RAG, or chat;
- real client or company data;
- arbitrary uploads, PDF/OCR, email ingestion, or screenshots;
- authentication, accounts, persistence, collaboration, or cloud storage;
- connectors, ticket creation, notifications, or vendor integrations;
- arbitrary rule editing, plugins, custom JavaScript, or a general DSL;
- numeric confidence scores or probabilistic logic;
- automated PII detection or blanket safety guarantees;
- digital signatures, PKI, blockchain, or “tamper-proof” claims;
- graph visualization, large charts, or multiple dashboards;
- PDF export, PWA/service worker, Docker, realtime updates, or internationalization;
- more than one polished demo scenario before the full verification and submission package is complete.

## Submission Positioning

**Project name:** ProofPack Release Gate  
**Descriptor:** The handoff flight recorder for commercial millwork.  
**Track:** Work and Productivity

Elevator pitch:

> ProofPack compiles synthetic millwork handoff files into evidence-linked release gates, exact next actions, and reproducible receipts—locally, deterministically, and without an API key.

The submission must avoid invented ROI, universal truth, authenticity, security, privacy, and tamper-proof claims. It should emphasize a credible practitioner problem, a visibly falsifiable compiler, a complete product experience, a one-command judge path, and the documented way GPT-5.6 Sol and Codex turned operator judgment into tested software.
