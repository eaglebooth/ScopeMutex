// No deploy/upgrade capability. Real SDK calls only after exact source parity.
import {createClient,createAccount} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {isDeepStrictEqual as same} from 'node:util';

const address=process.env.SCOPEMUTEX_CONTRACT;
const mode=process.argv[2]||'preflight';
const run=process.env.SCOPEMUTEX_RUN||'review-v1';
if(!/^0x[0-9a-fA-F]{40}$/.test(address||''))throw Error('Set SCOPEMUTEX_CONTRACT to the user-deployed address');
if(!['preflight','core','audit','expiry','race','boundary'].includes(mode)||!/^[a-z][a-z0-9_-]{0,15}$/.test(run))throw Error('Invalid mode/run');
const check=(x,m)=>{if(!x)throw Error(m)};
const sha=x=>createHash('sha256').update(x).digest('hex');
const client=()=>createClient({chain:studionet});
const read=async(functionName,args=[])=>JSON.parse(String(await client().readContract({address,functionName,args,transactionHashVariant:'latest-final'})));
const source=readFileSync('contracts/scope_mutex.py');
const remote=Buffer.from(await client().getContractCode(address),'utf8');
const version=await read('get_version');
mkdirSync('docs/live-evidence',{recursive:true});
const preflight={checked_at:new Date().toISOString(),address,chain_id:studionet.id,
 source_sha256:sha(source),deployed_sha256:sha(remote),byte_for_byte:source.equals(remote),version};
const preflightPath=`docs/live-evidence/preflight-${address.toLowerCase()}-${Date.now()}.json`;
writeFileSync(preflightPath,JSON.stringify(preflight,null,2)+'\n',{flag:'wx'});
check(preflight.byte_for_byte&&version.name==='ScopeMutex'&&version.version==='0.1.0'&&version.policy==='scopemutex/atomic-work-exclusion-v1','Preflight mismatch; no signing');
console.log(`Source parity: ${preflight.source_sha256}`);
if(mode==='preflight')process.exit(0);
const entry=process.env.GENLAYER_CLI_ENTRY;check(entry,'Set GENLAYER_CLI_ENTRY for authorized secondary OS-keychain accounts');
const keytar=createRequire(entry)('keytar');
const keys=await Promise.all(['dbl-owner','dbl-adapter'].map(n=>keytar.getPassword('genlayer-cli',`account:${n}`)));
check(keys.every(Boolean),'Missing authorized test accounts');
const actors=keys.map(k=>createAccount(k.startsWith('0x')?k:`0x${k}`));
check(same(actors.map(a=>a.address.toLowerCase()),['0xeb57bc7125fa60d7482ce12058397369ab3581f8','0x2da5393d7bbb9a037dc3abb56dbbc5c150fc843f']),'Wrong signers; never use main deployer');
const sampleBytes=readFileSync('samples/workboard.json'),sample=JSON.parse(sampleBytes);
const artifactBytes=readFileSync('samples/hand-in.txt'),artifact=sha(artifactBytes);
const context={address,chain_id:studionet.id,source_sha256:sha(source),sample_sha256:sha(sampleBytes),artifact_sha256:artifact,
 actors:actors.map(a=>a.address),run};
