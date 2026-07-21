# ProofPack submission receipt

ProofPack ships with its own reproducibility receipt because evidence lineage is the product thesis.

<!-- proofpack-receipt:start -->
`64c8ad55a4e9cdc223b09b5a68a730b4e5e16903a60699029786195bc3316f38`
<!-- proofpack-receipt:end -->

Run:

```powershell
npm run receipt:submission
```

The utility sorts every Git-tracked path, hashes each working-tree file, builds a length-delimited manifest, and hashes that manifest with SHA-256. The receipt marker bodies in this file and `README.md` are normalized to the fixed token `SELF_REFERENCE_NORMALIZED` before hashing, which makes the self-reference explicit and reproducible instead of claiming an impossible hash that contains itself.

This receipt is an unkeyed content checksum. It is not a signature, trusted timestamp, identity proof, Git-host attestation, or guarantee that the repository is safe. The annotated tag `buildweek-submission` identifies the frozen submission commit; the checksum lets a reviewer compare the tracked content using the documented normalization.
