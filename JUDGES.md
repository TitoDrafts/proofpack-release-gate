# ProofPack: 90-second judge path

1. Open [the live demo](https://proofpack-release-gate.tito943366.chatgpt.site).
2. Wait for `Baseline compiled: HOLD. 5 claims evaluated.`
3. Note the 12-character packet fingerprint and the `BLOCKED`, `CONFLICTED`, and `NEEDS CONFIRMATION` rows.
4. Click **Review GPT-5.6 proposal**.
5. Confirm `2 admissible, 1 rejected` and `REJECTED / UNAUTHORIZED_AUTHORITY` for the estimator's sample statement.
6. Confirm the ledger has not changed and **Apply 2 admissible bindings** still requires a human click.
7. Click **Apply 2 admissible bindings**.
8. Confirm `2 causal claims changed`: finish coordination and RFI incorporation become `VERIFIED`.
9. Confirm the unrelated sample claim remains `BLOCKED` and the release remains `HOLD`.
10. Click **Reset proposal gate**.
11. Confirm the original claim states and the original packet fingerprint return.

## Try to make it go `READY`

1. Clone a scratch copy and install dependencies:

   ```powershell
   git clone https://github.com/TitoDrafts/proofpack-release-gate.git proofpack-break-it
   Set-Location proofpack-break-it
   npm ci
   ```

2. Run the three deterministic attacks:

   ```powershell
   npm run challenge
   ```

3. Confirm all three fail closed:

   ```text
   unauthorized-approval  REJECTED  UNAUTHORIZED_AUTHORITY
   invented-line          REJECTED  ANCHOR_MISSING
   stale-target           REJECTED  PACKET_FINGERPRINT_MISMATCH
   Final decision: HOLD
   ```

4. Make a scratch-only source edit:

   ```powershell
   New-Item -ItemType Directory -Force .scratch | Out-Null
   Copy-Item fixtures/project-alder/operator-email.md .scratch/operator-email.md
   (Get-Content .scratch/operator-email.md -Raw).Replace('Traveler revision: C','Traveler revision: Z') |
     Set-Content .scratch/operator-email.md -NoNewline
   npm run challenge -- --operator-email .scratch/operator-email.md
   ```

5. Confirm the checked-in proposal is rejected as `PACKET_FINGERPRINT_MISMATCH` and the decision remains `HOLD`.
6. Delete only the disposable clone when finished.
