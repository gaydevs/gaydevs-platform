import './sandbox/guard.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { decide } from './reconcile-policy.mjs';
const base=(number,status,evidence={},changes={})=>({issue:{number,state:'open',type:{name:'Tech Debt'}},item:status===null?null:{status},eligible:true,priority:'Medium',evidence,...changes});
test('audit cases: current specification only with explicit evidence',()=>{
 for(const n of [113,115]){
  assert.equal(decide(base(n,'Backlog',{specifying:true,activity:true})).target,'Specifying');
  assert.equal(decide(base(n,'Backlog',{activity:true})).action,'report');
 }
});
test('audit cases: delivery required for finish/close',()=>{
 for(const n of [114,117]) assert.equal(decide(base(n,'Backlog',{delivered:true})).action,'finish');
 for(const n of [29,60,66,68,98,102]){
  assert.equal(decide(base(n,'Done',{delivered:true})).action,'close');
  assert.equal(decide(base(n,'Done',{})).action,'report');
 }
});
test('audit cases: missing type not inferred',()=>{
 for(const n of [55,56,57]) assert.equal(decide(base(n,null,{}, {issue:{number:n,state:'open',type:null},eligible:false})).action,'report');
});
test('no promotion from open PR with unapproved specification',()=>{
 assert.equal(decide(base(115,'Specifying',{workPr:'open',activity:true})).action,'noop');
});
test('conflicting, missing or pending evidence fails closed',()=>{
 for(const e of [{conflict:'race'},{incomplete:true},{reopened:true},{excluded:true},{pendingWork:true},{blocked:true}]) assert.equal(decide(base(27,'Backlog',{delivered:true,...e})).action,'report');
});
test('PR transitions require gates; closed unmerged restores In Progress only from Review',()=>{
 assert.equal(decide(base(27,'In Progress',{workPr:'open',gates:true})).target,'Review');
 assert.equal(decide(base(27,'Review',{workPr:'merged',gates:true})).target,'Ready for Release');
 assert.equal(decide(base(27,'Review',{workPr:'closed',gates:true})).target,'In Progress');
 assert.equal(decide(base(27,'Backlog',{workPr:'merged',activity:true})).action,'report');
});
test('new eligible issue only, missing Priority and terminal decisions',()=>{
 assert.equal(decide(base(27,null)).target,'Backlog');
 assert.equal(decide(base(27,null,{}, {priority:null})).action,'report');
 assert.equal(decide(base(27,'Rejected',{delivered:true})).action,'report');
 assert.equal(decide(base(27,'Backlog',{delivered:true},{issue:{number:27,state:'closed',state_reason:'not_planned',type:{name:'Tech Debt'}}})).action,'report');
});
