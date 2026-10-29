import copy
import importlib.util
import json
from pathlib import Path
import sys
import types
from datetime import datetime, timedelta
import pytest


class UserError(Exception):
    pass


class Return:
    def __init__(self, calldata):
        self.calldata = calldata


class Address:
    def __init__(self, value):
        self.as_hex = value


class BigInt(int):
    pass


class Decorator:
    def __call__(self, function):
        return function


outputs, prompts = [], []
after_consensus = None


def exec_prompt(prompt, response_format):
    assert response_format == "json"
    prompts.append(prompt)
    if not outputs:
        raise RuntimeError("NO_MODEL_FIXTURE")
    value = outputs.pop(0)
    if isinstance(value, Exception):
        raise value
    return copy.deepcopy(value)


def run_nondet(leader, validator):
    result = leader()
    if not validator(Return(result)):
        raise RuntimeError("CONSENSUS_REJECTED")
    if after_consensus:
        after_consensus()
    return result


gl = types.SimpleNamespace(Contract=object, public=types.SimpleNamespace(write=Decorator(), view=Decorator()),
    vm=types.SimpleNamespace(UserError=UserError, Return=Return, run_nondet_unsafe=run_nondet),
    nondet=types.SimpleNamespace(exec_prompt=exec_prompt))
fake = types.ModuleType("genlayer")
fake.gl, fake.allow_storage, fake.TreeMap, fake.bigint = gl, lambda cls: cls, dict, BigInt
fake.__all__ = ["gl", "allow_storage", "TreeMap", "bigint"]
previous = sys.modules.get("genlayer")
sys.modules["genlayer"] = fake
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("scope_mutex", ROOT / "contracts/scope_mutex.py")
sm = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = sm
try:
    spec.loader.exec_module(sm)
finally:
    if previous is None:
        sys.modules.pop("genlayer", None)
    else:
        sys.modules["genlayer"] = previous

A, B, C, D = ["0x"+c*40 for c in "abcd"]
CONTRACT = "0x"+"e"*40
DATA = json.loads((ROOT / "samples/workboard.json").read_text())
ARTIFACT = "f"*64


def sender(address):
    gl.message.sender_address = Address(address)


def advance(seconds):
    time = datetime.fromisoformat(gl.message_raw["datetime"].replace("Z", "+00:00"))
    gl.message_raw["datetime"] = (time + timedelta(seconds=seconds)).isoformat().replace("+00:00", "Z")


def fresh():
    global after_consensus
    after_consensus = None
    gl.message = types.SimpleNamespace(sender_address=Address(A), contract_address=Address(CONTRACT), chain_id=61999)
    gl.message_raw = {"datetime": "2026-10-28T10:00:00Z"}
    gl.vm.run_nondet_unsafe = run_nondet
    outputs.clear()
    prompts.clear()
    c = sm.ScopeMutex()
    c.boards, c.requests, c.board_counts, c.request_counts = {}, {}, {}, {}
    return c


def board(c, name="docs", roster=None, ttl=3600):
    return c.create_board(name, DATA["brief"], json.dumps(roster or [A,B]), ttl)


def verdict(scope="IN_SCOPE", relations=None, work=None, active=None):
    checks = []
    for i, relation in enumerate(relations or []):
        row = {"id": "r"+str(i), "relation": relation}
        if relation == "OVERLAP":
            row.update(candidate_quote=work, held_quote=active[i]["work"])
        checks.append(row)
    return {"scope": scope, "comparisons": checks}


def claim(c, bid, actor=A, nonce="first", work=None, scope="IN_SCOPE", relations=None, leader=None, validator=None):
    sender(actor)
    work = work or DATA["quickstart"]
    active = c._effective(c.boards[bid], c._now())
    result = verdict(scope, relations or ["DISJOINT"]*len(active), work, active) if leader is None else leader
    outputs.extend([copy.deepcopy(result), copy.deepcopy(result if validator is None else validator)])
    return c.claim_work(bid, c.boards[bid].commitment, nonce, work)


def snapshot(c):
    return copy.deepcopy((c.boards,c.requests,c.board_counts,c.request_counts))


