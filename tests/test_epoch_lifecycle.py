import copy
import json
import pytest
from test_scope_mutex import (A, B, C, D, ARTIFACT, DATA, Address, BigInt, UserError,
    gl, sm, outputs, board, claim, fresh, sender, snapshot, reject)


def args(c,bid,nonce="new",work=None):
    b=c.boards[bid]
    return [bid,c._round_digest(b),int(b.epoch),nonce,work or DATA["quickstart"]]


def hand_in(c,rid,artifact=ARTIFACT):
    return c.hand_in(rid,c.requests[rid].commitment,artifact)


def test_two_disjoint_rights_exact_holder_consumption_and_replay():
    c=fresh();bid=board(c);a=claim(c,bid);b=claim(c,bid,B,work=DATA["disjoint"])
    assert len(json.loads(c.get_board(bid))["active"])==2
    reject(c,"HOLDER_ONLY",c.hand_in,a,c.requests[a].commitment,ARTIFACT)
    sender(A);hand_in(c,a)
    assert c.requests[a].state=="HANDED_IN" and c.requests[a].artifact_digest==ARTIFACT
    reject(c,"NOT_HELD",c.hand_in,a,c.requests[a].commitment,ARTIFACT)
    sender(B);c.release(b,c.requests[b].commitment)
    assert c.requests[b].state=="RELEASED" and json.loads(c.boards[bid].active_ids)==[]


def test_epoch_end_cancels_all_unhanded_rights_but_preserves_historical_artifact():
    c=fresh();bid=board(c);a=claim(c,bid);hand_in(c,a)
    b=claim(c,bid,B,work=DATA["disjoint"])
    sender(A);assert c.end_round(bid,1)==1
    assert c.requests[b].state=="CANCELLED" and c.requests[b].artifact_digest==""
    assert c.requests[a].state=="HANDED_IN" and c.requests[a].artifact_digest==ARTIFACT
    sender(B);reject(c,"ROUND_NOT_ACTIVE",c.hand_in,b,c.requests[b].commitment,ARTIFACT)


@pytest.mark.parametrize("timestamp",[None,"1970-01-01T00:00:00Z","2026-10-28T00:00:00Z","9999-12-31T23:59:59Z"])
def test_old_queued_handoff_after_end_cannot_use_backdated_transaction_time(timestamp):
    c=fresh();bid=board(c);rid=claim(c,bid,B)
    sender(A);c.end_round(bid,1)
    gl.message_raw={"datetime":timestamp}
    sender(B);reject(c,"ROUND_NOT_ACTIVE",c.hand_in,rid,c.requests[rid].commitment,ARTIFACT)
    assert c.requests[rid].artifact_digest==""


def test_new_round_requires_fresh_digest_epoch_and_claim_even_with_same_nonce():
    c=fresh();bid=board(c);rid=claim(c,bid,B)
    old=args(c,bid,"first");old_digest=c._round_digest(c.boards[bid])
    sender(A);c.end_round(bid,1);assert c.start_round(bid,1)==2
    sender(B)
    reject(c,"STALE_ROUND",c.claim_work,*old)
    reject(c,"ROUND_DIGEST_MISMATCH",c.claim_work,bid,old_digest,2,"first",DATA["quickstart"])
    reject(c,"ROUND_NOT_ACTIVE",c.hand_in,rid,c.requests[rid].commitment,ARTIFACT)
    new=claim(c,bid,B)
    assert new!=rid and c.requests[new].epoch==2 and c.requests[new].state=="HELD"


def test_intake_close_does_not_revoke_but_end_round_is_explicit_revocation():
    c=fresh();bid=board(c);rid=claim(c,bid,B)
    sender(A);c.close_intake(bid,1)
    sender(B);reject(c,"INTAKE_CLOSED",c.claim_work,*args(c,bid))
    hand_in(c,rid);assert c.requests[rid].state=="HANDED_IN"
    sender(A);c.end_round(bid,1);c.start_round(bid,1)
    rid=claim(c,bid,B,nonce="second")
    sender(A);c.end_round(bid,2)
    sender(B);reject(c,"ROUND_NOT_ACTIVE",c.hand_in,rid,c.requests[rid].commitment,ARTIFACT)


@pytest.mark.parametrize("method",["close_intake","end_round","start_round"])
def test_control_transactions_are_creator_only_and_epoch_bound(method):
    c=fresh();bid=board(c);sender(B)
    reject(c,"CREATOR_ONLY",getattr(c,method),bid,1)
    sender(A)
    if method=="start_round":c.end_round(bid,1)
    reject(c,"STALE_ROUND",getattr(c,method),bid,0)
    reject(c,"STALE_ROUND",getattr(c,method),bid,True)


