const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const box = { module: { exports: {} } }
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../web/public/audience/agent.js'), 'utf8'), box)
const M = box.module.exports

test('business doc is parsed into goal / audience / budget / window / touchpoints with sources', () => {
  const b = M.parseBrief(M.DOC_SAMPLE.text)
  const f = Object.fromEntries(b.fields.map((x) => [x.key, x]))
  assert.equal(b.budget, 1200000)
  assert.equal(f.goal.src, '原文'); assert.match(f.audience.value, /沉默老客/)
  assert.equal(f.window.src, '推断'); assert.match(f.touch.value, /发券/)
  assert.equal(M.briefQuestions(b).map((q) => q.id).join(), 'window,face,exclude')
  const empty = M.parseBrief('随便写点东西')
  assert.ok(empty.fields.every((x) => x.src === '缺失')); assert.ok(M.briefQuestions(empty).some((q) => q.id === 'budget'))
})
test('at least three plans with size, cost, coverage and budget check; answers change cost', () => {
  const b = M.parseBrief(M.DOC_SAMPLE.text)
  const plans = M.buildPlans(b)
  assert.ok(plans.length >= 3)
  assert.ok(plans[0].size < plans[1].size && plans[1].size < plans[2].size)
  assert.ok(plans.every((p) => p.cost > 0 && p.coverage > 0 && p.tags.length))
  assert.ok(plans[2].cross && plans[2].gaps.length)
  b.answers.face = '20 元'
  assert.equal(M.buildPlans(b)[0].cost, plans[0].cost * 2)
  b.answers.exclude = '不排除'
  assert.ok(M.buildPlans(b).every((p) => p.conds.every((c) => c.group !== 'exclude')))
})
test('adopted plan drives conditions and size; metrics count adoption, edits and delivery', () => {
  const b = M.parseBrief(M.DOC_SAMPLE.text)
  const p = M.buildPlans(b)[1]
  const t = { ...M.newTask('x'), scene: 'promo', path: 'D', planConds: p.conds, planSize: p.size }
  assert.equal(M.buildConditions(t).length, p.conds.length); assert.equal(M.estimate(t), p.size)
  const now = Date.now()
  const list = [
    { path: 'D', created: new Date(now - 30 * 60000).toISOString(), metrics: { plansAt: 1, adopted: 'safe', edits: 2 }, delivery: { at: new Date(now).toISOString(), used: true } },
    { path: 'D', created: new Date(now).toISOString(), metrics: { plansAt: 1 } },
    { path: 'B', created: new Date(now).toISOString() },
  ]
  const m = M.docMetrics(list, [{ status: '待承接' }, { status: '生产中' }])
  assert.equal(m.docs, 2); assert.equal(m.adoptRate, 50); assert.equal(m.avgEdits, 2)
  assert.equal(m.leadMin, 30); assert.equal(m.used, 1); assert.equal(m.accepted, 1)
})
