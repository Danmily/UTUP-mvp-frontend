import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateAsset, validateImport, parseCsv, templateCsv, missingColumns, FIELDS, autoTagId, needsTagId, needOf,
  statusAfterSubmit, completeness, normalizeStatus, levelMatches,
} from '../web/src/flows/asset-model.mjs'

const ok = { source_domain: 'DMP', tag_id: 'tag_14595', tag_name: '近30日下单序列', description: '近 30 天用户下单的类目序列，T+1 更新', timeliness: '离线', update_freq: 'T+1', coverage: '82.4%', owner: '@zhangsan', source_db: 'ecom_dmp', source_table: 'dwd_user_order_di', source_field: 'order_cate_seq', security_level: 'L3', unified_level: '受控', official_mark: '官方', usage_limit: '', remark: '' }

test('a complete row passes and is a create when the id is new', () => {
  const r = validateAsset(ok, { existing: [] })
  assert.deepEqual(r.errors, []); assert.equal(r.action, 'create'); assert.equal(r.asset.coverage, '82.4')
  assert.equal(validateAsset(ok, { existing: ['tag_14595'] }).action, 'update')
})
test('realtime forces 实时 frequency; offline cannot be 实时; frequency enum per SOP', () => {
  const rt = validateAsset({ ...ok, timeliness: '实时', update_freq: 'T+1' })
  assert.equal(rt.asset.update_freq, '实时'); assert.equal(rt.errors.length, 0); assert.ok(rt.notes.length)
  assert.match(validateAsset({ ...ok, update_freq: '实时' }).errors.join(), /不能为「实时」/)
  assert.match(validateAsset({ ...ok, update_freq: '每天' }).errors.join(), /更新频率需为/)
  for (const f of ['小时', 'T+1', '周更', '月更']) assert.equal(validateAsset({ ...ok, update_freq: f }).errors.length, 0, f)
  assert.equal(validateAsset({ ...ok, timeliness: '1' }).asset.timeliness, '离线') // 兼容旧写法
})
test('security level and unified level must correspond', () => {
  assert.ok(levelMatches('L2', '开放') && levelMatches('L3', '通用') && levelMatches('L3', '受控') && levelMatches('L4', '高敏'))
  assert.match(validateAsset({ ...ok, security_level: 'L4', unified_level: '通用' }).errors.join(), /不对应/)
  assert.equal(validateAsset({ ...ok, unified_level: '受控/L3高' }).asset.unified_level, '受控')
  assert.match(validateAsset({ ...ok, security_level: '' }).errors.join(), /密级必填/)
})
test('format, existence and enum checks report errors', () => {
  const e = validateAsset({ ...ok, tag_id: 'bad id', coverage: '120', owner: '@nobody', source_field: 'nope', security_level: 'L5', official_mark: '是', source_domain: 'XDMP' }).errors.join('|')
  for (const k of ['字母、数字、下划线', '覆盖率', '@nobody', 'nope', '密级需为', '是否官方', '来源域需为']) assert.ok(e.includes(k), k)
  assert.match(validateAsset({ ...ok, source_table: 'nope_table' }).errors.join(), /数据源 ecom_dmp.nope_table 不存在/)
})
test('coverage and the optional fields can be left empty', () => {
  assert.deepEqual(validateAsset({ ...ok, coverage: '', official_mark: '', usage_limit: '', remark: '' }).errors, [])
  assert.equal(needOf(FIELDS.find((f) => f.key === 'coverage')), '选填')
})
test('duplicate ids inside one file mark both rows as errors', () => {
  const rows = validateImport([ok, { ...ok, tag_name: '重复' }], [])
  assert.ok(rows.every((r) => r.errors.some((x) => /重复/.test(x))))
})
test('template round-trips through the CSV parser with all columns', () => {
  const { header, records } = parseCsv(templateCsv())
  assert.deepEqual(header, FIELDS.map((f) => f.key)); assert.equal(missingColumns(header).length, 0)
  assert.ok(records.every((r) => validateAsset(r).errors.length === 0))
  assert.match(templateCsv().split('\n')[1], /^#填写要求：必填/) // 首列来源域必填
})
test('machine check passing goes straight online; legacy statuses are mapped', () => {
  assert.equal(statusAfterSubmit(ok), 'online')
  assert.equal(completeness(ok), 100); assert.ok(completeness({ ...ok, description: '', security_level: '' }) < 100)
  assert.equal(normalizeStatus('pending'), 'online'); assert.equal(normalizeStatus('uploaded'), 'online'); assert.equal(normalizeStatus('grading'), 'draft')
})
test('existing tag_id: own asset is an update, someone else\'s asset is a conflict', () => {
  const mine = validateAsset(ok, { existing: [ok.tag_id], ownerOf: { [ok.tag_id]: ok.owner } })
  assert.equal(mine.action, 'update'); assert.equal(mine.errors.length, 0)
  const theirs = validateAsset(ok, { existing: [ok.tag_id], ownerOf: { [ok.tag_id]: '@someone' } })
  assert.ok(theirs.errors.some((e) => /属于他人资产/.test(e)))
})
test('asset id is required for DMP / LDMP and generated for other assets', () => {
  assert.ok(needsTagId('DMP') && needsTagId('LDMP') && !needsTagId('其他标签资产'))
  assert.match(validateAsset({ ...ok, tag_id: '' }).errors.join(), /必须填写资产 ID/)
  const other = { ...ok, source_domain: '其他标签资产', tag_id: '', source_db: 'ai_profile', source_table: 'dwd_llm_cate_interest_di', source_field: 'cate_interest', security_level: 'L3', unified_level: '通用' }
  const gen = validateAsset(other)
  assert.deepEqual(gen.errors, [])
  assert.equal(gen.asset.tag_id, 'dwd_llm_cate_interest_di_cate_interest')
  assert.equal(autoTagId('t', 'f', ['t_f']), 't_f_2')
  const rows = validateImport([other, { ...other, tag_name: '另一个' }], [])
  assert.notEqual(rows[0].asset.tag_id, rows[1].asset.tag_id)
  assert.ok(rows.every((r) => r.errors.length === 0))
})