def reject(c, message, function, *args):
    before = snapshot(c)
    with pytest.raises(UserError, match=message):
        function(*args)
    assert snapshot(c) == before


def test_single_call_acquire_two_disjoint_claims_and_holder_bound_hand_in():
    c = fresh()
    bid = board(c)
    first = claim(c,bid)
    second = claim(c,bid,B,work=DATA["disjoint"])
    b = json.loads(c.get_board(bid))
    assert len(b["effective_active"]) == 2 and b["revision"] == 2
    assert len(prompts) == 4 and "Independently search" in prompts[1]
    reject(c,"HOLDER_ONLY",c.hand_in,first,ARTIFACT)
    sender(A)
    c.hand_in(first,ARTIFACT)
    p = json.loads(c.get_request(first))
    assert p["stored_state"] == "HANDED_IN" and p["artifact_digest"] == ARTIFACT
    assert [x["id"] for x in json.loads(c.get_board(bid))["effective_active"]] == [second]
    reject(c,"NOT_HELD",c.hand_in,first,"a"*64)


def test_paraphrased_overlap_denies_right_and_cannot_publish_or_release():
    c = fresh();bid = board(c);first = claim(c,bid)
    before = copy.deepcopy(c.boards[bid])
    second = claim(c,bid,B,work=DATA["overlap"],relations=["OVERLAP"])
    assert c.requests[second].state == "CONFLICT" and c.requests[second].expires_at == 0
    assert c.boards[bid] == before and c.requests[first].state == "HELD"
    reject(c,"NOT_HELD",c.hand_in,second,ARTIFACT)
    reject(c,"NOT_HELD",c.release,second)


@pytest.mark.parametrize("scope,state",[("OUT_OF_SCOPE","OUT_OF_SCOPE"),("UNCLEAR","UNRESOLVED")])
def test_scope_rejection_with_existing_right_does_not_mutate_it(scope,state):
    c = fresh();bid=board(c);first=claim(c,bid)
    before=copy.deepcopy((c.boards,c.requests[first]))
    second=claim(c,bid,B,work=DATA["outside"],leader=verdict(scope))
    assert c.requests[second].state == state
    assert (c.boards,c.requests[first]) == before


def test_ambiguous_overlap_does_not_default_to_disjoint():
    c=fresh();bid=board(c);claim(c,bid)
    second=claim(c,bid,B,relations=["UNCLEAR"])
    p=json.loads(c.get_request(second))
    assert p["stored_state"] == "UNRESOLVED" and p["assessment"]["diagnostic"]["code"] == "SEMANTIC_UNCLEAR"
    assert len(json.loads(c.get_board(bid))["effective_active"]) == 1


def test_wrong_independent_verdict_rejects_outer_consensus_without_quota_or_right():
    c=fresh();bid=board(c);claim(c,bid)
    before=snapshot(c)
    active=c._effective(c.boards[bid],c._now())
    with pytest.raises(RuntimeError,match="CONSENSUS_REJECTED"):
        claim(c,bid,B,work=DATA["overlap"],leader=verdict(relations=["DISJOINT"]),
              validator=verdict(relations=["OVERLAP"],work=DATA["overlap"],active=active))
    assert snapshot(c) == before


def test_witness_wording_may_differ_when_both_exact_and_effects_agree():
    c=fresh();bid=board(c);claim(c,bid)
    active=c._effective(c.boards[bid],c._now())
    first=verdict(relations=["OVERLAP"],work=DATA["overlap"],active=active)
    other=copy.deepcopy(first)
    other["comparisons"][0]["candidate_quote"]="beginner tutorial"
    other["comparisons"][0]["held_quote"]="deployment quickstart"
    second=claim(c,bid,B,work=DATA["overlap"],leader=first,validator=other)
    assert c.requests[second].state == "CONFLICT"


