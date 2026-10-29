# Blocking live finding: queued consumer can pass after processing-time expiry

Current source v0.2.0 uses explicit round termination, with no automatic expiry.
See REVISION_EPOCH_V2.md. This document preserves the v0.1.0 failure and authority
tradeoff; its live report is HISTORICAL_V010_EVIDENCE.md, not a v0.2.0 pass.

Deployment: `0x0bA0510EBcF1D8Ded663c45A2C39F4CFFC2015B2`, v0.1.0.
Exact deployed source SHA-256:
`7f82afdca03a2d8dc011543c0a6caea2ada4afcc970b0567b243293bed240ad4`.

This deployment is **not submission-ready for a processing-time expiry claim**.
The normal late-submission test passed, but that does not cover queued submissions.

## Actual qualifying counterexample

[Consumer transaction](https://explorer-studio.genlayer.com/transactions/0x49af64ef433a123020ba93b5efba412643fea81b4f7344cc398b2c4db99cfccc)
finalized with accepted consensus and SUCCESS, and the authoritative request state
became HANDED_IN with the artifact digest recorded.

| Fact | RPC/contract value |
|---|---|
| Sealed expiry | 1793177249 Unix seconds |
| Consumer created | 1793177242 (7 seconds before expiry) |
| Leader EXEC_START | 1793177256.3813863 (7.381 seconds after expiry) |
| Unit sanity check | finite contemporary Unix seconds; not milliseconds |
| Stored outcome | HANDED_IN |

Source's hand-in guard uses `gl.message_raw["datetime"]`. The inspected SDK describes
that field as transaction datetime, not a processing-time clock. In this observed
call the guard accepted a pre-expiry transaction while actual leader execution
started after expiry. No wall-clock fallback or model verdict was used in hand-in.
This does not establish that the API supplies fresh processing time.

The earlier review-v1 timing attempt submitted after expiry due measured RPC delay
and was properly rejected; it was explicitly NOT counted as a queued-before probe.
Both attempts, all receipts and final readbacks are retained in LIVE_E2E_EVIDENCE.md.
The verifier reports FAILED for the actual qualifying successful consumer.

## Concrete correction choices

### A. State-defined work rounds (recommended)

Preserve semantic compare-and-acquire and the holder-only canonical consumer,
but replace the unproven wall-clock lease with a board round/epoch:

- A board's immutable policy explicitly authorizes its coordinator to end an
  entire round. This is a changed authority model, not an invisible bug fix.
- Every acquisition binds the exact current round and board digest.
- Closing intake only stops new work, as before. A distinct end-round transition
  invalidates all outstanding rights in that round, using at most eight slots.
- Hand-in rechecks current round and HELD registration at execution. A previously
  queued consumer processed after end-round must fail regardless of old datetime.
- New rounds require fresh member claims; old requests cannot replay or publish.
- There is no automatic wall-clock expiry. Coordinator termination supplies recovery
  for abandoned assignments, and can revoke a current holder under that disclosed
  policy. It cannot assign new work or hand in on another member's behalf.

Live acceptance gate: end-round then an old queued hand-in, denial with no artifact;
fresh acquisition in the new round; complete replay, role and race retest. Main
wallet still deploys only. No new source has been deployed or silently substituted.

### B. Keep time-based rights

Requires a supported and independently verified fresh clock/attestation mechanism
at the consumer boundary, with its source authority, failure and delay semantics
explicit. The inspected SDK exposes no alternative current processing-clock API
that this task has verified. A machine clock, HTTP Date header, another endpoint
or a leader-only timestamp is not automatically a secure replacement. This choice
needs further research and additional trust before implementation/deployment.

Do not claim the current deployment fixed by increasing duration or changing test
expectations. The record is a real late-consumption counterexample. Narrowing to
submission-time semantics would be another explicit product-policy change.
