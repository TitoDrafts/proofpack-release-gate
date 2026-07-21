# ProofPack submission receipt

ProofPack ships with its own reproducibility receipt because evidence lineage is the product thesis.

<!-- proofpack-receipt:start -->
`2b47466fd8e5db4c4f8b57b452476896e7374f33f861097cfa499185e29a5196`
<!-- proofpack-receipt:end -->

Run:

```powershell
npm run receipt:submission
```

The utility sorts every path in the committed `HEAD` tree, hashes the exact Git blob bytes, builds a length-delimited manifest, and hashes that manifest with SHA-256. The receipt marker bodies in this file and `README.md` are normalized to the fixed token `SELF_REFERENCE_NORMALIZED` before hashing, which makes the self-reference explicit and reproducible instead of claiming an impossible hash that contains itself. Reading committed blobs avoids checkout-dependent line-ending changes.

This receipt is an unkeyed content checksum. It is not a signature, trusted timestamp, identity proof, Git-host attestation, or guarantee that the repository is safe. The annotated tag `buildweek-submission` identifies the frozen submission commit; the checksum lets a reviewer compare the tracked content using the documented normalization.
