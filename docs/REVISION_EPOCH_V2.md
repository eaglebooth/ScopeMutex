# Correction: transaction-time leases -> explicit work rounds

The user delegated the fastest correction after the actual v0.1.0 queued-consumer
counterexample. Version0.2.0 removes clock-dependent expiry, rather than substituting
an unverified time service. The user subsequently deployed v0.2.0 at
0x573ae069446a57b8127f5BC43c2953ac8e4C77D8; all four live phases and independent
state readbacks passed on 2026-10-29 (41 test tx). See LIVE_E2E_EVIDENCE.md.

The immutable policy now states that a board coordinator may end a whole round and
cancel outstanding unhanded rights. The contributor accepts that exact policy in
round_digest. This is a disclosed authority change: coordinator termination replaces
automatic timeout recovery. Coordinator still cannot assign work, overwrite hand-ins
or hand in for a member. Ordinary intake closure still preserves current rights.

Claims/controls are epoch-bound. Consumer verifies current open epoch and exact
request commitment at execution. Old timestamps confer no authority. end_round
cancels at most8 registered rights; start_round advances the epoch. Request quotas
remain per member/board across rounds. Semantic scope/overlap consensus stays on
the acquisition critical path.

Preserved v0.1.0 source, tests, schema, verification and runner snapshots are under
history/v0.1.0. Raw historical live evidence is unchanged in docs/live-evidence.
Its source SHA is7f82afdca03a2d8dc011543c0a6caea2ada4afcc970b0567b243293bed240ad4.
The old address is historical, not a deployment of this source.

Acceptance: fresh source parity; complete real semantic controls; end-round then
old consumer (including old prepared payload while end finality is pending); denied
old artifact with unchanged state; new-round claim, stale control and replay guards;
near-concurrent mutex; exact hand-in digest; two secondary signers only. These gates were observed on the user-deployed v0.2.0 address. No wall-clock claim is made.
