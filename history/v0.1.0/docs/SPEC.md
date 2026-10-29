# ScopeMutex specification

## Proof obligation and source authority

Grant a concurrent work right only for an invited sender whose exact declared
outcome is affirmatively within the creator-authored immutable brief and disjoint
from every currently held, unexpired assignment in that board.

Creator identity is the authenticated transaction sender. This grants authority only
over its board namespace, not an external DAO. Each member authenticates its own
candidate text by signing `claim_work` with the exact board digest. Invitation is
not proof of contribution; a declaration is not evidence work was performed.

Board commitment includes policy, chain, contract, creator, board ID, complete brief,
complete roster and hold duration. There is no revision/edit API for those fields.
The mutable board revision tracks changes to held slots and intake status. An
assessment snapshot additionally seals candidate identity/text, observation time
and the complete effective comparison set. Request commitment binds that snapshot.

## Single-call semantic mutex

Code assigns short comparison IDs r0..r7 to its effective active set. The model
classifies scope first. OUT_OF_SCOPE/UNCLEAR requires no pair rows and cannot grant
a right. IN_SCOPE requires exactly one OVERLAP/DISJOINT/UNCLEAR row for every held
item. No active items still requires affirmative IN_SCOPE; empty scope is not SAFE.

OVERLAP witnesses must be 4..600-character verbatim substrings of the candidate and
the correct held work. Complete work text is allowed. Witness equality across
models is not required; the consequential scope and complete ID/relation vector
must agree. The validator independently receives the full immutable context and
tries to falsify disjointness/scope, not just inspect the leader response.

Priority: malformed/failed output -> UNRESOLVED; scope UNCLEAR -> UNRESOLVED;
OUT_OF_SCOPE -> OUT_OF_SCOPE; IN_SCOPE with any OVERLAP -> CONFLICT; otherwise any
UNCLEAR -> UNRESOLVED; only all DISJOINT -> HELD. The model never chooses parties,
duration, capacity, artifacts, expiry or a storage state directly.

Immediately before any accepted request is committed, code rechecks source digest,
duration, intake status, board revision, nondecreasing transaction clock and the
exact effective held set. A stale/expired comparison snapshot raises an error,
records no request and consumes no quota. No pending request can reserve a slot.

## Stored and effective states

```
claim_work -> HELD | CONFLICT | OUT_OF_SCOPE | UNRESOLVED
HELD -> HANDED_IN  (holder + registered + now < expiry + digest)
HELD -> RELEASED   (holder + registered + now < expiry)
HELD -> EXPIRED    (permissionless sweep, now >= expiry)
```

Only HELD requests are registered. Views report EXPIRED effectively when a stored
HELD right has elapsed, without writing storage. Successful acquisition can also
materialize expired registered slots; denied assessments do not clean/mutate them.
All terminal request states are immutable. Artifact registration is single-use.
The creator can close intake once; it cannot cancel or reassign existing rights.

There is no historical-duplicate prohibition: completing or releasing a right
removes it from future overlap comparisons. Hand-in records a holder-chosen SHA-256
digest string; it neither fetches bytes nor proves their quality/existence.

## Bounds and time

Brief 1..1200 nonblank characters; work 1..600; board ID and nonce lowercase
identifiers 1..24; roster 1..8 unique nonzero addresses; hold 60..604800 seconds.
At most eight slots and one effective right per member/board. At most 32 boards per
creator and 32 accepted requests per member/board; another account cannot consume
these quotas. Stored history is not an admission lookup index.

`gl.message_raw["datetime"]` is documented as transaction datetime in the inspected
SDK, and analogous pinned-runner use was observed in previous workspace projects.
This exact deployment still needs runtime verification. UTC Z/+00:00, optional
fractional seconds, valid Gregorian dates only; fractions truncate to whole seconds.
Acquisition starts duration from its final gate's transaction time. Views cannot
rewrite expiry. Every hand-in/release rechecks now < expiry; sweep uses now >= expiry.
No claim of strict arrival/finality-time enforcement without delayed-message tests.

## Diagnostics and consensus failures

Accepted assessments retain bounded raw model output, its SHA-256, error code and
check ID. The 128,000-character output cap accommodates eight full pairs of
600-codepoint witnesses even with 12-character JSON escapes. Extra whitespace or
oversized provider output can still be rejected; this does not truncate a positive
finding into validity. Valid output is decoded independently by the validator before semantic
comparison. Invalid/provider/truncated envelopes may authorize denial only. Provider
exceptions omit exception text. Truncated-output hashes cannot be reproduced from
their prefix; this is denial diagnostics, not a verified semantic premise.

An outer validator disagreement/provider failure can roll back the transaction;
it is not relabeled as accepted UNRESOLVED. SDK evidence must inspect real receipts.
Failed output classes and semantic UNCLEAR are distinct diagnostics. This protocol
does not make model classification infallible.