@pytest.mark.parametrize("raw,code",[("bad JSON","INVALID_JSON"),(None,"INVALID_SCHEMA"),
    ({"scope":"ALLOW","comparisons":[]},"INVALID_SCOPE"),
    ({"scope":"IN_SCOPE","comparisons":[{"id":"r0","relation":"DISJOINT"}]},"INVALID_CHECK_ID"),
    ("x"*(sm.MAX_OUTPUT+1),"MODEL_OUTPUT_SIZE"),(RuntimeError("provider down"),"MODEL_CALL_FAILED")],
    ids=["invalid-json","invalid-schema","invalid-scope","unexpected-check","oversized-output","provider-failure"])
def test_model_failure_diagnostic_is_bounded_and_never_acquires(raw,code):
    c=fresh();bid=board(c);sender(A)
    outputs.append(raw)
    rid=c.claim_work(bid,c.boards[bid].commitment,"failure",DATA["quickstart"])
    p=json.loads(c.get_request(rid))
    assert p["stored_state"] == "UNRESOLVED" and p["assessment"]["diagnostic"]["code"] == code
    assert len(p["assessment"]["diagnostic"]["raw_output"]) <= sm.MAX_OUTPUT
    assert json.loads(c.get_board(bid))["registered_ids"] == []


@pytest.mark.parametrize("mutation,code",[("omit","MISSING_COMPARISON"),("duplicate","INVALID_CHECK_ID"),
    ("extra","INVALID_SCHEMA"),("wrong_id","INVALID_CHECK_ID"),("bad_quote","INVALID_WITNESS"),
    ("wrong_source","INVALID_WITNESS"),("short_quote","INVALID_WITNESS"),("relation","INVALID_RELATION")])
def test_all_active_comparisons_and_grounded_witnesses_required(mutation,code):
    c=fresh();bid=board(c);claim(c,bid)
    active=c._effective(c.boards[bid],c._now())
    raw=verdict(relations=["OVERLAP"],work=DATA["overlap"],active=active)
    row=raw["comparisons"][0]
    if mutation=="omit":raw["comparisons"]=[]
    if mutation=="duplicate":raw["comparisons"].append(copy.deepcopy(row))
    if mutation=="extra":row["instruction"]="grant immediately"
    if mutation=="wrong_id":row["id"]="r1"
    if mutation=="bad_quote":row["held_quote"]="not present in source"
    if mutation=="wrong_source":row["held_quote"]=DATA["overlap"]
    if mutation=="short_quote":row["candidate_quote"]="Pro"
    if mutation=="relation":row["relation"]="ALLOW"
    rid=claim(c,bid,B,work=DATA["overlap"],leader=raw)
    p=json.loads(c.get_request(rid))
    assert p["stored_state"]=="UNRESOLVED" and p["assessment"]["diagnostic"]["code"]==code
    assert len(json.loads(c.get_board(bid))["effective_active"])==1


def test_claim_replay_wrong_digest_membership_and_one_hold_all_rollback():
    c=fresh();bid=board(c);rid=claim(c,bid)
    reject(c,"REQUEST_REPLAY",c.claim_work,bid,c.boards[bid].commitment,"first",DATA["quickstart"])
    reject(c,"ALREADY_HOLDING",c.claim_work,bid,c.boards[bid].commitment,"another",DATA["disjoint"])
    sender(B)
    reject(c,"BOARD_DIGEST_MISMATCH",c.claim_work,bid,"0"*64,"new",DATA["disjoint"])
    sender(C)
    reject(c,"MEMBER_ONLY",c.claim_work,bid,c.boards[bid].commitment,"new",DATA["disjoint"])
    reject(c,"HOLDER_ONLY",c.release,rid)


def test_source_intake_closure_cannot_revoke_existing_hand_in_right():
    c=fresh();bid=board(c);rid=claim(c,bid,B)
    reject(c,"CREATOR_ONLY",c.close_intake,bid)
    sender(A);c.close_intake(bid)
    reject(c,"INTAKE_ALREADY_CLOSED",c.close_intake,bid)
    reject(c,"INTAKE_CLOSED",c.claim_work,bid,c.boards[bid].commitment,"new",DATA["quickstart"])
    sender(B);c.hand_in(rid,ARTIFACT)
    assert c.requests[rid].state=="HANDED_IN"
    assert c.boards[bid].intake_open is False


