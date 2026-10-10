import test from 'node:test'
import assert from 'node:assert/strict'
import { validateAsset, validateImport, effectiveLevel, parseCsv, templateCsv, missingColumns, FIELDS } from '../web/src/flows/asset-model.mjs'

const ok = { tag_id: 'order_seq_30d', tag_name: '近30日下单序列', description: '近 30 天用户下单的类目序列，T+1 更新', coverage: '82.4%', timeliness: '1', update_freq: 'T+1', owner: '@zhangsan', owner_team: '电商 DMP 团队', source_system: '电商DMP', source_table: 'ecom_dmp.dwd_user_order_di', source_field: 'order_cate_seq', table_security: '受控', column_security_level: '' }

test('a complete row passes and is a create when the id is new', () => {
  const r = validateAsset(ok, { existing: [] })
  assert.deepEqual(r.errors, []); assert.equal(r.action, 'create'); assert.equal(r.asset.coverage, '82.4')
  assert.equal(validateAsset(ok, { existing: ['order_seq_30d'] }).action, 'update')
})
test('realtime forces 实时 frequency; offline needs T+1 or T+7', () => {
  const rt = validateAsset({ ...ok, timeliness: '2', update_freq: 'T+7' })
  assert.equal(rt.asset.update_freq, '实时'); assert.equal(rt.errors.length, 0); assert.ok(rt.notes.length)
  assert.match(validateAsset({ ...ok, update_freq: '' }).errors.join(), /T\+1 或 T\+7/)
  assert.match(validateAsset({ ...ok, update_freq: '实时' }).errors.join(), /T\+1 或 T\+7/)
})
test('effective level is the higher of table and column security; uploaded value is ignored', () => {
  assert.equal(effectiveLevel('通用', '高敏'), '高敏'); assert.equal(effectiveLevel('受控', ''), '受控'); assert.equal(effectiveLevel('高敏', '开放'), '高敏')
  const r = validateAsset({ ...ok, table_security: '通用', column_security_level: '受控', effective_column_level: '开放' })
  assert.equal(r.asset.effective_column_level, '受控'); assert.ok(r.notes.some((n) => /忽略/.test(n)))
})
test('format, existence and enum checks report errors', () => {
  const e = validateAsset({ ...ok, tag_id: 'bad id', coverage: '120', owner: '@nobody', source_field: 'nope', table_security: '机密' }).errors.join('|')
  for (const k of ['字母、数字、下划线', '覆盖率', '@nobody', 'nope', '表密级']) assert.ok(e.includes(k), k)
})
test('duplicate ids inside one file mark both rows as errors', () => {
  const rows = validateImport([ok, { ...ok, tag_name: '重复' }], [])
  assert.ok(rows.every((r) => r.errors.some((x) => /重复/.test(x))))
})
test('template round-trips through the CSV parser with all columns', () => {
  const { header, records } = parseCsv(templateCsv())
  assert.deepEqual(header, FIELDS.map((f) => f.key)); assert.equal(missingColumns(header).length, 0)
  assert.ok(records.every((r) => validateAsset(r).errors.length === 0))
})
test('missing table security is allowed and routes to 待分级; completeness counts filled fields', async () => {
  const { statusAfterSubmit, completeness, normalizeStatus } = await import('../web/src/flows/asset-model.mjs')
  const r = validateAsset({ ...ok, table_security: '' })
  assert.equal(r.errors.length, 0); assert.ok(r.notes.some((n) => /待分级/.test(n)))
  assert.equal(statusAfterSubmit(r.asset), 'grading'); assert.equal(statusAfterSubmit(ok), 'uploaded')
  assert.equal(completeness(ok), 100); assert.ok(completeness({ ...ok, description: '', table_security: '' }) < 100)
  assert.equal(normalizeStatus('pending'), 'uploaded')
})
test('template carries 必填 / 条件必填 / 选填 rows that the importer skips', async () => {
  const { needOf } = await import('../web/src/flows/asset-model.mjs')
  const csv = templateCsv()
  assert.match(csv.split('\n')[1], /^#填写要求：必填/)
  assert.match(csv, /条件必填/); assert.match(csv, /选填/)
  const { records } = parseCsv(csv)
  assert.ok(records.every((r) => !String(r.tag_id).startsWith('#')))
  assert.equal(needOf(FIELDS.find((f) => f.key === 'tag_id')), '必填')
  assert.equal(needOf(FIELDS.find((f) => f.key === 'update_freq')), '条件必填')
  assert.equal(needOf(FIELDS.find((f) => f.key === 'column_security_level')), '选填')
})
