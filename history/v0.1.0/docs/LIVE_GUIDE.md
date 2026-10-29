# User deployment and live gate

Historical v0.1.0 user deployment at `0x0bA0510EBcF1D8Ded663c45A2C39F4CFFC2015B2`
has 45 recorded test transactions. Its processing-time expiry gate FAILED; see
CLOCK_GATE_FAILURE.md and LIVE_E2E_EVIDENCE.md. The instructions below describe
the test procedure, not a claim that every gate passed. Source is
`contracts/scope_mutex.py`; constructor has no arguments. Only the user main wallet
deploys. Scripts contain no deployment/upgrade method and do not use that wallet.

1. Run local verification and inspect its source hash and limitations.
2. User deploys exact source; supply the address. Never reuse another project's
   deployment. Record deployment tx and address with explorer `/address/` links.
3. Set SCOPEMUTEX_CONTRACT and run preflight. It compares deployed bytes and checks
   exact version/policy before reading secondary signing credentials.
4. With explicitly authorized secondary OS-keychain accounts configured through
   GENLAYER_CLI_ENTRY, run core: acquire, duplicate conflict, disjoint admission,
   out-of-scope denial, unauthorized/invalid/replay writes, creator intake closure,
   holder hand-in after closure, release and early sweep rejection.
5. Run audit while the short expiry fixture ages naturally. An injected declaration
   may be CONFLICT or safely UNRESOLVED; neither outcome proves universal resistance.
6. At/after the actual stored expiry, run expiry: holder late-hand-in rejection,
   permissionless sweep, actual positive reacquisition and release. Do not modify
   the clock or sealed duration to avoid waiting.
7. Separately run a two-submit duplicate race and a queued-before/processed-after-
   expiry consumer probe. Record actual network ordering and transaction timestamp
   semantics. Do not claim these covered by the core sequential scenario.
8. Independently re-read final board/request states and source parity, then create a
   final requirement-to-transaction matrix. No UI exists to test.

```powershell
$env:SCOPEMUTEX_CONTRACT='USER_DEPLOYED_ADDRESS'
npm run preflight
# Set GENLAYER_CLI_ENTRY to the authorized local CLI installation before signing.
npm run test:live
npm run test:audit
npm run test:expiry
```

The configured secondary aliases are dbl-owner and dbl-adapter. Their public
addresses are checked before signing; secrets are only read from the OS keychain
in memory. Do not paste keys into config/source/logs. A reviewer can use their own
SDK account and create an isolated board; there is no deployment-global roster.

## Evidence integrity

The runner appends context, preflight, intent/pre-state, hash, receipt, readback,
verification and phase completion events. It never rewrites event history. Only
the generated Markdown index is replaceable. Completed steps are not resent; an
intent without a recorded hash is ambiguous and stops for investigation.
An unexpected UNRESOLVED outcome permits at most one visibly labeled fresh-nonce
retry with the same declaration. The previous denied request and diagnostic remain
in the log. Unexpected positive/negative classifications are not retried until an
oracle passes, and no verdict is supplied by the runner.

For negative writes, stored projections omit only `effective_active` and
`effective_state`. Full reads remain recorded. A clock-derived view change is not
misrepresented as mutation or silently rewritten into an old snapshot. A failed
semantic oracle is not changed to a pass; preserve its diagnostic and investigate.

The release remains unverified until real source parity, clock/view support,
semantic branches, consumer transitions and recovery are observed. Runtime failure
requires a concrete fix and user-authorized deployment; no automatic redeploy.
