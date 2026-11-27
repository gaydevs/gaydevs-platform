import test from 'node:test';
import assert from 'node:assert/strict';
import { sandbox, issue, pullRequest, ok } from './sandbox/index.mjs';

test('reconcile: dry-run reports missing card and priority/type without mutation', t=>{
  const s=sandbox(t);
  s.change(v=>{
    v.issues[55]=issue(55,null);
    v.issues[56]=issue(56,null,{title:'[team] quero entrar no gdevs-team'});
    v.fields[28]=[];
  });
  const report=JSON.parse(ok(s.cli('reconcile',[])));
  assert.equal(report.mode,'dry-run');
  assert.equal(report.results.find(x=>x.number===27).target,'Backlog');
  assert.equal(report.results.find(x=>x.number===28).priorityMissing,true);
  assert.equal(report.results.find(x=>x.number===55).action,'report');
  assert.equal(report.results.find(x=>x.number===56),undefined);
  assert.deepEqual(s.mutations(),[]);
});
test('reconcile: scoped apply inserts once and repeat is a no-op',t=>{
  const s=sandbox(t);
  const first=JSON.parse(ok(s.cli('reconcile',['--apply','--issue','27'])));
  assert.equal(first.results[0].result,'verified');
  assert.equal(s.state().items.I_27.status,'Backlog');
  s.clearCalls();
  const again=JSON.parse(ok(s.cli('reconcile',['--apply','--issue','27'])));
  assert.equal(again.results[0].action,'noop');
  assert.deepEqual(s.mutations(),[]);
});
test('reconcile: history records native reset and does not infer a missing gate',t=>{
  const s=sandbox(t);
  s.change(v=>{
    v.items.I_27={id:'ITEM_I_27',status:'Backlog'};
    v.branches=[{name:'feat/00027-technical-fixture-27',commit:{sha:'fixture'}}];
    v.statusHistory={I_27:[{id:'reset',createdAt:'2026-11-27T05:00:00Z',previousStatus:'In Progress',status:'Backlog',actor:{login:'github-project-automation'},project:{id:'P_1'}}]};
  });
  const report=JSON.parse(ok(s.cli('reconcile',['--apply','--issue','27'])));
  assert.equal(report.results[0].action,'report');
  assert.equal(report.results[0].evidence.regressedFrom,'In Progress');
  assert.equal(report.results[0].evidence.regressions[0].actor,'github-project-automation');
  assert.deepEqual(s.mutations(),[]);
});
test('reconcile: advanced mode cannot run globally',t=>{
  const s=sandbox(t);
  const result=s.cli('reconcile',['--apply','--advanced']);
  assert.notEqual(result.status,0);
  assert.deepEqual(s.mutations(),[]);
});

