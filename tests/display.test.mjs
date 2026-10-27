import test from 'node:test'
import assert from 'node:assert/strict'
import { noEnumReason, isDelisted, enumJson, assetMetrics } from '../web/src/flows/asset-display.mjs'
import { validateAsset } from '../web/src/flows/asset-model.mjs'

const pub = { id: 14479, name: '电商支付交易单数分层', domain: '电商', cov: 92, enums: ['高消费', '中消费', '低消费', '无支付'] }

test('public fields expose enum examples and metrics as JSON', () => {
  const j = enumJson(pub)
  assert.deepEqual(j.enum_examples, pub.enums)
  assert.equal(j.coverage, '92%'); assert.equal(j.tag_count, 4); assert.match(j.recall, /^\d+%$/)
  assert.equal(assetMetrics(pub).recall, assetMetrics(pub).recall) // 稳定
})
test('sensitive life-service and resident-location fields hide enum values', () => {
  for (const id of [14580, 14606, 14618, 14624]) assert.ok(noEnumReason({ id, name: 'x' }), String(id))
  assert.ok(noEnumReason({ id: 1, name: '常驻 POI（工作）' }))
  assert.ok(noEnumReason({ id: 2, name: '常驻经纬度 hash（居住）' }))
  const j = enumJson({ ...pub, id: 14624, name: '常驻商圈分层' })
  assert.ok(typeof j.enum_examples === 'string' && /不展示/.test(j.enum_examples))
  assert.equal(noEnumReason(pub), '')
})
test('doubao interest fields are delisted and blocked by the machine check', () => {
  assert.ok(isDelisted({ name: '豆包兴趣偏好' })); assert.ok(!isDelisted({ name: '豆包对话次数' })); assert.ok(!isDelisted(pub))
  const row = { source_domain: '其他标签资产', tag_id: 'x_doubao', tag_name: '豆包兴趣偏好', description: '基于豆包对话推断的兴趣偏好，周更', timeliness: '离线', update_freq: '周更', owner: '@zhangsan', source_db: 'ai_profile', source_table: 'dwd_llm_cate_interest_di', source_field: 'cate_interest', security_level: 'L3', unified_level: '通用' }
  assert.ok(validateAsset(row).errors.includes('豆包相关兴趣字段不可上架'))
})
