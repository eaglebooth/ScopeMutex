# v0.2.0 deployment and live verification

Current source is deployed at 0x573ae069446a57b8127f5BC43c2953ac8e4C77D8.
All four phases completed with 41 actual test transactions on 2026-10-29; independent
readbacks passed. See LIVE_E2E_EVIDENCE.md. Instructions below describe reproduction
with a fresh run identifier, not a request to redeploy. Historical v0.1.0 at
0x0bA0510EBcF1D8Ded663c45A2C39F4CFFC2015B2 failed processing-time expiry; see
HISTORICAL_V010_EVIDENCE.md. Never mix that evidence with current-source claims.

1. Run local verification and inspect source hash, policy and authority change.
2. User main wallet deploys exact contracts/scope_mutex.py with no constructor args.
3. Supply address; preflight compares exact bytes/version/policy before credentials.
4. Run core: scope/overlap/disjoint, role/digest/replay denials, close intake then
   holder hand-in, end-round cancellation, old hand-in rejection, start next round,
   stale control rejection, fresh round acquisition and hand-in.
5. Run audit: injected declaration must not acquire a duplicate right; retain any
   safe UNRESOLVED result honestly, and prove denied/valid consumers behave correctly.
6. Run race: two secondary accounts submit duplicate work without awaiting either
   finality. Exactly one right should be registered and only the winner may hand in.
7. Run queued: prepare old right, submit end_round then old hand-in without awaiting
   end finality. Verify cancelled state/no artifact, new round acquisition, old
   replay denial and release. This is state-order enforcement, not a timing test.
8. Run independent verifier and publish complete tx index/final readbacks. Only then
   describe the observed live matrix as passed. No frontend exists.

```powershell
$env:SCOPEMUTEX_CONTRACT='USER_DEPLOYED_ADDRESS'
npm run preflight
# GENLAYER_CLI_ENTRY points to the authorized local keychain-backed CLI install.
npm run test:live
npm run test:audit
npm run test:race
npm run test:queued
node scripts/verify-live.mjs
```

The configured secondary aliases dbl-owner/dbl-adapter are checked by public
address before signing. Keys stay in OS-keychain memory, never source or logs.
Reviewers can create independent boards through their own SDK wallet; there is no
deployment-global allowlist or admin privilege.

The runner appends immutable context, intent/pre-state, hash, receipt, readback and
verification events. Only its Markdown index is replaceable. Ambiguous intent
without hash stops; completed steps are not resent. One labeled fresh-nonce retry
is permitted for unexpected UNRESOLVED, preserving the original record. Semantic
oracles are never changed to get a pass. No deploy/upgrade capability is present.
