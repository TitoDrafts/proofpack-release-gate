# ProofPack GPT-5.6 Proposal Gate Design

**Date:** 2026-07-21

**Objective:** Make GPT-5.6 a visible, meaningful product capability without allowing a model to determine claim status, release authority, or public output.

## Decision

ProofPack will add a local-only **GPT-5.6 Proposal Gate** beside the existing deterministic release compiler.

```text
synthetic raw packet
        |
        +--> GPT-5.6 Sol in Codex --> schema-bound candidate bindings (untrusted)
                                           |
                                           v
                                  deterministic proposal review
                                    |                    |
                              ADMISSIBLE             REJECTED
                                    |                    |
                              human applies       exact reason shown
                                    |
                                    v
                         existing compiler + causal diff
                                    |
                              HOLD / READY
```

The memorable product rule is: **GPT-5.6 proposes. ProofPack proves—or rejects.**

The baseline web application and CLI remain fully local, deterministic, and runnable without an API key, Codex login, or network access after dependencies are installed. The optional proposal command uses the user's saved ChatGPT authentication through the Codex CLI; it never reads `OPENAI_API_KEY` or `CODEX_API_KEY`.

## Alternatives Considered

### Runtime Responses API

This is the most literal in-app model integration, but it requires a hosted secret, paid API usage, network availability, rate-limit handling, and a new server trust boundary. It conflicts with the locked no-key deterministic default and is rejected.

### Documentation-only build provenance

This is the current implementation. It proves extensive GPT-5.6/Codex collaboration but leaves a real eligibility and judge-perception ambiguity because GPT-5.6 is not an active product mode. It is rejected as insufficient.

### Codex proposal workflow (selected)

An explicit `gpt-5.6-sol` Codex run creates a strict proposal artifact from synthetic sources. A pure local verifier rejects stale, invented, ambiguous, or unauthorized candidates before any existing compiler input can change. This provides active model use without weakening the deterministic authority boundary.

## Demonstration Scenario

Add one restricted synthetic source, `operator-email.md`, to Project Alder. It contains raw-ish but bounded facts:

- Traveler revision C is acknowledged.
- RFI-042 is incorporated.
- PL-18 is recorded and cutting has not started.
- An estimator informally says the sample "looks approved."

The baseline compiler has no anchors into this email, so its status and handoff are unchanged except for the packet fingerprint created by the additional raw source.

GPT-5.6 proposes three candidate bindings:

1. `traveler-rfi-revision`: exact email lines for traveler revision C and RFI-042.
2. `traveler-finish-cut-state`: exact email lines for PL-18 and `cut_started=false`.
3. `sample-approval`: the estimator's informal sample statement.

The deterministic proposal review admits the two predeclared traveler slots and rejects `sample-approval` because sample authority remains exclusively owned by `sample-register.json`. When the human applies both admissible bindings, ProofPack materializes one fixed `traveler_ack` log event. Recompilation changes exactly `finish-coordinated` and `rfi-incorporated`; the independent pending sample keeps `fabrication-release` `BLOCKED` and the handoff on `HOLD`.

## Proposal Contract

The model output uses schema `proofpack.proposal/v1` and contains only:

- target packet ID, packet fingerprint, ruleset ID, and ruleset version;
- up to three candidate IDs;
- a proposed slot ID;
- one declared source ID;
- exact line selectors;
- bounded string/boolean values;
- an untrusted human-readable rationale.

The schema cannot represent claim status, criticality, `READY`, `HOLD`, evidence effect, strength, authority, stop conditions, public copy, executable expressions, regular expressions, or arbitrary output paths.

The wrapper adds non-authoritative run metadata after the model exits: requested model, Codex CLI version, ChatGPT-auth mode, command shape, and digests. This metadata is evidence of the invoked workflow, not a signature or attestation of model identity.

## Deterministic Admissibility Review

The pure review function receives the current compile input and a proposal envelope. It must:

1. Recompile the current packet and compare packet ID, fingerprint, ruleset ID, and ruleset version.
2. Reject malformed proposal fields and duplicate candidate IDs.
3. Resolve every candidate source to a declared synthetic source.
4. Resolve each line selector to exactly one source line.
5. Compare the candidate's slot, source, selectors, and values with a closed in-code allowlist.
6. Return a review artifact containing `ADMISSIBLE` or `REJECTED` per candidate and stable reason codes.
7. Materialize the fixed traveler event only when both required traveler slots are admissible.

The review must not mutate its inputs. Unknown slots are rejected. Missing or ambiguous selectors are rejected. A stale packet or ruleset rejects the entire proposal. A rationale is displayed as untrusted and never used in a decision.

## Active GPT-5.6 Command

`npm run ai:propose` will:

