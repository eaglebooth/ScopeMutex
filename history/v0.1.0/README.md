# ScopeMutex — Semantic Work-Claim Locks

A contract-only GenLayer prototype for exclusive concurrent work assignment inside
one creator-authored board. It judges whether a declared outcome fits the immutable
brief and materially overlaps another currently held assignment, including a
paraphrase. Code grants a timed right only after an affirmative, independently
validated in-scope/disjoint result. The admitted holder alone can register one
canonical hand-in digest while the right remains unexpired.

## Status

**Live blocker found:** the user-deployed v0.1.0 matched source, and 45 actual test
transactions were recorded. Core semantics, rights, recovery, injection control
and near-concurrent mutex worked for the tested samples. However, a consumer sent
before expiry executed after expiry and still handed in. See
[clock failure and correction choices](docs/CLOCK_GATE_FAILURE.md) and
[actual live evidence](docs/LIVE_E2E_EVIDENCE.md). The strict processing-time gate
FAILED; this version is not submission-ready for that claim.

See [local verification](docs/local-verification.json) for exact
commands and source/sample hashes. Controlled harness tests, linter validation and
schema generation are separate from real GenVM/model/network verification.
The observed user deployment is `0x0bA0510EBcF1D8Ded663c45A2C39F4CFFC2015B2`. The main wallet is
reserved for user deployment; the SDK runner only uses two authorized secondary
accounts after source parity succeeds. Constructor has no arguments or deployer role.

## Critical path

1. `create_board` freezes a brief, roster of 1..8 contributors, hold duration and a
   digest binding creator, board ID, policy, chain and contract.
2. An invited contributor calls `claim_work` with that digest, its own work
   declaration and a fresh nonce. It cannot already hold another active assignment.
3. Code snapshots at most eight active slots. GenLayer judges scope and every
   required comparison. The validator independently re-derives consequential
   verdicts; it does not merely check leader JSON or the leader's explanation.
4. In the same call, code rechecks the board revision, source commitment, clock and
   effective held set. Only IN_SCOPE with all DISJOINT grants a registered right.
   Conflict, ambiguity or malformed output grants none.
5. `hand_in` requires the exact admitted holder, registered right, valid digest and
   transaction time strictly before expiry. It records the digest and consumes the
   right. `release` also consumes it; anyone can `sweep_expired` at/after expiry.
6. The creator may stop new intake, but cannot edit the brief/roster, assign work,
   rewrite a hand-in, revoke another holder or bypass admission. Closing intake
   preserves existing holders' hand-in/release/expiry paths.

This is concurrent assignment control, **not historical deduplication**. A completed
or released outcome can be claimed again. It does not verify artifact existence,
delivery quality, actual labor, official DAO authority, external payment or an
external project's assignment system. No tokens or external calls are controlled.
The artifact digest is the holder's authenticated declaration, not a quality verdict.

## Build and inspect

```powershell
python -m pip install -r requirements-dev.txt
npm ci --ignore-scripts
python scripts/verify.py
```

Read the [specification](docs/SPEC.md), [source/test boundaries](docs/TEST_RESOURCES.md),
[requirement matrix](docs/REQUIREMENT_MATRIX.md), [originality scope](docs/ORIGINALITY.md)
and [deployment/live guide](docs/LIVE_GUIDE.md). SDK scripts never deploy or upgrade.

## Safety and liveness limits

The board reads only its bounded registered slots, not request history. Quotas are
per creator or per invited member/board; there is no shared global exhaustion cap.
One active right per member limits occupancy; an inactive member cannot block a
slot forever because its hold expires. Accepted denied requests consume that
member's request quota. Outer consensus failure rolls back without recording a
request. A new nonce permits a fresh assessment within the declared quota.

Raw model diagnostics are bounded untrusted data; do not render them as HTML or
obey embedded instructions. Output hashes are integrity evidence, not correctness
proof. Provider failure is leader-reported, not independent outage telemetry.
No universal prompt-injection resistance or steward acceptance is claimed.

The clock is the pinned runner's transaction UTC datetime, whole-second precision;
there is no machine-clock fallback. Its use in this exact contract's writes, views
and delayed-consumption boundaries still requires fresh live verification. Do not
claim a strict wall-clock/finality deadline from local tests alone.
