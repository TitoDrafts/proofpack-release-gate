# Task 3 Formal Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every Critical, Important, and Minor Task 3 review finding with focused RED→GREEN evidence and a complete passing repository verification gate.

**Architecture:** Claim results will carry a closed `lineageSafety` label derived conservatively from every declared rule anchor and all transitive dependencies; the public exporter will enforce that label in addition to matched-observation checks. The privacy scanner will use a required tracked synthetic term configuration, an optional ignored local supplement, conservative text/binary classification, and the exact temporary bundle published by the CLI. Repository scripts will build before rendered tests, whose contract will cover only the current minimal shell, removal of disposable starter assets, and absence of remote asset references.

**Tech Stack:** TypeScript 5.9, Node.js 22 test runner, Web Crypto, Vinext/Vite, ECMAScript modules, PowerShell.

## Global Constraints

- Runtime is fully local and deterministic: no model call, analytics, external font, CDN asset, or outbound network request.
- Every repository fixture, example, and export is fictional and synthetic.
- The core performs no filesystem, DOM, wall-clock, randomness, locale-sensitive formatting, or network access.
- Shareable Markdown is rendered only from the typed allowlist projection, never by scrubbing operator Markdown.
- Scanner findings contain only path, line, column, and category; they never echo matched values or configured terms.
- `npm test` and the complete `npm run verify` gate must pass from the current tree.

---

### Task 1: Closed Claim Lineage Safety

**Files:**
- Modify: `src/proofpack/types.ts`
- Modify: `src/proofpack/classify.ts`
- Modify: `src/proofpack/safety.ts`
- Modify: `tests/safety.test.ts`
- Modify: `tests/compile.test.ts`

**Interfaces:**
- Consumes: validated `ClaimRule.anchors`, recursively materialized dependency `ClaimResult`s, and matched observations.
- Produces: required `ClaimResult.lineageSafety: SafetyLabel`; `RESTRICTED` dominates `PUBLIC`.

- [ ] **Step 1: Write failing lineage regressions**

Add tests that compile public support alongside unmatched restricted contradiction and blocker anchors. Assert the claim remains `VERIFIED`, its result is `RESTRICTED`, and it is absent from shareable outcomes. Add a public gate whose verified dependency has the same restricted absence taint and assert that taint propagates transitively. Corrupt a compiled claim by deleting or changing `lineageSafety` and assert `buildShareableProjection` rejects with `SHAREABLE_LINEAGE_AMBIGUOUS`.

- [ ] **Step 2: Run the lineage tests and verify RED**

Run:

```powershell
npx tsx --test tests/safety.test.ts
```

Expected: the new assertions fail because claim results do not yet carry `lineageSafety` and the currently public outcomes still export.

- [ ] **Step 3: Implement the smallest closed taint**

Add the required field to `ClaimResult`. In classification, derive local safety from every anchor declaration regardless of match state, then combine it with every dependency’s already-transitive label. Materialize only literal `PUBLIC` or `RESTRICTED`, with restriction dominant and no ordering dependence. In the public builder, reject missing/invalid labels and omit `RESTRICTED` claims before constructing any public field while retaining existing evidence-ID resolution and observation-safety checks.

- [ ] **Step 4: Verify GREEN and cumulative compiler behavior**

Run:

```powershell
npx tsx --test tests/safety.test.ts tests/classify.test.ts tests/compile.test.ts tests/receipt-diff.test.ts
```

Expected: every test passes; Project Alder’s sole public outcome remains available and receipt determinism remains intact under the expanded claim shape.

### Task 2: Complete Fail-Closed Privacy Scanning

**Files:**
- Create: `config/privacy-forbidden-terms.json`
- Modify: `.gitignore`
- Modify: `scripts/privacy-scan.mjs`
- Modify: `tests/privacy-scan.test.mjs`
- Modify: `tests/cli.test.ts`

**Interfaces:**
- Consumes: the exact files produced by `proofpack-demo --out`, a required closed synthetic-term JSON configuration, and an optional ignored newline-delimited local term file.
- Produces: sorted non-value-bearing findings and exit `1` for privacy, encoding, or configuration failures.

- [ ] **Step 1: Write failing scanner regressions**