@pytest.mark.parametrize("seconds",[60,61])
def test_exact_or_after_expiry_blocks_holder_hand_in_and_allows_anyone_sweep(seconds):
    c=fresh();bid=board(c,ttl=60);rid=claim(c,bid)
    advance(seconds)
    assert json.loads(c.get_request(rid))["effective_state"]=="EXPIRED"
    assert c.requests[rid].state=="HELD"  # Read does not silently mutate storage.
    reject(c,"LEASE_EXPIRED",c.hand_in,rid,ARTIFACT)
    reject(c,"LEASE_EXPIRED",c.release,rid)
    sender(C);assert c.sweep_expired(bid)==1
    assert c.requests[rid].state=="EXPIRED" and json.loads(c.boards[bid].active_ids)==[]
    reject(c,"NOTHING_EXPIRED",c.sweep_expired,bid)


def test_before_expiry_consumer_succeeds_and_early_sweep_does_not_steal_right():
    c=fresh();bid=board(c,ttl=60);rid=claim(c,bid)
    advance(59);sender(B)
    reject(c,"NOTHING_EXPIRED",c.sweep_expired,bid)
    sender(A);c.hand_in(rid,ARTIFACT)
    assert c.requests[rid].state=="HANDED_IN"


def test_successful_acquire_excludes_and_materializes_expired_other_claim():
    c=fresh();bid=board(c,ttl=60);first=claim(c,bid)
    advance(60)
    second=claim(c,bid,B,work=DATA["overlap"])
    assert c.requests[first].state=="EXPIRED" and c.requests[second].state=="HELD"
    assert json.loads(c.boards[bid].active_ids)==[second]
    assert json.loads(c.requests[second].snapshot)["held"]==[]


def test_release_then_reacquire_uses_new_nonce_and_records_independent_source():
    c=fresh();bid=board(c);first=claim(c,bid)
    c.release(first)
    assert c.requests[first].state=="RELEASED"
    second=claim(c,bid,nonce="second")
    assert c.requests[second].state=="HELD" and c.requests[first].artifact_digest==""
    assert c.requests[first].commitment!=c.requests[second].commitment


def test_unresolved_nonce_cannot_be_overwritten_but_new_request_can_succeed():
    c=fresh();bid=board(c)
    first=claim(c,bid,scope="UNCLEAR")
    reject(c,"REQUEST_REPLAY",c.claim_work,bid,c.boards[bid].commitment,"first",DATA["quickstart"])
    second=claim(c,bid,nonce="retry")
    assert c.requests[first].state=="UNRESOLVED" and c.requests[second].state=="HELD"


@pytest.mark.parametrize("change",["close","revision","expiry","clock_backwards","commitment","duration"])
def test_last_mile_stale_snapshot_or_time_change_cannot_acquire(change):
    global after_consensus
    c=fresh();bid=board(c,ttl=60);claim(c,bid)
    def concurrent_change():
        if change=="close":c.boards[bid].intake_open=False
        if change=="revision":c.boards[bid].revision+=1
        if change=="expiry":advance(60)
        if change=="clock_backwards":advance(-1)
        if change=="commitment":c.boards[bid].commitment="0"*64
        if change=="duration":c.boards[bid].hold_seconds+=1
    after_consensus=concurrent_change
    quota=copy.deepcopy(c.request_counts)
    with pytest.raises(UserError,match="CLOCK_REORDERED" if change=="clock_backwards" else "STALE_SNAPSHOT"):
        claim(c,bid,B,work=DATA["disjoint"])
    assert len(c.requests)==1 and c.request_counts==quota


@pytest.mark.parametrize("raw",[None,"2026-02-30T00:00:00Z","2026-10-28T00:00:00+07:00","2026-10-28T24:00:00Z","2026-10-28"])
def test_unavailable_or_invalid_clock_fails_closed(raw):
    c=fresh();bid=board(c)
    gl.message_raw={"datetime":raw}
    reject(c,"CLOCK_UNAVAILABLE",c.claim_work,bid,c.boards[bid].commitment,"first",DATA["quickstart"])


