# ProofPack submission reference

> This file preserves the verified product facts and release references. The Devpost story uses the entrant's first-person account while retaining these evidence boundaries.

## Project name

ProofPack Release Gate

## Elevator pitch — 175 characters

GPT-5.6 proposes evidence bindings; ProofPack deterministically admits or rejects them, then compiles a local, evidence-linked millwork release gate.

## Track

Work and Productivity

## Problem

In the entrant's day-to-day drafting work, a millwork shop often supplies both its proposal and the architectural set. The millwork is drawn to the proposal because that is what the shop estimated and charged for, but the architect has the final say and the signed-off architectural set is usually what must actually be fabricated. When those sources contradict each other, a PM or estimator coordination error can send the drawings in the wrong direction.

That lived coordination problem is the reason for ProofPack: make the contradiction visible, show which source supports each claim, and stop the handoff before a drafting mismatch becomes physical shop work.

## What it does

ProofPack compiles a bounded commercial-millwork packet into an evidence-linked release handoff. The bundled fictional Project Alder scenario resolves exact Markdown, JSON, and log anchors; classifies five claims as `VERIFIED`, `INFERRED`, `NEEDS_CONFIRMATION`, `CONFLICTED`, or `BLOCKED`; and derives a separate `HOLD` or `READY` decision.

The baseline stays on `HOLD` because the finish basis conflicts, RFI incorporation lacks a direct receipt, and sample approval is pending. A recorded proposal from a real, explicit `gpt-5.6-sol` Codex run offers three candidate evidence bindings. ProofPack admits the two exact traveler bindings and rejects an estimator's informal sample approval as `UNAUTHORIZED_AUTHORITY`. A judge can apply the admitted pair and see only the two causally affected claims change. The sample blocker remains. Resetting recompiles the original packet and restores its original receipt.

ProofPack also produces an internal operator handoff and a separately constructed allowlisted shareable Markdown artifact. A human can acknowledge the hold or request a documented exception, but that action never changes the evidence statuses or clears the machine gate.

## How it works

One pure TypeScript core validates a closed packet and finite ruleset, normalizes text and timestamps, resolves exact source anchors, derives stable observations, applies deterministic claim evaluators, and constructs the handoff. Both the CLI and the single-page React interface call that same core.

The rule grammar is intentionally narrow: exact text-line contains checks, predeclared log events whose declared fields match exactly, JSON Pointer equality or presence, four fixed claim kinds, named dependencies, and a local authority resolver for exclusive values. There is no arbitrary code execution or natural-language extraction.

Canonical, unkeyed SHA-256 digests record the semantic input, observations, ledger, handoff, and typed shareable projection. They support reproducible comparison; they do not hash untouched source bytes or rendered exports, and they are not a signature, source-authenticity proof, or tamper-proof provenance system.

In the web app, proposal review, compilation, application, and reset run browser-locally; the CLI runs the same deterministic core locally. The default core makes no model or outbound API call, and the web app ships no analytics SDK, remote font, or remote third-party asset dependency. No OpenAI API key is required, and the checked-in scenario is entirely synthetic. The separate optional `npm run ai:propose` command requires network access and an existing ChatGPT-authenticated Codex CLI, but strips API-key variables and fails instead of falling back. A fresh dependency install can still contact the npm registry; a hosted page uses network requests and HTTPS to load its own assets and can inherit hosting-provider behavior.

## How Codex and GPT-5.6 were used

GPT-5.6 Sol specialist passes acted as build-time critics for competition positioning, the commercial-millwork wedge, the three-minute product story, exact status semantics, deterministic receipts, safety lineage, and adversarial verification. Codex synthesized those reviews with the entrant’s decisions into the design and implementation plan, then carried out test-first implementation and review loops across the validator, compiler, CLI, artifacts, privacy gate, and interface.

GPT-5.6 Sol is also used actively in one optional bounded workflow. `npm run ai:propose` invokes the pinned Codex CLI with `--model gpt-5.6-sol`, a read-only sandbox, ephemeral session, closed JSON Schema, and prompt over stdin. It proposes exact bindings from the fictional operator email; it cannot express status, evidence authority/effect, rules, `READY`/`HOLD`, event text, or public output. ProofPack independently binds the proposal to the packet fingerprint, resolves each exact line, rejects unauthorized authority, and requires a human application before the ledger changes. The checked-in run record is sanitized and explicitly labeled recorded, untrusted, and non-authoritative.

