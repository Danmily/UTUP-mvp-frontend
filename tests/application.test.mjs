import test from 'node:test'
import assert from 'node:assert/strict'
import { assetState, togglePageSelection, makeDraft, resolvedPurpose, validateDraft, submissionPlan, mergePending, parsePending } from '../web/src/flows/application-model.mjs'
import { VIEWS, TAGS } from '../web/src/data.js'
const view=VIEWS.consumer
const tags=TAGS.filter(t=>assetState(view,t,[]).selectable).slice(0,3)
test('current-page selection preserves other pages and insertion order',()=>{
 assert.deepEqual(togglePageSelection([7,3],[3,4]),[7,3,4])
 assert.deepEqual(togglePageSelection([7,3,4],[3,4]),[7])
 assert.deepEqual(togglePageSelection([7],[]),[7])
})
test('active permission wins even without a portal application',()=>{
 const s=assetState(view,tags[0],[],{valid:'永久',days:9999});assert.equal(s.label,'可使用');assert.equal(s.selectable,false)
})
test('successful receipt prevents duplicate submissions without claiming permission',()=>{
 const records=[{tagId:tags[0].id,at:'2026-09-29',submissionStatus:'submitted'}]
 assert.equal(assetState(view,tags[0],records,null).selectable,false)
 const d=makeDraft([tags[0]]);d.scene='人群圈选';d.description='用于新品推广目标人群筛选';assert.match(validateDraft(view,d,records),/本次演示已提交/)
})
test('historical unknown approval does not get labelled as pending approval',()=>{
 const s=assetState(view,tags[0],[{tagId:tags[0].id,at:'2026-07-01'}],null)
 assert.equal(s.label,'已申请 · 未生效');assert.equal(s.selectable,true)
})
test('shared and per-label purpose are resolved separately and retained on retry',()=>{
 const d=makeDraft(tags);d.scene='人群圈选';d.description='筛选本次新品推广的目标用户'
 d.overrides[tags[1].id]={custom:true,scene:'数据分析',description:'分析本次活动目标人群分布'}
 assert.equal(resolvedPurpose(d,tags[0]).scene,'人群圈选');assert.equal(resolvedPurpose(d,tags[1]).scene,'数据分析')
 const retry=makeDraft([tags[1]],d);assert.equal(resolvedPurpose(retry,tags[1]).description,'分析本次活动目标人群分布')
 assert.equal(retry.description,d.description)
})
test('empty selection and incomplete individual use cases block submission',()=>{
 assert.match(validateDraft(view,makeDraft([]),[]),/至少选择/)
 const d=makeDraft(tags);d.scene='数据分析';d.description='分析目标用户群体的分布';d.overrides[tags[1].id]={custom:true,scene:'',description:''}
 assert.match(validateDraft(view,d,[]),/请选择使用场景/)
})
test('partial failure retry includes only failed labels',()=>{
 const d=makeDraft(tags);d.scene='数据分析';d.description='分析目标用户群体的分布';d.outcome='partial'
 const first=submissionPlan(d);assert.equal(first.filter(r=>r.success).length,2)
 const retry=makeDraft(first.filter(r=>!r.success).map(r=>r.tag),d)
 const second=submissionPlan(retry);assert.equal(second.length,1);assert.equal(second[0].success,true)
 assert.ok(first.filter(r=>r.success).every(r=>r.tag.id!==second[0].tag.id))
})
test('PSM requests are routed to manual coordination instead of a fabricated self-service API',()=>{
 const psm=TAGS.find(t=>t.callType==='psm');assert.ok(psm)
 assert.equal(assetState(view,psm,[],null).selectable,false)
})

test('pending list adds from details and batch without dropping earlier picks or duplicating IDs',()=>{
 assert.deepEqual(mergePending([7,3],[3,4]),[7,3,4]);assert.deepEqual(mergePending([7],[]),[7]);
})
test('pending list restores only known IDs and tolerates invalid stored data',()=>{
 assert.deepEqual(parsePending('[3,3,4,999,"3"]',[3,4]),[3,4]);assert.deepEqual(parsePending('broken',[3]),[]);assert.deepEqual(parsePending('{"id":3}',[3]),[])
})