def test_stale_close_end_and_start_cannot_affect_next_round():
    c=fresh();bid=board(c);c.end_round(bid,1);c.start_round(bid,1)
    for method in (c.close_intake,c.end_round,c.start_round):reject(c,"STALE_ROUND",method,bid,1)
    assert c.boards[bid].round_open and c.boards[bid].intake_open and c.boards[bid].epoch==2
    reject(c,"ROUND_ALREADY_OPEN",c.start_round,bid,2)


def test_round_end_and_restart_are_not_replayable():
    c=fresh();bid=board(c);c.end_round(bid,1)
    reject(c,"ROUND_CLOSED",c.end_round,bid,1)
    reject(c,"ROUND_CLOSED",c.close_intake,bid,1)
    reject(c,"ROUND_CLOSED",c.claim_work,*args(c,bid))
    c.start_round(bid,1);reject(c,"STALE_ROUND",c.start_round,bid,1)


def test_no_clock_needed_for_admission_views_or_consumer():
    c=fresh();gl.message_raw={};bid=board(c);rid=claim(c,bid)
    assert json.loads(c.get_request(rid))["epoch"]==1
    hand_in(c,rid);assert c.requests[rid].state=="HANDED_IN"


@pytest.mark.parametrize("change",["round_end","epoch","revision","digest","held_set"])
def test_semantic_result_cannot_commit_against_changed_round_or_snapshot(change):
    import test_scope_mutex as harness
    c=fresh();bid=board(c);a=claim(c,bid)
    def modify():
        if change=="round_end":c.boards[bid].round_open=False
        if change=="epoch":c.boards[bid].epoch+=1
        if change=="revision":c.boards[bid].revision+=1
        if change=="digest":c.boards[bid].commitment="0"*64
        if change=="held_set":c.boards[bid].active_ids="[]"
    harness.after_consensus=modify
    before=copy.deepcopy(c.request_counts)
    with pytest.raises(UserError,match="STALE_SNAPSHOT"):
        claim(c,bid,B,work=DATA["disjoint"])
    assert len(c.requests)==1 and c.request_counts==before


def test_replay_wrong_digest_and_holder_no_admin_bypass():
    c=fresh();bid=board(c);rid=claim(c,bid,B)
    reject(c,"REQUEST_REPLAY",c.claim_work,*args(c,bid,"first"))
    reject(c,"ALREADY_HOLDING",c.claim_work,*args(c,bid,"other"))
    reject(c,"REQUEST_DIGEST_MISMATCH",c.hand_in,rid,"0"*64,ARTIFACT)
    sender(A);reject(c,"HOLDER_ONLY",c.hand_in,rid,c.requests[rid].commitment,ARTIFACT)
    sender(C);reject(c,"MEMBER_ONLY",c.claim_work,*args(c,bid))


@pytest.mark.parametrize("bad",["","F"*64,"0x"+ARTIFACT,"a"*63])
def test_artifact_exact_shape_preserved(bad):
    c=fresh();bid=board(c);rid=claim(c,bid)
    reject(c,"INVALID_ARTIFACT_DIGEST",c.hand_in,rid,c.requests[rid].commitment,bad)


def test_quotas_remain_isolated_and_are_not_reset_to_evade_bound_by_round():
    c=fresh();bid=board(c);c.request_counts[bid+":"+A]=BigInt(sm.MAX_REQUESTS_PER_MEMBER)
    c.end_round(bid,1);c.start_round(bid,1)
    reject(c,"MEMBER_REQUEST_LIMIT",c.claim_work,*args(c,bid))
    rid=claim(c,bid,B);assert c.requests[rid].state=="HELD"
    sender(A);c.board_counts[A]=BigInt(sm.MAX_BOARDS_PER_CREATOR)
    reject(c,"CREATOR_BOARD_LIMIT",c.create_board,"other",DATA["brief"],json.dumps([A]))
    sender(B);assert board(c,"other").startswith(B)


@pytest.mark.parametrize("raw,code",[("bad","INVALID_JSON"),(None,"INVALID_SCHEMA"),
    ({"scope":"ALLOW","comparisons":[]},"INVALID_SCOPE"),(RuntimeError("provider down"),"MODEL_CALL_FAILED")],
    ids=["bad-json","schema","scope","provider"])
def test_failure_never_grants_and_keeps_diagnostic(raw,code):
    c=fresh();bid=board(c);outputs.append(raw)
    rid=c.claim_work(*args(c,bid));p=json.loads(c.get_request(rid))
    assert p["stored_state"]=="UNRESOLVED" and p["assessment"]["diagnostic"]["code"]==code
    assert json.loads(c.boards[bid].active_ids)==[]


def test_creator_policy_and_source_domain_are_sealed():
    c=fresh();bid=board(c);original=c.boards[bid].commitment
    assert json.loads(c.get_board(bid))["round_authority"]==sm.ROUND_AUTHORITY
    c=fresh();gl.message.contract_address=Address(D);bid=board(c)
    assert c.boards[bid].commitment!=original
    c=fresh();gl.message.chain_id=1;bid=board(c)
    assert c.boards[bid].commitment!=original
