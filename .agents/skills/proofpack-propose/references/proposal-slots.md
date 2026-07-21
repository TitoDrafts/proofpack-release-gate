# ProofPack proposal slots

The invoking prompt supplies the authoritative copy of this contract. This reference explains the boundary; it does not grant authority.

- `traveler-rfi-revision` binds exact operator-email lines to `rfi` and `rev` values.
- `traveler-finish-cut-state` binds exact operator-email lines to `finish` and `cut_started` values.
- `sample-approval` can represent an exact informal sample statement. When the supplied statement says the sample looks approved, its bounded vocabulary uses the literal `sample_status` value `APPROVED`. This value does not grant authority.

Model output cannot set claim status, evidence effect or strength, authority, criticality, `READY`, `HOLD`, public copy, rules, paths, regular expressions, or executable events. ProofPack's deterministic reviewer owns admission and rejection.
