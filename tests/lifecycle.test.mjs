import test from 'node:test'
import assert from 'node:assert/strict'
import {
  startChange, changeState, applyDue, addFeedback, nextVersion, consumersOf, periodsOf, benefitRows, boardSummary, pendingReports, ME_CONSUMER,
} from '../web/src/flows/lifecycle-model.mjs'

const DAY = 864e5, now = Date.parse('2026-11-02T10:00:00Z')
const a = { tag_id: 'tag_14533', tag_name: '活跃天数分层' }

test('version change opens a test window, collects feedback and switches when due', () => {
  assert.equal(nextVersion(a), 'v2'); assert.equal(nextVersion({ version: 'v3' }), 'v4')
  let c = startChange(a, { note: '口径调整', windowDays: 7, now })
  assert.equal(changeState(c, now + 2 * DAY).daysLeft, 5); assert.ok(!changeState(c, now + 2 * DAY).due)
  c = addFeedback(c, { by: '@liwei', verdict: '有问题', text: '分布变化大' })
  c = addFeedback(c, { by: '@liwei', verdict: '验证通过' }) // 同一消费方再次反馈以最新为准
  assert.equal(c.change.feedback.length, 1); assert.equal(changeState(c, now).ok, 1)
  const early = applyDue([c], now + 6 * DAY); assert.equal(early.changed.length, 0)
  const r = applyDue([c, a], now + 7 * DAY)
  assert.deepEqual(r.changed, ['活跃天数分层'])
  assert.equal(r.assets[0].version, 'v2'); assert.equal(r.assets[0].change, null)
  assert.equal(r.assets[0].versions[0].from, 'v1'); assert.equal(r.assets[1], a)
})
test('consumers are stable per field and include the current consumer when they hold it', () => {
  assert.deepEqual(consumersOf(14533), consumersOf(14533))
  assert.ok(consumersOf(14533).length >= 2)
  assert.equal(consumersOf(14533, [14533])[0].name, ME_CONSUMER.name)
})
test('periods: monthly report covers last month, quarterly covers last quarter', () => {
  assert.deepEqual(periodsOf(now), { month: '2026-10', quarter: '2026 Q3' })
  assert.deepEqual(periodsOf(Date.parse('2026-01-05T00:00:00Z')), { month: '2025-12', quarter: '2025 Q4' })
})
test('reports from IM Bot are tied to field and consumer and show on the board', () => {
  const p = periodsOf(now)
  assert.equal(pendingReports([14533, 14533], [], now).length, 2)
  const reports = [{ tagId: '14533', consumer: ME_CONSUMER.name, kind: '月度', period: p.month, conclusion: '点击率提升' }]
  assert.equal(pendingReports([14533], reports, now).length, 1)
  const rows = benefitRows(14533, { reports, myTagIds: [14533], now })
  assert.equal(rows[0].month.conclusion, '点击率提升'); assert.deepEqual(rows[0].pending, ['季度'])
  const s = boardSummary(rows)
  assert.equal(s.consumers, rows.length); assert.ok(s.calls > 0 && s.month >= 1)
})