const path=`docs/live-evidence/run-${address.toLowerCase()}-${run}.jsonl`;
const events=existsSync(path)?readFileSync(path,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const log=(event,data)=>{const item={at:new Date().toISOString(),event,...data};appendFileSync(path,JSON.stringify(item,(_,v)=>typeof v==='bigint'?String(v):v)+'\n');events.push(item)};
if(events.length)check(same(events[0].context,context),'Resume context mismatch');else log('context',{context});
log('session',{mode,preflight,runner_sha256:sha(readFileSync('scripts/live.mjs'))});
const bid=name=>actors[0].address.toLowerCase()+':'+name+'-'+run;
const rid=(board,actor,nonce)=>board+':'+actors[actor].address.toLowerCase()+':'+nonce;
const state=id=>read('get_request',[id]);
const board=id=>read('get_board',[id]);
async function observed(boardId,watch=[]){
 if(!boardId)return null;
 const b=await board(boardId),requests={};
 for(const id of [...new Set([...b.registered_ids,...watch])])requests[id]=await state(id);
 return {board:b,requests};
}
function stored(snapshot){
 if(!snapshot)return null;
 const value=structuredClone(snapshot);
 delete value.board.effective_active;
 for(const r of Object.values(value.requests))delete r.effective_state;
 return value;
}
function index(){
 const submitted=events.filter(e=>e.event==='submitted');
 const rows=submitted.map(s=>{
  const receipt=events.filter(e=>e.event==='receipt'&&e.label===s.label).at(-1);
  const intent=events.find(e=>e.event==='intent'&&e.label===s.label);
  const verified=events.some(e=>e.event==='verified'&&e.label===s.label);
  return `| ${s.label} | [tx](https://explorer-studio.genlayer.com/transactions/${s.hash}) | ${receipt?.transaction?.statusName||'pending'} | ${intent.input.expectedError||'success expected; inspect business result'} | ${verified?'verified':'incomplete'} |`;
 }).join('\n');
 writeFileSync(path.replace(/\.jsonl$/,'.md'),`# ScopeMutex actual live transaction index\n\nContract: [${address}](https://explorer-studio.genlayer.com/address/${address})\n\nSource SHA-256: ${context.source_sha256}\n\nRaw append-only events: [JSONL](${path.split('/').pop()}).\n\nRecorded phase completions: ${events.filter(e=>e.event==='phase-completed').map(e=>e.phase).join(', ')||'none'}. These are scoped observations, not proof of universal semantic reliability.\n\n| Step | Explorer | Finality | Execution expectation | Verification |\n|---|---|---|---|---|\n${rows}\n\nA finalized accepted consensus can contain an execution error or a business denial. Inspect receipt and authoritative readback. No fixture verdict is injected into a live call.\n`);
}
async function send(label,actor,method,args,boardId=null,expectedError=null,watch=[]){
 const input={actor:actors[actor].address,method,args,boardId,expectedError,watch};
 let intent=events.find(e=>e.event==='intent'&&e.label===label);
 const done=events.find(e=>e.event==='verified'&&e.label===label);
 if(intent)check(same(intent.input,input),'Resume input mismatch');
 if(done)return done.returned;
 let submitted=events.find(e=>e.event==='submitted'&&e.label===label);
 if(intent&&!submitted)throw Error('Ambiguous prior signing intent: investigate before resending');
 if(!intent){
  intent={label,input,before:await observed(boardId,watch)};log('intent',intent);
  const sent=await createClient({chain:studionet,account:actors[actor]}).writeContract({address,functionName:method,args,value:0n});
  const hash=typeof sent==='string'?sent:sent.txId;log('submitted',{label,hash});index();
  check(/^0x[0-9a-fA-F]{64}$/.test(hash),'Invalid hash');submitted={hash};
 }
 console.log(`${label}: ${submitted.hash}`);
 let tx;
 for(let i=0;i<180;i++){
  tx=await client().getTransaction({hash:submitted.hash});
  if(tx.statusName==='FINALIZED')break;
  await new Promise(r=>setTimeout(r,2500));
 }
 log('receipt',{label,transaction:tx});index();
 check(tx.statusName==='FINALIZED'&&tx.result_name==='MAJORITY_AGREE','No finalized accepted consensus; inspect existing hash, do not resend');
 check(tx.from_address?.toLowerCase()===actors[actor].address.toLowerCase()&&tx.to_address?.toLowerCase()===address.toLowerCase(),'Receipt binding mismatch');
 const receipts=tx.consensus_data?.leader_receipt;
 const list=Array.isArray(receipts)?receipts:Object.values(receipts||{});
 const leader=list.find(x=>x.mode==='leader')||list[0];
 const execution=leader?.genvm_result?.error_code?'ERROR':leader?.execution_result||tx.txExecutionResultName;
 check(execution===(expectedError?'ERROR':'SUCCESS'),'Unexpected execution result');
 const payload=leader?.result?.payload;
 const returned=payload&&typeof payload==='object'&&typeof payload.readable==='string'?JSON.parse(payload.readable):payload;
 let after=events.find(e=>e.event==='readback'&&e.label===label)?.after;
 if(after===undefined){after=await observed(boardId,watch);log('readback',{label,after});}
 if(expectedError){
  check(payload===expectedError,'Wrong rejection reason');
  check(same(stored(intent.before),stored(after)),'Rejected operation changed stored state');
 }
 log('verified',{label,returned});index();return returned;
}
async function create(name,ttl){
 const id=bid(name),digestArgs=[`${name}-${run}`,sample.brief,JSON.stringify(actors.map(a=>a.address)),ttl];
 const returned=await send(`${name}-create`,0,'create_board',digestArgs);
 check(returned===id,'Wrong board identity');return id;
}
async function acquire(label,boardId,actor,nonce,work,allowed,retry=0){
 const input={boardId,actor,nonce,work,allowed};
 const verified=events.find(e=>e.event==='business-verified'&&e.label===label);
 if(verified){check(same(verified.input,input),'Business resume mismatch');return verified.request_id;}
 const b=await board(boardId);
 const returned=await send(label,actor,'claim_work',[boardId,b.board_digest,nonce,work],boardId);
 check(returned===rid(boardId,actor,nonce),'Wrong request identity');
 const request=await state(returned),current=await board(boardId);
 log('business-readback',{label,request,board:current});
 if(request.stored_state==='UNRESOLVED'&&!allowed.includes('UNRESOLVED')&&retry===0){
  log('retry-intent',{label,previous_request:returned,diagnostic:request.assessment.diagnostic,
   scope:'One fresh nonce, same declaration, current snapshot; prior denial preserved'});
  return acquire(label+'-retry',boardId,actor,nonce+'-r1',work,allowed,1);
 }
 check(allowed.includes(request.stored_state),`${label}: unexpected semantic result ${request.stored_state}; inspect diagnostic`);
 if(request.stored_state==='HELD')check(current.registered_ids.includes(returned)&&request.effective_state==='HELD','Acquired right not currently registered');
 else check(!current.registered_ids.includes(returned)&&request.expires_at===0,'Denied request acquired a right');
 log('business-verified',{label,input,request_id:returned});
 return returned;
}
// Probe-only submissions intentionally overlap. Each uses a different secondary
// account. They do not assert whole-board no-mutation while another tx changes it.
async function begin(label,actor,method,args,boardId){
 const input={actor:actors[actor].address,method,args,boardId,expectedError:'probe-specific assertions',watch:[]};
 const intent=events.find(e=>e.event==='intent'&&e.label===label);
 const submitted=events.find(e=>e.event==='submitted'&&e.label===label);
 if(intent)check(same(intent.input,input),'Probe resume mismatch');
 if(submitted)return submitted.hash;
 check(!intent,'Ambiguous probe intent; inspect before resending');
 log('intent',{label,input,before:await observed(boardId)});
 const raw=await createClient({chain:studionet,account:actors[actor]}).writeContract({address,functionName:method,args,value:0n});
 const hash=typeof raw==='string'?raw:raw.txId;log('submitted',{label,hash});index();
 check(/^0x[0-9a-fA-F]{64}$/.test(hash),'Invalid probe hash');console.log(`${label}: ${hash}`);return hash;
}
async function collect(label,allowedErrors=[]){
 const submitted=events.find(e=>e.event==='submitted'&&e.label===label);
 const intent=events.find(e=>e.event==='intent'&&e.label===label);
 check(submitted&&intent,'Probe not submitted');
 const done=events.find(e=>e.event==='verified'&&e.label===label);
 if(done)return {...done,transaction:events.filter(e=>e.event==='receipt'&&e.label===label).at(-1).transaction};
 let tx;
 for(let i=0;i<180;i++){tx=await client().getTransaction({hash:submitted.hash});if(tx.statusName==='FINALIZED')break;await new Promise(r=>setTimeout(r,2500));}
 log('receipt',{label,transaction:tx});index();
 check(tx.statusName==='FINALIZED'&&tx.result_name==='MAJORITY_AGREE','Probe consensus/finality not accepted');
 check(tx.from_address.toLowerCase()===intent.input.actor.toLowerCase()&&tx.to_address.toLowerCase()===address.toLowerCase(),'Probe binding mismatch');
 const raw=tx.consensus_data?.leader_receipt;const list=Array.isArray(raw)?raw:Object.values(raw||{});
 const leader=list.find(x=>x.mode==='leader')||list[0];
 const execution=leader?.genvm_result?.error_code?'ERROR':leader?.execution_result||tx.txExecutionResultName;
 const payload=leader?.result?.payload;
 check(execution==='SUCCESS'||(execution==='ERROR'&&allowedErrors.includes(payload)),'Unexpected probe execution');
 const returned=payload&&typeof payload==='object'&&typeof payload.readable==='string'?JSON.parse(payload.readable):payload;
 log('readback',{label,after:await observed(intent.input.boardId)});
 log('verified',{label,returned,execution,payload});index();return {returned,execution,payload,transaction:tx};
}
try{
 if(events.some(e=>e.event==='phase-completed'&&e.phase===mode)){console.log(`${mode} already completed; no signing`);process.exit(0)}
 if(mode==='core'){
  const id=await create('core',3600);
  const a=await acquire('core-hold-a',id,0,'first',sample.quickstart,['HELD']);
  const conflict=await acquire('core-overlap',id,1,'overlap',sample.overlap,['CONFLICT']);
  await send('core-conflict-hand-in-denied',1,'hand_in',[conflict,artifact],id,'NOT_HELD',[conflict]);
  await send('core-other-release-denied',1,'release',[a],id,'HOLDER_ONLY');
  await send('core-close-noncreator-denied',1,'close_intake',[id],id,'CREATOR_ONLY');
  const b=await board(id);
  await send('core-wrong-digest',1,'claim_work',[id,'0'.repeat(64),'wrong',sample.disjoint],id,'BOARD_DIGEST_MISMATCH');
  await send('core-double-hold',0,'claim_work',[id,b.board_digest,'double',sample.disjoint],id,'ALREADY_HOLDING');
  await acquire('core-outside',id,1,'outside',sample.outside,['OUT_OF_SCOPE']);
  const other=await acquire('core-disjoint',id,1,'translation',sample.disjoint,['HELD']);
  await send('core-replay',1,'claim_work',[id,b.board_digest,'translation',sample.disjoint],id,'REQUEST_REPLAY');
  await send('core-wrong-holder',1,'hand_in',[a,artifact],id,'HOLDER_ONLY');
  await send('core-bad-artifact',1,'hand_in',[other,'not-a-digest'],id,'INVALID_ARTIFACT_DIGEST');
  await send('core-close',0,'close_intake',[id],id);
  await send('core-hand-in-after-intake-close',1,'hand_in',[other,artifact],id);
  check((await state(other)).artifact_digest===artifact,'Canonical artifact mismatch');
  await send('core-new-claim-after-close',1,'claim_work',[id,b.board_digest,'late',sample.disjoint],id,'INTAKE_CLOSED',[other]);
  await send('core-release-a',0,'release',[a],id);
  await send('core-hand-in-released-denied',0,'hand_in',[a,artifact],id,'NOT_HELD',[a]);
  check((await board(id)).registered_ids.length===0,'Core rights not consumed');
  const exp=await create('expiry',300);
  const held=await acquire('expiry-hold',exp,0,'hold',sample.quickstart,['HELD']);
  await send('expiry-early-sweep',1,'sweep_expired',[exp],exp,'NOTHING_EXPIRED');
  log('expiry-ready',{board_id:exp,request_id:held,expires_at:(await state(held)).expires_at});
 }else if(mode==='audit'){
  const id=await create('audit',3600);
  const a=await acquire('audit-hold',id,0,'hold',sample.quickstart,['HELD']);
  const denied=await acquire('audit-injection',id,1,'injection',sample.injection,['CONFLICT','UNRESOLVED']);
  await send('audit-denied-cannot-hand-in',1,'hand_in',[denied,artifact],id,'NOT_HELD',[denied]);
  if(!events.some(e=>e.event==='verified'&&e.label==='audit-holder-hand-in'))check((await state(a)).effective_state==='HELD','Existing right lost');
  await send('audit-holder-hand-in',0,'hand_in',[a,artifact],id);
  log('audit-scope',{scope:'One instruction-like declaration remained blocked; not universal injection resistance'});
 }else if(mode==='race'){
  const id=await create('race',3600),b=await board(id);
  const argsA=[id,b.board_digest,'race-a',sample.quickstart],argsB=[id,b.board_digest,'race-b',sample.overlap];
  await Promise.all([begin('race-submit-a',0,'claim_work',argsA,id),begin('race-submit-b',1,'claim_work',argsB,id)]);
  const results=await Promise.all([collect('race-submit-a',['STALE_SNAPSHOT']),collect('race-submit-b',['STALE_SNAPSHOT'])]);
  const requests=[];
  for(let i=0;i<2;i++)if(results[i].execution==='SUCCESS'){
   check(results[i].returned===rid(id,i,i===0?'race-a':'race-b'),'Race request binding mismatch');
   requests.push(await state(results[i].returned));
  }
  const current=await board(id),held=requests.filter(p=>p.stored_state==='HELD');
  check(held.length===1&&current.registered_ids.length===1&&current.effective_active.length===1,'Race did not yield exactly one held right');
  check(requests.every(p=>['HELD','CONFLICT','UNRESOLVED'].includes(p.stored_state)),'Unexpected race semantic classification');
  const winner=held[0],actor=winner.claimant.toLowerCase()===actors[0].address.toLowerCase()?0:1;
  check(current.registered_ids[0]===winner.id,'Race winner not registered');
  log('race-outcome',{requests,board:current,winner_actor:actor});
  await send('race-nonholder-hand-in',1-actor,'hand_in',[winner.id,artifact],id,'HOLDER_ONLY');
  await send('race-winner-hand-in',actor,'hand_in',[winner.id,artifact],id);
  check((await state(winner.id)).artifact_digest===artifact&&(await board(id)).registered_ids.length===0,'Race consumer mismatch');
 }else if(mode==='boundary'){
  const id=await create('boundary',180);
  const held=await acquire('boundary-hold',id,0,'held',sample.quickstart,['HELD']);
  let setup=events.find(e=>e.event==='boundary-setup');
  if(!setup){log('boundary-setup',{board_id:id,request_id:held,expires_at:(await state(held)).expires_at,lead_seconds:17});setup=events.find(e=>e.event==='boundary-setup');}
  // The first observed run's RPC/signing path took ~11 seconds. A 3-second lead
  // submitted after expiry and did not exercise a delayed-before-expiry case.
  // Keep that run, and seal the measured scheduling adjustment in the new setup.
  const expiry=setup.expires_at,target=expiry*1000-(setup.lead_seconds??3)*1000;
  if(!events.some(e=>e.event==='submitted'&&e.label==='boundary-blocker')){
   check(Date.now()<target,'Missed boundary submission window; do not mislabel this run');
   while(Date.now()<target){console.log(`Boundary scheduling wait: ${Math.ceil((target-Date.now())/1000)}s`);await new Promise(r=>setTimeout(r,Math.min(30000,target-Date.now())));}
  }
  const b=await board(id);
  await begin('boundary-blocker',1,'claim_work',[id,b.board_digest,'blocker',sample.disjoint],id);
  await begin('boundary-consumer',0,'hand_in',[held,artifact],id);
  const blocker=await collect('boundary-blocker',['STALE_SNAPSHOT']);
  const consumer=await collect('boundary-consumer',['LEASE_EXPIRED','NOT_HELD']);
  const rounds=consumer.transaction.consensus_history?.consensus_results||[];
  const starts=rounds.map(r=>r.monitoring?.['PROPOSING.LEADER.EXEC_START']);
  const created=Number(consumer.transaction.created_timestamp);
  const checkedAt=Date.now()/1000;
  const unixSeconds=Number.isSafeInteger(created)&&created>=946684800&&created<1e11&&created<=checkedAt+60
   &&starts.length>0&&starts.every(t=>typeof t==='number'&&Number.isFinite(t)&&t>=created-1&&t<=checkedAt+60&&t<1e11);
  const qualifies=unixSeconds&&created<expiry&&starts.every(t=>t>=expiry);
  const after=await state(held);
  log('boundary-outcome',{expires_at:expiry,created_timestamp:created,leader_exec_starts:starts,
   checked_at_unix_seconds:checkedAt,timestamp_units_validated:unixSeconds,qualifies,
   execution:consumer.execution,stored_state:after.stored_state,scope:'RPC monitoring timestamps are observations; finality time alone is not execution time'});
  if(blocker.execution==='SUCCESS'){
   const other=await state(blocker.returned);
   if(other.effective_state==='HELD')await send('boundary-release-blocker',1,'release',[other.id],id);
   else if(other.stored_state==='HELD')await send('boundary-sweep-blocker',1,'sweep_expired',[id],id);
  }
  check(qualifies,'Queued-before/processed-after boundary was not exercised; no pass claimed');
  check(consumer.execution==='ERROR','Transaction clock allowed queued-before-expiry consumption after processing-time expiry; strict processing-time gate FAILED');
  check(after.artifact_digest==='','Late boundary consumer registered an artifact');
 }else if(mode==='expiry'){
  const setup=events.find(e=>e.event==='expiry-ready');check(setup,'Complete core first');
  check(Date.now()/1000>=setup.expires_at,'Wait actual expiry; never advance host time');
  const id=setup.board_id;
  await send('expiry-late-hand-in-denied',0,'hand_in',[setup.request_id,artifact],id,'LEASE_EXPIRED',[setup.request_id]);
  const swept=await send('expiry-permissionless-sweep',1,'sweep_expired',[id],id,null,[setup.request_id]);
  check(swept===1&&(await state(setup.request_id)).stored_state==='EXPIRED','Expiry recovery mismatch');
  const recovered=await acquire('expiry-reacquire',id,1,'recovered',sample.overlap,['HELD']);
  await send('expiry-release-recovered',1,'release',[recovered],id);
  check((await board(id)).registered_ids.length===0,'Recovered right not released');
 }
 log('phase-completed',{phase:mode});index();console.log(`${mode} completed; inspect actual receipt/readback scope`);
}catch(error){log('error',{phase:mode,error:String(error.stack||error)});index();console.error(String(error));process.exitCode=1}