function deliveredFixture(s, conclusion='success') {
  s.change(v=>{
    v.items.I_27={id:'ITEM_I_27',status:'Done'};
    v.pulls[101]=pullRequest(101,27,{state:'closed',merged:true,merged_at:'2026-11-27T05:00:00Z',merge_commit_sha:'work-merge',changed_files:1,user:{login:'author'}});
    v.pulls[200]=pullRequest(200,0,{state:'closed',merged:true,merged_at:'2026-11-27T06:00:00Z',merge_commit_sha:'release-merge',head:{ref:'develop',sha:'release-head'},base:{ref:'main',sha:'base'},changed_files:1,body:'',user:{login:'release-author'}});
    v.reviews={101:[{state:'APPROVED',commit_id:'head-101',submitted_at:'2026-11-27T04:59:00Z',author_association:'MEMBER',user:{login:'reviewer',type:'User'}}],200:[{state:'APPROVED',commit_id:'release-head',submitted_at:'2026-11-27T05:59:00Z',author_association:'OWNER',user:{login:'admin',type:'User'}}]};
    v.commits={'release-merge':{parents:[{sha:'base'},{sha:'release-head'}]}};
    v.compares={'base...release-merge':{commits:[{sha:'work-merge'},{sha:'release-merge'}]},'release-merge...main':{status:'identical',behind_by:0,commits:[]}};
    v.pullFiles[101]=[{filename:'backend/a.php'}];
    v.pullFiles[200]=[{filename:'backend/a.php'}];
    v.deployRuns={'backend-deploy.yml':{'release-merge':[{head_sha:'release-merge',status:'completed',conclusion,created_at:'2026-11-27T06:10:00Z'}]}};
  });
}
test('reconcile: release evidence proposes close, dry-run and default apply never close advanced',t=>{
  const s=sandbox(t); deliveredFixture(s);
  let report=JSON.parse(ok(s.cli('reconcile',['--issue','27'])));
  assert.equal(report.results[0].action,'close');
  assert.equal(report.results[0].evidence.release,200);
  assert.deepEqual(s.mutations(),[]);
  report=JSON.parse(ok(s.cli('reconcile',['--apply','--issue','27'])));
  assert.equal(report.results[0].result,'pending-validation');
  assert.deepEqual(s.mutations(),[]);
});
test('reconcile: failed deploy never authorizes closure even in scoped advanced mode',t=>{
  const s=sandbox(t); deliveredFixture(s,'failure');
  const report=JSON.parse(ok(s.cli('reconcile',['--apply','--advanced','--issue','27'])));
  assert.equal(report.results[0].action,'report');
  assert.equal(s.state().issues[27].state,'open');
  assert.deepEqual(s.mutations(),[]);
});
test('reconcile: verified scoped close and rerun are idempotent',t=>{
  const s=sandbox(t); deliveredFixture(s);
  const report=JSON.parse(ok(s.cli('reconcile',['--apply','--advanced','--issue','27'])));
  assert.equal(report.results[0].result,'verified');
  assert.equal(s.state().issues[27].state_reason,'completed');
  assert.equal(s.mutations().filter(c=>c.method==='PATCH').length,1);
  s.clearCalls();
  const again=JSON.parse(ok(s.cli('reconcile',['--apply','--advanced','--issue','27'])));
  assert.equal(again.results[0].action,'noop');
  assert.deepEqual(s.mutations(),[]);
});

test('reconcile: CI-only change does not require an unrelated product deploy',t=>{
  const s=sandbox(t); deliveredFixture(s,'failure');
  s.change(v=>{v.pullFiles[101]=[{filename:'.github/workflows/ci.yml'}];});
  const report=JSON.parse(ok(s.cli('reconcile',['--issue','27'])));
  assert.equal(report.results[0].action,'close');
  assert.deepEqual(s.mutations(),[]);
});
test('reconcile: close-delivered requires explicit scope and does not add or move cards',t=>{
  const s=sandbox(t);
  assert.notEqual(s.cli('reconcile',['--apply','--close-delivered']).status,0);
  const report=JSON.parse(ok(s.cli('reconcile',['--apply','--close-delivered','--issue','27'])));
  assert.equal(report.results[0].result,'skipped-close-only');
  assert.deepEqual(s.mutations(),[]);
});

test('reconcile: newer In Progress decision is preserved when PR is already open',t=>{
  const s=sandbox(t);
  s.change(v=>{
    v.items.I_27={id:'ITEM_I_27',status:'In Progress'};
    v.pulls[101]=pullRequest(101,27,{created_at:'2026-11-27T05:00:00Z'});
    v.statusHistory={I_27:[{id:'manual',createdAt:'2026-11-27T14:38:00Z',previousStatus:'Backlog',status:'In Progress',actor:{login:'reviewer'},project:{id:'P_1'}}]};
  });
  const report=JSON.parse(ok(s.cli('reconcile',['--apply','--advanced','--issue','27'])));
  assert.equal(report.results[0].action,'report');
  assert.match(report.results[0].reason,/PR anterior/);
  assert.equal(s.state().items.I_27.status,'In Progress');
  assert.deepEqual(s.mutations(),[]);
});
