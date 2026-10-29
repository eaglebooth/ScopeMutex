# ScopeMutex v0.2.0 specification

## Scope and immutable authority

Creator-authored brief, invited roster (1..8), namespace, chain, contract, policy and
ROUND_AUTHORITY are sealed in board_digest. ROUND_AUTHORITY explicitly permits the
creator to terminate a whole round and cancel all unhanded rights. It does not prove
external DAO authority. There is no mutable brief/roster or outside evidence source.

Each board begins at epoch1. round_digest binds policy, board_digest and epoch.
Every member signs the exact current digest and expected epoch for its own candidate.
Each request ID includes board, epoch, sender and nonce; its commitment binds work
and the complete semantic snapshot. Old declarations are not future-round consent.

## Judgment and atomic acquisition

Code snapshots only registered HELD requests of this open round, at most eight.
One member can hold one right per board. The model affirmatively judges IN_SCOPE,
OUT_OF_SCOPE or UNCLEAR. For IN_SCOPE it compares every held outcome with fixed rN
IDs: OVERLAP, DISJOINT or UNCLEAR. OVERLAP requires exact quote witnesses from the
candidate and correct held text, 4..600 characters. Same topic alone is not overlap.

Validators reproduce bounded raw-output decoding and independently re-derive scope
and the full ID/relation vector. Witness wording need not match if both are exact
source excerpts. Only IN_SCOPE with every DISJOINT grants HELD. Other outcomes do
not reserve slots. Invalid/provider/truncated outputs authorize denial only.

Immediately before recording a request, code rechecks board commitment, epoch,
round/intake state, revision, current round digest and exact active snapshot. A
stale result errors with no request/quota mutation. Outer consensus failure also
rolls back. Accepted denied requests consume only that member's quota.

## Lifecycle

- create_board opens epoch1 and intake.
- close_intake(board,expected_epoch): creator-only; stops admission, retains rights.
- hand_in(request,request_digest,artifact_digest): holder-only, exact commitment,
  current open round, HELD registration; records digest and consumes right once.
- release(request,request_digest): same right checks; consumes it without artifact.
- end_round(board,expected_epoch): creator-only, closes the round and intake,
  cancels every registered unhanded right, clears slots, increments revision.
  Existing HANDED_IN/RELEASED/denied records are preserved.
- start_round(board,expected_closed_epoch): creator-only, requires closed/empty,
  advances epoch and opens fresh intake. Stale controls cannot hit the next round.

HELD -> HANDED_IN | RELEASED | CANCELLED. All completed request records are immutable.
Historical duplicate work can be claimed again once no current holder remains.

## Bounds, failure and recovery

Brief<=1200, work<=600, IDs/nonces 1..24 lowercase identifier characters; 1..8 unique
nonzero invitees; at most8 active rights. Board quota32 per creator and accepted
request quota32 per member/board, shared across rounds. No global shared quota or
historical admission scan exists. Failed assessments can be resubmitted with fresh
nonces within quota; no previous failed declaration is overwritten.

Raw model diagnostics cap128000 characters, sufficient for canonical full Unicode
quote pairs across8 checks. Diagnostics are untrusted data, not instructions or
correctness proofs. Provider errors are leader-reported, not independent telemetry.
A closed round supplies explicit recovery for abandoned work; no clock, expiry,
sweep, machine-time fallback or external time oracle is used. This changes the
coordinator's authority; it is not a stronger wall-clock guarantee.