@pytest.mark.parametrize("raw",["2026-10-28T10:00:00Z","2026-10-28T10:00:00+00:00","2026-10-28T10:00:00.123456789Z"])
def test_documented_utc_clock_shapes_have_same_whole_second(raw):
    assert sm.utc_seconds(raw)==sm.utc_seconds("2026-10-28T10:00:00Z")


@pytest.mark.parametrize("ttl",[True,59,604801])
def test_duration_input_bounds(ttl):
    c=fresh();reject(c,"INVALID_HOLD_DURATION",c.create_board,"docs",DATA["brief"],json.dumps([A,B]),ttl)


@pytest.mark.parametrize("roster",[[],[A,A.upper().replace("0X","0x")],["0x"+"0"*40],[A,"wrong"],[A]*9])
def test_roster_authentication_boundaries(roster):
    c=fresh();reject(c,"INVALID_ROSTER",c.create_board,"docs",DATA["brief"],json.dumps(roster),3600)


@pytest.mark.parametrize("work",[""," ","x"*601])
def test_empty_or_oversized_work_does_not_call_model(work):
    c=fresh();bid=board(c)
    reject(c,"INVALID_WORK_INPUT",c.claim_work,bid,c.boards[bid].commitment,"first",work)
    assert not prompts


@pytest.mark.parametrize("value",["","F"*64,"0x"+"a"*64,"a"*63])
def test_artifact_digest_exact_shape_and_no_mutation(value):
    c=fresh();bid=board(c);rid=claim(c,bid)
    reject(c,"INVALID_ARTIFACT_DIGEST",c.hand_in,rid,value)


def test_per_creator_and_per_member_limits_cannot_exhaust_other_account():
    c=fresh();bid=board(c)
    c.board_counts[A]=BigInt(sm.MAX_BOARDS_PER_CREATOR)
    reject(c,"CREATOR_BOARD_LIMIT",c.create_board,"other",DATA["brief"],json.dumps([A]),3600)
    sender(B);other=board(c,"other")
    assert other.startswith(B)
    c.request_counts[bid+":"+A]=BigInt(sm.MAX_REQUESTS_PER_MEMBER)
    sender(A);reject(c,"MEMBER_REQUEST_LIMIT",c.claim_work,bid,c.boards[bid].commitment,"last",DATA["quickstart"])
    rid=claim(c,bid,B)
    assert c.requests[rid].state=="HELD"


def test_source_domain_and_roster_and_duration_bind_board_digest():
    c=fresh();first=board(c);original=c.boards[first].commitment
    c=fresh();gl.message.contract_address=Address(D);second=board(c)
    assert c.boards[second].commitment!=original
    c=fresh();gl.message.chain_id=1;second=board(c)
    assert c.boards[second].commitment!=original
    c=fresh();second=board(c,ttl=60)
    assert c.boards[second].commitment!=original
    c=fresh();second=board(c,roster=[A,C])
    assert c.boards[second].commitment!=original


def test_complete_eight_slot_comparison_and_no_history_scan():
    c=fresh();actors=["0x"+format(i+1,"040x") for i in range(8)]
    bid=board(c,roster=actors)
    for i,actor in enumerate(actors):
        rid=claim(c,bid,actor,nonce="entry",work="Distinct declared work outcome "+str(i))
        assert c.requests[rid].state=="HELD"
    assert len(json.loads(c.boards[bid].active_ids))==8
    context=json.loads(c.requests[rid].snapshot)
    assert len(context["held"])==7 and [x["check_id"] for x in context["held"]]==["r"+str(i) for i in range(7)]
    # Completed requests are retained for audit but not scanned or compared.
    sender(actors[0]);c.release(json.loads(c.boards[bid].active_ids)[0])
    rid=claim(c,bid,actors[0],nonce="next",work="A new independently declared work outcome")
    assert len(json.loads(c.requests[rid].snapshot)["held"])==7


def test_adversarial_source_cannot_bypass_independent_semantic_check_in_harness():
    c=fresh();bid=board(c);claim(c,bid)
    active=c._effective(c.boards[bid],c._now())
    wrong=verdict(relations=["DISJOINT"])
    right=verdict(relations=["OVERLAP"],work=DATA["injection"],active=active)
    before=snapshot(c)
    with pytest.raises(RuntimeError,match="CONSENSUS_REJECTED"):
        claim(c,bid,B,work=DATA["injection"],leader=wrong,validator=right)
    assert snapshot(c)==before


