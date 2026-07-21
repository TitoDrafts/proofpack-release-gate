# ProofPack submission reference

> This file preserves the verified product facts and release references. The Devpost story uses the entrant's first-person account while retaining these evidence boundaries.

## Project name

ProofPack Release Gate

## Elevator pitch — 175 characters

ProofPack compiles synthetic millwork handoff files into evidence-linked release gates, rule-derived next actions, and reproducibility receipts—locally and without an API key.

## Track

Work and Productivity

## Problem

A fabrication handoff can look complete while its evidence is split across a finish schedule, approved RFI, active traveler, field check, sample register, and release note. A small contradiction or missing acknowledgement can survive until physical work begins. A summary alone is not enough: the person releasing work needs to see which source supports each claim, which rule classified it, what remains unresolved, and the next safe action.

## What it does

ProofPack compiles a bounded commercial-millwork packet into an evidence-linked release handoff. The bundled fictional Project Alder scenario resolves exact Markdown, JSON, and log anchors; classifies five claims as `VERIFIED`, `INFERRED`, `NEEDS_CONFIRMATION`, `CONFLICTED`, or `BLOCKED`; and derives a separate `HOLD` or `READY` decision.

The baseline stays on `HOLD` because the finish basis conflicts, RFI incorporation lacks a direct receipt, and sample approval is pending. A judge can append one synthetic Rev C acknowledgement and see only the two causally affected claims change. The sample blocker remains. Resetting recompiles the original packet and restores its original receipt.

ProofPack also produces an internal operator handoff and a separately constructed allowlisted shareable Markdown artifact. A human can acknowledge the hold or request a documented exception, but that action never changes the evidence statuses or clears the machine gate.

## How it works

One pure TypeScript core validates a closed packet and finite ruleset, normalizes text and timestamps, resolves exact source anchors, derives stable observations, applies deterministic claim evaluators, and constructs the handoff. Both the CLI and the single-page React interface call that same core.

The rule grammar is intentionally narrow: exact text-line contains checks, predeclared log events whose declared fields match exactly, JSON Pointer equality or presence, four fixed claim kinds, named dependencies, and a local authority resolver for exclusive values. There is no arbitrary code execution or natural-language extraction.

Canonical, unkeyed SHA-256 digests record the semantic input, observations, ledger, handoff, and typed shareable projection. They support reproducible comparison; they do not hash untouched source bytes or rendered exports, and they are not a signature, source-authenticity proof, or tamper-proof provenance system.

In the web app, compilation and replay run browser-locally; the CLI runs the same deterministic core locally. The core makes no model or outbound API call, and the web app ships no analytics SDK, remote font, or remote third-party asset dependency. No OpenAI API key is required, and the checked-in scenario is entirely synthetic. A fresh dependency install can still contact the npm registry; a hosted page uses network requests and HTTPS to load its own assets and can inherit hosting-provider behavior.

## How Codex and GPT-5.6 were used

GPT-5.6 Sol specialist passes acted as build-time critics for competition positioning, the commercial-millwork wedge, the three-minute product story, exact status semantics, deterministic receipts, safety lineage, and adversarial verification. Codex synthesized those reviews with the entrant’s decisions into the design and implementation plan, then carried out test-first implementation and review loops across the validator, compiler, CLI, artifacts, privacy gate, and interface.

The resulting work is traceable in Git: design and plan (`aaaff70`, `a592c9a`); closed packet contract and review fix (`f9878e3`, `598d566`); compiler and semantic fix (`0fee4cf`, `a987bef`); artifacts/CLI and formal hardening (`5c518c5`, `509cf13`, `d724219`); product interface and accessible-control fix (`5c71f29`, `ab05eb8`); release artifacts (`944e6d1`, `26f7c7f`, `55287a6`); and pinned adversarial hardening (`e80810b`, `8ff67bc`). GPT-5.6 and Codex are not runtime dependencies and do not make fabrication decisions.

The entrant retained the domain choice, synthetic-only boundary, model-free runtime, release semantics, rule that human exceptions cannot erase evidence, final scope, and approval of shipped behavior.

## Challenges

- Keeping the compiler deterministic across source order, line endings, Unicode normalization, timestamp offsets, and repeated runs without using the wall clock or randomness.
- Defining statuses that do not collapse missing evidence, contradictions, inferences, and hard blockers into one score.
- Preserving exact source lineage while building a public artifact from an explicit allowlist instead of trying to scrub an internal report.
- Making the replay visibly prove live computation without letting one favorable input turn unrelated blockers green.
- Keeping CLI and browser behavior on one implementation while preserving a small, judge-friendly product surface.

## Accomplishments

- A complete synthetic source → anchor → observation → claim → handoff path shared by CLI and web.
- Every claim result carries a status, reason code, ruleset version, evidence IDs, missing predicates, and next action; resolved observations carry exact locators and excerpts, while stop conditions appear only where declared.
- A causal replay diff in which only `finish-coordinated` and `rfi-incorporated` change, while the sample gate keeps release blocked.
- Reproducibility/integrity receipts plus internal and allowlisted shareable Markdown artifacts.
- A complete local verification gate. The fresh 2026-07-21 final release run passed 140 TypeScript tests, 21 privacy-scanner tests, and 3 rendered-product tests, plus lint, typecheck, production build, CLI demo, and privacy scan.

## Lessons learned

AI-assisted development does not require an AI-dependent runtime. In this project, GPT-5.6 Sol and Codex helped turn domain judgment into a constrained, inspectable compiler, while the shipped behavior stayed deterministic and reviewable.

The most useful distinction was separating epistemic status from operational action: a claim can be inferred or conflicted while the separately derived handoff remains on `HOLD`. It was equally important to treat public sharing as a typed projection problem, not a find-and-replace problem.

## What is next

Before broader deployment, add a cross-browser QA matrix for clipboard, download, keyboard focus order, phone layout, and non-local request observation. Possible later work includes carefully validated additional rule packs and packet-authoring tools, but arbitrary uploads, OCR, integrations, and real data should not be added until their validation and safety boundaries are designed and tested.

## Built with

TypeScript 5.9, React 19, vinext/Vite, Node’s test runner through `tsx`, Web Crypto SHA-256, plain CSS, and build-time GPT-5.6 Sol/Codex collaboration.

## Required links and identifiers

- **Repository URL:** https://github.com/TitoDrafts/proofpack-release-gate
- **Hosted demo URL:** https://proofpack-release-gate.tito943366.chatgpt.site
- **Public YouTube URL:** https://youtu.be/-Teh4V2mLVs
- **Primary `/feedback` Session ID:** `019f813e-8569-7d32-bdbc-cc1b2cf829f7`

## Release status

- [x] Entrant-voice Devpost story prepared.
- [x] Repository access, hosted demo behavior, and public YouTube video verified.
- [x] Primary `/feedback` Session ID recorded above and prepared for the submission form.
- [x] `npm run verify` passed after public link and metadata edits.
- [ ] Capture Devpost's successful-submission confirmation before describing the project as submitted.
