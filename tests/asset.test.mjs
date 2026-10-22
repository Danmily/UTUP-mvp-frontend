import test from 'node:test'
import assert from 'node:assert/strict'
import { validateAsset, validateImport, effectiveLevel, parseCsv, templateCsv, missingColumns, FIELDS, autoTagId, needsTagId } from '../web/src/flows/asset-model.mjs'

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
test('table security is required; machine check passing goes straight online; legacy statuses are mapped', async () => {
  const { statusAfterSubmit, completeness, normalizeStatus } = await import('../web/src/flows/asset-model.mjs')
  const r = validateAsset({ ...ok, table_security: '' })
  assert.ok(r.errors.some((e) => /表密级必填/.test(e)))
  assert.equal(statusAfterSubmit(ok), 'online')
  assert.equal(completeness(ok), 100); assert.ok(completeness({ ...ok, description: '', table_security: '' }) < 100)
  assert.equal(normalizeStatus('pending'), 'online'); assert.equal(normalizeStatus('uploaded'), 'online'); assert.equal(normalizeStatus('grading'), 'draft')
})
test('existing tag_id: own asset is an update, someone else\'s asset is a conflict', () => {
  const mine = validateAsset(ok, { existing: [ok.tag_id], ownerOf: { [ok.tag_id]: ok.owner } })
  assert.equal(mine.action, 'update'); assert.equal(mine.errors.length, 0)
  const theirs = validateAsset(ok, { existing: [ok.tag_id], ownerOf: { [ok.tag_id]: '@someone' } })
  assert.ok(theirs.errors.some((e) => /属于他人资产/.test(e)))
})
test('template carries 必填 / 条件必填 / 选填 rows that the importer skips', async () => {
  const { needOf } = await import('../web/src/flows/asset-model.mjs')
  const csv = templateCsv()
  assert.match(csv.split('\n')[1], /^#填写要求：条件必填/) // 首列 tag_id 现在是条件必填
  assert.match(csv, /条件必填/); assert.match(csv, /选填/)
  const { records } = parseCsv(csv)
  assert.ok(records.every((r) => !String(r.tag_id).startsWith('#')))
  assert.equal(needOf(FIELDS.find((f) => f.key === 'tag_id')), '条件必填')
  assert.equal(needOf(FIELDS.find((f) => f.key === 'update_freq')), '条件必填')
  assert.equal(needOf(FIELDS.find((f) => f.key === 'column_security_level')), '选填')
})
test('owner team is optional and 所属域 is the required domain field', () => {
  assert.equal(validateAsset({ ...ok, owner_team: '' }).errors.length, 0)
  assert.match(validateAsset({ ...ok, source_system: '' }).errors.join(), /所属域必填/)
})

test('tag_id is required for DMP sources and generated for the others', () => {
  /* 电商 DMP / 生服 LDMP：平台上已有 tag_id，必须带上 */
  assert.ok(needsTagId('电商DMP') && needsTagId('生服LDMP'))
  assert.match(validateAsset({ ...ok, tag_id: '' }).errors.join(), /必须填写标签 ID/)
  assert.match(validateAsset({ ...ok, tag_id: '', source_system: '生服LDMP', source_table: 'life_ldmp.dws_life_visit_freq_df', source_field: 'visit_level' }).errors.join(), /必须填写标签 ID/)
  /* 其他来源：留空由平台按来源表与字段生成 */
  const gen = validateAsset({ ...ok, tag_id: '', source_system: 'AI用户画像', source_table: 'ai_profile.dwd_llm_cate_interest_di', source_field: 'cate_interest' })
  assert.deepEqual(gen.errors, [])
  assert.equal(gen.asset.tag_id, 'dwd_llm_cate_interest_di_cate_interest')
  assert.ok(gen.notes.some((n) => /已按来源表与字段生成/.test(n)))
  /* 生成的 ID 与已有冲突时加序号；同一批内也不重复 */
  assert.equal(autoTagId('ai_profile.t', 'f', ['t_f']), 't_f_2')
  const rows = validateImport([
    { ...ok, tag_id: '', source_system: 'AI用户画像', source_table: 'ai_profile.dwd_llm_cate_interest_di', source_field: 'cate_interest' },
    { ...ok, tag_id: '', tag_name: '另一个', source_system: 'AI用户画像', source_table: 'ai_profile.dwd_llm_cate_interest_di', source_field: 'cate_interest' },
  ], [])
  assert.notEqual(rows[0].asset.tag_id, rows[1].asset.tag_id)
  assert.ok(rows.every((r) => r.errors.length === 0))
  /* 没有来源表时无从生成，仍然报错 */
  assert.match(validateAsset({ ...ok, tag_id: '', source_system: 'AI用户画像', source_table: '', source_field: '' }).errors.join(), /需要来源表与来源字段/)
})