Add table-driven secret-key family cases constructed from fragments, exact generated-bundle inventory assertions for `operator.md`, `shareable.md`, `receipt.json`, and `compiled.json`, an invalid-UTF-8-plus-NUL probe for a known text extension, an extensionless probe, a known binary-signature exclusion, required non-empty configuration checks, and an optional local supplemental term-file end-to-end case. Assert no serialized finding or process error contains a secret value or term.

- [ ] **Step 2: Run scanner and CLI tests and verify RED**

Run:

```powershell
node --test tests/privacy-scan.test.mjs
npx tsx --test tests/cli.test.ts
```

Expected: tests fail on omitted JSON artifacts, NUL bypass, absent required configuration, and uncovered secret families.

- [ ] **Step 3: Implement scanner configuration and text classification**

Load and validate a closed, deterministically non-empty tracked synthetic term list. Exempt only that configuration file’s own sentinel/forbidden-term matches; continue applying all other detectors. Load a missing default local supplement as empty, but fail closed when an explicitly configured supplement cannot be read or decoded. Treat known text extensions, config names, and extensionless files as text regardless of NUL; skip only explicit binary extensions or recognized binary signatures; emit a generic encoding finding for NUL or fatal UTF-8 decode failure.

- [ ] **Step 4: Implement actual-bundle enumeration and secret families**

Generate a temporary CLI output directory, enumerate every published regular file in stable order, decode each as text, scan it, and remove the temporary root in `finally`. This published directory is the single generated artifact inventory, so future CLI additions are automatically scanned. Extend assignment-key recognition across generic secret, secret-key, cloud secret-access-key, token, password, private-key, client-secret, and API-key families in JSON, YAML, and environment syntax while preserving placeholder/environment-reference exemptions.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
node --test tests/privacy-scan.test.mjs
npx tsx --test tests/cli.test.ts
npm run privacy:scan
```

Expected: all tests pass and the normal scanner reports four generated artifacts without printing term values.

### Task 3: Complete Repository Gate and Diagnostic Contract

**Files:**
- Modify: `package.json`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/proofpack/diff.ts`
- Modify: `tests/receipt-diff.test.ts`

**Interfaces:**
- Consumes: Vinext’s built `dist/server/index.js` and existing `PackDiffError` identity guard.
- Produces: a build-before-rendered-test script order, a minimal current-shell/no-disposable-starter/no-remote-assets test, and an identity error naming packet, ruleset/version, and engine lineage.

- [ ] **Step 1: Capture RED for the current repository gate and diagnostic**

Use the existing failing `npm test` output as the rendered-contract RED. Add a focused assertion that the diff mismatch message names packet, ruleset/version, and engine, then run it and observe failure under the old wording.

- [ ] **Step 2: Replace only obsolete rendered assertions and reorder scripts**

Split unit and rendered tests. Make `npm test` run unit tests, then `npm run build`, then the rendered test. Make `verify` reuse that ordering without a later redundant build. In `rendered-html.test.mjs`, retain status/content-type/current metadata checks; assert disposable loading-skeleton text/dependency/preview paths are absent; and reject absolute HTTP(S), protocol-relative, and remote CSS asset references. Do not add UI.

- [ ] **Step 3: Correct the diff diagnostic and verify GREEN**

Update only the `PackDiffError` wording, then run:

```powershell
npx tsx --test tests/receipt-diff.test.ts
npm test
```

Expected: the diagnostic regression and every TypeScript/MJS test pass, with production build created before the rendered worker import.

### Task 4: Full Verification, Review, Report, and Commit

**Files:**
- Modify: `.superpowers/sdd/task-3-report.md` (ignored durable report)

- [ ] **Step 1: Run all required gates**

Run the focused safety/privacy/CLI/receipt commands, all TypeScript and MJS tests, `npm test`, `npm run verify`, standalone typecheck/lint/build/demo/privacy commands, `git diff --check`, and the post-commit diff/status checks. Record exact pass counts and command exits.

- [ ] **Step 2: Self-review and independent review**

Check each formal finding against the final diff, verify scanner output never includes matched values, confirm core browser portability, and dispatch a read-only reviewer over the complete fix diff. Resolve every Critical, Important, and Minor issue through another focused RED→GREEN cycle.

- [ ] **Step 3: Append the durable report and commit**

Append root causes, every RED→GREEN result, final commands/results, review verdict, self-review, and any remaining concern to `.superpowers/sdd/task-3-report.md`. Stage only the focused fix files and create one review-fix commit.
