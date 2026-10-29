import copy
import importlib.util
import json
from pathlib import Path
import sys
import types
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


def board(c, name="docs", roster=None):
    return c.create_board(name, DATA["brief"], json.dumps(roster or [A,B]))


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
    active = c._active(c.boards[bid])
    result = verdict(scope, relations or ["DISJOINT"]*len(active), work, active) if leader is None else leader
    outputs.extend([copy.deepcopy(result), copy.deepcopy(result if validator is None else validator)])
    return c.claim_work(bid, c._round_digest(c.boards[bid]), int(c.boards[bid].epoch), nonce, work)


def snapshot(c):
    return copy.deepcopy((c.boards,c.requests,c.board_counts,c.request_counts))


def reject(c, message, function, *args):
    before = snapshot(c)
    with pytest.raises(UserError, match=message):
        function(*args)
    assert snapshot(c) == before


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
    assert len(json.loads(c.get_board(bid))["active"]) == 1


def test_wrong_independent_verdict_rejects_outer_consensus_without_quota_or_right():
    c=fresh();bid=board(c);claim(c,bid)
    before=snapshot(c)
    active=c._active(c.boards[bid])
    with pytest.raises(RuntimeError,match="CONSENSUS_REJECTED"):
        claim(c,bid,B,work=DATA["overlap"],leader=verdict(relations=["DISJOINT"]),
              validator=verdict(relations=["OVERLAP"],work=DATA["overlap"],active=active))
    assert snapshot(c) == before


def test_witness_wording_may_differ_when_both_exact_and_effects_agree():
    c=fresh();bid=board(c);claim(c,bid)
    active=c._active(c.boards[bid])
    first=verdict(relations=["OVERLAP"],work=DATA["overlap"],active=active)
    other=copy.deepcopy(first)
    other["comparisons"][0]["candidate_quote"]="beginner tutorial"
    other["comparisons"][0]["held_quote"]="deployment quickstart"
    second=claim(c,bid,B,work=DATA["overlap"],leader=first,validator=other)
    assert c.requests[second].state == "CONFLICT"


@pytest.mark.parametrize("mutation,code",[("omit","MISSING_COMPARISON"),("duplicate","INVALID_CHECK_ID"),
    ("extra","INVALID_SCHEMA"),("wrong_id","INVALID_CHECK_ID"),("bad_quote","INVALID_WITNESS"),
    ("wrong_source","INVALID_WITNESS"),("short_quote","INVALID_WITNESS"),("relation","INVALID_RELATION")])
def test_all_active_comparisons_and_grounded_witnesses_required(mutation,code):
    c=fresh();bid=board(c);claim(c,bid)
    active=c._active(c.boards[bid])
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
    assert len(json.loads(c.get_board(bid))["active"])==1


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
    sender(actors[0]);c.release(json.loads(c.boards[bid].active_ids)[0], c.requests[json.loads(c.boards[bid].active_ids)[0]].commitment)
    rid=claim(c,bid,actors[0],nonce="next",work="A new independently declared work outcome")
    assert len(json.loads(c.requests[rid].snapshot)["held"])==7


def test_adversarial_source_cannot_bypass_independent_semantic_check_in_harness():
    c=fresh();bid=board(c);claim(c,bid)
    active=c._active(c.boards[bid])
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

