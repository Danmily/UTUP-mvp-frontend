const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const box = { module: { exports: {} } }
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../web/public/audience/agent.js'), 'utf8'), box)
const M = box.module.exports

const make = (q) => M.newTask(q)

test('query keywords pick the matching scenario, anything else falls back to brand', () => {
  assert.equal(make('召回最近没下单的美妆老客').scene, 'recall')
  assert.equal(make('为火锅门店找到店新客').scene, 'local')
  assert.equal(make('圈出跨域高价值用户').scene, 'cross')
  assert.equal(make('随便找点人').scene, 'brand')
})

test('conditions follow confirmed answers and scope', () => {
  const t = make('给波司登找羽绒服兴趣用户')
  t.answers.window = '近 30 天'
  assert.match(M.buildConditions(t)[0].value, /近 30 天/)
  const wide = M.estimate(t)
  t.scope = 'narrow'
  assert.ok(M.buildConditions(t).some((c) => c.tag === null && /至少 2 次/.test(c.value)))
  assert.ok(M.estimate(t) < wide)
})

test('using other tags swaps or drops restricted tags and never keeps the original', () => {
  const t = make('给波司登找羽绒服兴趣用户')
  for (const id of [14520, 14560]) t.swapped[id] = M.ALT[id]
  const tags = M.buildConditions(t).map((c) => c.tag)
  assert.ok(!tags.includes(14520) && !tags.includes(14560))
  assert.ok(tags.includes(M.ALT[14520]))
})

test('target size caps the estimate and the SQL limit', () => {
  const t = make('召回美妆老客')
  t.target = 5000
  assert.equal(M.estimate(t), 5000)
  assert.match(M.buildSql(t, M.buildConditions(t)), /LIMIT\s+5000;/)
})

test('SQL keeps exclusions as NOT EXISTS and any-of as OR', () => {
  const t = make('给波司登找羽绒服兴趣用户')
  const sql = M.buildSql(t, M.buildConditions(t))
  assert.match(sql, /NOT EXISTS/)
  assert.match(sql, /\n\s+OR /)
})

test('seed parsing dedupes, skips headers and flags invalid ids; expand adds a condition', () => {
  const p = M.parseSeeds('uid\n10001\n10002,10002\nbad id!\n10003')
  assert.equal(p.count, 3); assert.equal(p.dup, 1); assert.equal(p.invalid, 2)
  assert.ok(p.sample.every((x) => x.includes('****')))
  assert.match(M.seedWarning({ ...p, purpose: 'expand' }), /至少 100/)
  assert.equal(M.seedWarning({ ...p, purpose: 'check' }), '')
  const t = M.newTask('召回美妆老客')
  const base = M.buildConditions(t).length
  t.seed = { ...p, purpose: 'check' }; assert.equal(M.buildConditions(t).length, base)
  t.seed = { ...p, purpose: 'expand' }; assert.ok(M.buildConditions(t).some((c) => /种子扩展/.test(c.name)))
})
