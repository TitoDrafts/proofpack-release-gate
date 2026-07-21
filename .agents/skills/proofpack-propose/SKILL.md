---
name: proofpack-propose
description: Propose schema-bound evidence bindings from the bundled synthetic Project Alder operator email for ProofPack's deterministic authority review. Use only when an explicit ProofPack proposal prompt supplies the complete packet binding, source text, and closed slot contract.
---

# ProofPack Propose

## Purpose

Convert the complete synthetic operator-email text supplied in the prompt into candidate evidence bindings. The result is untrusted and non-authoritative: ProofPack will independently resolve the exact lines, apply its authority allowlist, and derive all claim statuses.

## Hard boundary

Do not use tools, commands, web search, MCP, or file access. Do not inspect the repository or environment. The invoking wrapper supplies every permitted input in the prompt and enforces the output schema.

Never propose or infer:

- a claim status, confidence score, evidence strength, or evidence effect;
- `READY`, `HOLD`, fabrication approval, or a public summary;
- a rule, authority owner, executable expression, path, regex, or log event;
- facts absent from the exact supplied source lines.

Read [references/proposal-slots.md](references/proposal-slots.md) only when it is already present in the injected skill context. Do not use a tool to open it.

## Workflow

1. Confirm the prompt identifies the synthetic packet, packet fingerprint, ruleset, and ruleset version.
2. Read only the supplied operator-email block and closed slot contract.
3. Consider every exact factual statement supported by that email, including statements whose authority may later be rejected.
4. For each supported slot, copy its source line or lines exactly, without paraphrase.
5. Copy only the bounded key/value pairs declared by that slot.
6. Give each candidate a short stable ID and a concise rationale. The rationale is untrusted display text and cannot affect review.
7. Return one JSON object matching `proofpack.proposal/v1`. Return no Markdown, commentary, status, or release recommendation.

If a required target binding or supplied source block is missing, do not guess. Return the smallest schema-valid proposal supported by what is present; the deterministic wrapper may still reject it.