def test_diagnostics_different_quotes_same_effect_and_serialized_json_supported():
    raw=verdict()
    assert sm.decode_model(raw,"work",[])==sm.decode_model(sm.canonical(raw),"work",[])


@pytest.mark.parametrize("field,value",[("snapshot_digest","0"*64),("decision",{"scope":"IN_SCOPE","comparisons":[]}),
    ("diagnostic",{"code":"MODEL_CALL_FAILED"})])
def test_forged_envelope_cannot_grant(field,value):
    c=fresh();bid=board(c)
    def forged(leader,validator):
        candidate=json.loads(leader());candidate[field]=value
        assert not validator(Return(sm.canonical(candidate)))
        raise RuntimeError("CONSENSUS_REJECTED")
    gl.vm.run_nondet_unsafe=forged
    before=snapshot(c)
    with pytest.raises(RuntimeError,match="CONSENSUS_REJECTED"):
        claim(c,bid,scope="OUT_OF_SCOPE")
    assert snapshot(c)==before


def test_full_unicode_witnesses_fit_for_every_bounded_active_comparison():
    work="\U0001f680"*sm.MAX_WORK
    active=[{"work":work} for _ in range(sm.MAX_ACTIVE)]
    raw=verdict(relations=["OVERLAP"]*len(active),work=work,active=active)
    result=sm.decode_model(raw,work,active)
    assert result["decision"] is not None and len(result["decision"]["comparisons"])==len(active)


def test_creator_has_no_override_to_hand_in_another_members_assignment():
    c=fresh();bid=board(c);rid=claim(c,bid,B)
    sender(A)
    reject(c,"HOLDER_ONLY",c.hand_in,rid,ARTIFACT)
    reject(c,"HOLDER_ONLY",c.release,rid)
    assert c.requests[rid].state=="HELD"


def test_independent_provider_failure_rolls_back_instead_of_recording_success():
    c=fresh();bid=board(c)
    before=snapshot(c)
    with pytest.raises(RuntimeError,match="CONSENSUS_REJECTED"):
        claim(c,bid,validator=RuntimeError("independent provider failed"))
    assert snapshot(c)==before


@pytest.mark.parametrize("scope",["OUT_OF_SCOPE","UNCLEAR"])
def test_nonpositive_scope_cannot_carry_inconsistent_pair_rows(scope):
    raw={"scope":scope,"comparisons":[{"id":"r0","relation":"DISJOINT"}]}
    result=sm.decode_model(raw,DATA["quickstart"],[{"work":DATA["quickstart"]}])
    assert result["decision"] is None and result["diagnostic"]["code"]=="UNEXPECTED_COMPARISON"


def test_historical_completion_is_not_misrepresented_as_deduplication():
    c=fresh();bid=board(c);first=claim(c,bid)
    c.hand_in(first,ARTIFACT)
    second=claim(c,bid,B,work=DATA["quickstart"])
    assert c.requests[second].state=="HELD"
    assert json.loads(c.requests[second].snapshot)["held"]==[]


@pytest.mark.parametrize("date",["1970-01-01T00:00:00Z","2000-02-29T23:59:59Z","2100-03-01T00:00:00Z","9999-12-31T23:59:59Z"])
def test_clock_calendar_against_independent_standard_datetime(date):
    expected=int(datetime.fromisoformat(date.replace("Z","+00:00")).timestamp())
    assert sm.utc_seconds(date)==expected


def test_duplicate_board_and_unknown_objects_do_not_mutate_storage():
    c=fresh();bid=board(c)
    reject(c,"BOARD_EXISTS",c.create_board,"docs",DATA["brief"],json.dumps([A,B]),3600)
    reject(c,"BOARD_NOT_FOUND",c.close_intake,A+":unknown")
    reject(c,"REQUEST_NOT_FOUND",c.hand_in,bid+":unknown",ARTIFACT)