The resulting work is traceable in Git: design and plan (`aaaff70`, `a592c9a`); closed packet contract and review fix (`f9878e3`, `598d566`); compiler and semantic fix (`0fee4cf`, `a987bef`); artifacts/CLI and formal hardening (`5c518c5`, `509cf13`, `d724219`); product interface and accessible-control fix (`5c71f29`, `ab05eb8`); release artifacts (`944e6d1`, `26f7c7f`, `55287a6`); pinned adversarial hardening (`e80810b`, `8ff67bc`); and the deterministic GPT proposal core (`dcd6e65`). GPT-5.6 does not make fabrication decisions.

The entrant retained the domain choice, synthetic-only boundary, model-free runtime, release semantics, rule that human exceptions cannot erase evidence, final scope, and approval of shipped behavior.

## Challenges

- Keeping the compiler deterministic across source order, line endings, Unicode normalization, timestamp offsets, and repeated runs without using the wall clock or randomness.
- Defining statuses that do not collapse missing evidence, contradictions, inferences, and hard blockers into one score.
- Preserving exact source lineage while building a public artifact from an explicit allowlist instead of trying to scrub an internal report.
- Making proposal review and application visibly prove live computation without letting model output or one favorable input turn unrelated blockers green.
- Keeping CLI and browser behavior on one implementation while preserving a small, judge-friendly product surface.

## Accomplishments

- A real optional GPT-5.6 Sol proposal command with a closed schema, exact packet binding, no API-key requirement, deterministic authority rejection, and a sanitized reproducible run record.
- A complete synthetic source → anchor → observation → claim → handoff path shared by CLI and web.
- Every claim result carries a status, reason code, ruleset version, evidence IDs, missing predicates, and next action; resolved observations carry exact locators and excerpts, while stop conditions appear only where declared.
- A causal proposal diff in which only `finish-coordinated` and `rfi-incorporated` change, while the rejected informal sample authority and pending sample register keep release blocked.
- Reproducibility/integrity receipts plus internal and allowlisted shareable Markdown artifacts.
- A complete local verification gate. The fresh 2026-07-21 proposal-gate run passed 163 TypeScript tests, 21 privacy-scanner tests, and 3 rendered-product tests, plus lint, typecheck, production build, CLI demo, and privacy scan.

## Lessons learned

The entrant was surprised by how quickly the product came together, how strong the result became in a short build, and how clear the AI voiceover sounded in the final video. More personally, the entrant is proud to be learning AI while managing a business and already implementing it in day-to-day work.

AI-assisted development does not require surrendering authority to a model. Here GPT-5.6 Sol actively proposes bounded bindings, while a deterministic reviewer either admits exact evidence or rejects it and the compiler alone derives release status.

The most useful distinction was separating epistemic status from operational action: a claim can be inferred or conflicted while the separately derived handoff remains on `HOLD`. It was equally important to treat public sharing as a typed projection problem, not a find-and-replace problem.

## What is next

Before broader deployment, add a cross-browser QA matrix for clipboard, download, keyboard focus order, phone layout, and non-local request observation. Possible later work includes carefully validated additional rule packs and packet-authoring tools, but arbitrary uploads, OCR, integrations, and real data should not be added until their validation and safety boundaries are designed and tested.

## Built with

TypeScript 5.9, React 19, vinext/Vite, Node’s test runner through `tsx`, Web Crypto SHA-256, plain CSS, the pinned Codex CLI, and GPT-5.6 Sol.

## Required links and identifiers

- **Repository URL:** https://github.com/TitoDrafts/proofpack-release-gate
- **Devpost submission URL:** https://devpost.com/software/proofpack-release-gate
- **Hosted demo URL:** https://proofpack-release-gate.tito943366.chatgpt.site
- **Public YouTube URL:** https://youtu.be/4BB6HDbarMw
- **Primary `/feedback` Session ID:** `019f813e-8569-7d32-bdbc-cc1b2cf829f7`

## Release status

- [x] Entrant-voice Devpost story prepared.
- [x] Repository access, hosted demo behavior, and public YouTube video verified.
- [x] Primary `/feedback` Session ID recorded above and prepared for the submission form.
- [x] `npm run verify` passed after public link and metadata edits.
- [x] Devpost displayed `Project submitted!` on 2026-07-21; the public project page showed `Submitted to OpenAI Build Week`.