1. Run the existing deterministic compiler against Project Alder.
2. Confirm the pinned Codex CLI is authenticated with ChatGPT.
3. Remove `OPENAI_API_KEY` and `CODEX_API_KEY` from the child environment.
4. Invoke `codex exec` with explicit `--model gpt-5.6-sol`, `--sandbox read-only`, `--ephemeral`, `--json`, `--output-schema`, and `--output-last-message` arguments.
5. Explicitly invoke the repo-scoped `$proofpack-propose` skill.
6. Post-validate the final JSON and write a proposal envelope plus a sanitized run-evidence artifact.
7. Exit nonzero on missing ChatGPT auth, unavailable GPT-5.6 Sol, malformed output, rejected target metadata, or subprocess failure. It must never silently fall back to another model.

The checked-in recorded proposal is transparent demo evidence generated by this command. It is labeled as recorded, includes its request/output digests, and is never substituted when a live command fails.

## Repo-Scoped Skill

Create `.agents/skills/proofpack-propose` using the Codex skill format. Its workflow is deliberately narrow:

- read the current Project Alder packet, rules, operator email, and proposal-slot reference;
- run the deterministic baseline before proposing anything;
- select only exact line anchors found in the raw email;
- emit at most three candidates through the supplied JSON Schema;
- include the unsafe sample candidate when the email supports it so the authority firewall is demonstrable;
- never edit files, invent statuses, or make a fabrication recommendation.

The skill includes `agents/openai.yaml` UI metadata and one short reference documenting the two admitted slots and prohibited authority fields. It is validated with the skill-creator validator and forward-tested through the live command.

## Product Experience

Add a full-width proposal-gate strip above the existing three-panel cockpit:

- **AI proposal:** recorded `gpt-5.6-sol` artifact and packet binding.
- **Deterministic review:** candidate cards with exact anchors, `ADMISSIBLE`/`REJECTED`, and stable reason codes.
- **Human application:** a button that applies only the materialized fixed event; the UI states that no model-generated status enters the ledger.

Initial state offers **Review GPT-5.6 proposal**. Reviewing changes no claim or handoff. After review, **Apply 2 admissible bindings** becomes available. Reset restores the original packet, clears the proposal review, and restores the baseline fingerprint.

The existing source, evidence-ledger, handoff, human-decision, export, and receipt behavior remains intact.

## Security and Privacy Boundaries

- All model-visible and checked-in data is synthetic.
- The active command is local-only and read-only.
- No hosted endpoint receives Codex credentials.
- No auth file, access token, environment secret, raw JSONL reasoning, or user path is committed.
- The child process receives neither `OPENAI_API_KEY` nor `CODEX_API_KEY`.
- The recorded run bundle contains only allowlisted metadata, the schema-bound final proposal, digests, and sanitized event types/counts.
- Model rationale is untrusted display text and excluded from compiler input, receipts, exports, and public allowlists.

## Testing

Use test-first development for every behavior.

- Proposal validation rejects unknown fields, status-like fields, duplicates, wrong schema, and more than three candidates.
- Stale packet/ruleset metadata rejects the proposal.
- Exact selectors must resolve once; missing and ambiguous anchors reject.
- The two declared traveler slots are admissible only with exact source/selectors/values.
- The sample-approval proposal is rejected as unauthorized.
- Applying a reviewed proposal materializes exactly one fixed log event, changes exactly two claims, and leaves fabrication `BLOCKED`/handoff `HOLD`.
- Reviewing alone never changes compile input or ledger digests.
- The active-command adapter strips API-key variables, uses explicit Sol/read-only/ephemeral/schema arguments, and refuses non-ChatGPT auth or model fallback.
- Default `npm run verify`, web compilation, and replay perform no network or Codex invocation.
- Rendered-product tests assert the visible AI authority boundary and proposal controls.
- Privacy tests scan the new skill, schema, fixtures, run record, and generated artifacts.

## Three-Minute Submission Proof

- `0:00–0:22`: the real proposal-versus-architect millwork problem and baseline `HOLD`.
- `0:22–0:42`: the new raw operator email has no modeled authority.
- `0:42–1:02`: live `npm run ai:propose` shows explicit GPT-5.6 Sol through Codex and schema-bound output.
- `1:02–1:35`: the proposal gate admits two exact traveler bindings and rejects sample authority.
- `1:35–2:05`: human applies two admissible bindings; exactly two claims change while sample approval keeps `HOLD`.
- `2:05–2:28`: exact source anchors, receipt/reset, and non-overriding human decision.
- `2:28–2:48`: local no-key default, active optional GPT-5.6 mode, and fresh verification.
- `2:48–3:00`: entrant statement and closing line: “GPT-5.6 proposes. ProofPack proves—or rejects.”

## Completion Criteria

The upgrade is complete only when:

- the design, implementation plan, code, skill, fixtures, tests, README, provenance, and submission copy agree;
- a real `gpt-5.6-sol` Codex run has produced the checked-in transparent proposal record;
- the complete verification gate passes from a clean worktree;
- independent compliance, product, code, privacy, and media reviews have no open critical or important findings;
- the public repository and hosted demo match the verified commit;
- the public sub-three-minute video demonstrates the live active mode and authority rejection;
- Devpost is updated and visibly remains submitted before 5:00 PM Pacific.
