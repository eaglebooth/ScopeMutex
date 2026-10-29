# Source, test resources and evidence

Current v0.2.0 uses round termination, not expiry. All historical45tx and timing
probes concern v0.1.0. Current tests exercise old/missing timestamps only to show
they cannot revive a cancelled epoch right; live state-order gates remain pending.

Product source authority is the creator's own onchain board plus each invited
member's signed declaration. Source authenticity does not prove external DAO
authority, actual work, external uniqueness, quality or payment. The application
does not need an external official document for that narrower proof obligation.

`samples/workboard.json` is explicitly a synthetic group declaration. Expected
outcomes are predeclared test oracles, not live model outputs. It contains a held
quickstart, paraphrased duplicate, disjoint translation, out-of-scope request and
instruction-like adversarial request. No public source is impersonated.

`samples/hand-in.txt` is a locally authored demonstration artifact. Its SHA-256 can
be registered by an admitted holder, but this does not assert that real deployment
documentation was delivered or approved. No fabricated user transaction or private
API is needed. Live tests use actual SDK calls on the user-supplied contract.

## Controlled harness

The test file imports production source and invokes actual public methods. Runtime,
storage, sender, transaction time and leader/validator outputs are replaced. The
harness does not model full GenVM storage serialization, network concurrency,
quorum economics or real model behavior. It verifies implementation invariants,
not that supplied semantic fixture labels are objectively correct.

Adversarial tests deliberately supply a wrong leader and an independent conflicting
validator output. That demonstrates the check rejects disagreement; it does not
prove an actual model will resist every injected instruction.

## Runtime layers and observed coverage

The current deployment completed the semantic/lifecycle/audit/race/queued gates
below on 2026-10-29 with 41 actual test transactions. See LIVE_E2E_EVIDENCE.md.
Provider failures, quota exhaustion and malformed model outputs remain controlled
harness cases. RPC HTML errors during this run are retained in the append-only log;
they are transport failures, not fabricated model failures.

## Runtime verification gates

- Exact deployed-source parity and get_version on the intended network.
- Real affirmative IN_SCOPE/DISJOINT acquisition and OVERLAP/OUT_OF_SCOPE denials.
- Holder consumer effect, rejected write no-mutation and lifecycle recovery.
- Round termination and restart, including a prepared old hand-in submitted while
  the end-round operation has not finalized. No wall-clock expiry is claimed.
- Two near-concurrent duplicate requests with authoritative final held-slot readback.
- Actual injection control; a safe unresolved result is safety-only, not semantic
  correctness or universal robustness.

Only write live evidence after actual execution. Record exact input/source/sample
hashes, actors, method/args, submitted hash before polling, finality, consensus,
execution result, and authoritative pre/post readbacks. Keep failures and retries.
Use append-only JSONL and a Markdown index with every real tx linked. Separate old
deployments from final release. Never store private keys in the repository.
