# ScopeMutex — Epoch Work-Claim Locks

Current source: **v0.2.0**, policy `scopemutex/epoch-work-exclusion-v2`.
Deployed by the user at
[0x573ae069446a57b8127f5BC43c2953ac8e4C77D8](https://explorer-studio.genlayer.com/address/0x573ae069446a57b8127f5BC43c2953ac8e4C77D8).
On 2026-10-29, core/audit/race/queued completed with 41 actual test transactions
signed only by the two secondary accounts. Independent state readbacks and exact
source parity passed. [Complete transaction evidence](docs/LIVE_E2E_EVIDENCE.md).
53 controlled tests, linter/schema and SDK syntax/import checks passed separately.
Constructor takes no arguments; deployment remains the user's main-wallet role.

The contract judges whether a declared work outcome fits an immutable board brief
and materially duplicates another held assignment. Code grants a round-scoped
exclusive right only after independently validated IN_SCOPE and all DISJOINT.
Only its holder can record one canonical artifact digest while the round is active.

## Explicit authority change

There is **no automatic expiry or wall-clock guarantee**. The board's creator can
end an entire round, cancelling all outstanding unhanded rights (at most eight).
That authority is sealed in the immutable board commitment and the current round
digest signed by each claimant. The creator cannot assign work or hand in for a
member. A separate close_intake action only stops new claims and preserves rights.

start_round advances the epoch after termination. New claims must use the new
epoch and digest. Old requests cannot publish, release, replay old authority or
revive after the next round. Controls themselves bind an expected epoch, so a stale
end/close/start call cannot act on a newer round. Request quotas do not reset.

This replaces the failed clock-dependent v0.1.0 design, rather than repairing its
clock. That deployment is historical: 0x0bA0510EBcF1D8Ded663c45A2C39F4CFFC2015B2.
See [clock failure](docs/CLOCK_GATE_FAILURE.md), [45 historical transactions](docs/HISTORICAL_V010_EVIDENCE.md)
and [exact archived source](history/v0.1.0/contracts/scope_mutex.py). Those transactions
are not evidence that the current source has been deployed or tested live.

## Build and use

```powershell
python -m pip install -r requirements-dev.txt
npm ci --ignore-scripts
python scripts/verify.py
```

[Local verification](docs/local-verification.json) records commands and source/sample
hashes. The controlled harness is not real GenVM/network/model consensus.

Workflow: create_board -> claim_work -> hand_in or release; coordinator may
close_intake, end_round, then start_round. No deployer privilege, custody, frontend,
mutable brief/roster, automatic assignment or bypass API exists. Every acquisition
rechecks the round, source, revision and full bounded held snapshot after judgment.
The validator independently evaluates the full source, not only leader JSON.

Read [specification](docs/SPEC.md), [live guide](docs/LIVE_GUIDE.md),
[test/source boundaries](docs/TEST_RESOURCES.md) and [release changes](docs/REVISION_EPOCH_V2.md).

## Boundaries

Authority is only the creator's board namespace and each member's signed declaration.
This is concurrent allocation, not historical deduplication: completed/released work
can be claimed again. Hand-in does not prove artifact existence, actual labor,
quality, external DAO authorization or payment. The coordinator may cancel legitimate
unfinished work by ending the round; availability depends on that disclosed trust.
No universal injection resistance or steward acceptance is claimed.
