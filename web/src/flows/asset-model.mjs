/* 资产接入模型（对应 docs/门户V2功能说明.md 3.2）：字段、联动规则、批量导入校验。纯函数，便于测试 */
export const SECURITY = ['开放', '通用', '受控', '高敏'] // 从低到高
/* 填写要求：必填 / 条件必填（满足条件时必填）/ 选填 */
export const needOf = (f) => (f.required ? '必填' : ['update_freq', 'tag_id'].includes(f.key) ? '条件必填' : '选填')
export const needNote = (f) => (f.key === 'update_freq' ? '离线（timeliness=1）时必填；实时自动为「实时」'
  : f.key === 'tag_id' ? `接入 ${TAG_ID_SOURCES.join(' / ')} 的资产必填，须与平台上的 tag_id 一致；其他来源留空由平台生成`
  : '')
export const SOURCES = ['电商DMP', '生服LDMP', 'AI用户画像', '双域算法资产']
/* tag_id 的归属：电商 DMP / 生服 LDMP 的标签在各自平台上已经有 tag_id，接入时必须带上并保持一致，
 * 否则两边对不上；其余资产（AI 画像、双域算法）本质是表字段，没有 tag_id，由平台按来源表与字段生成。 */
export const TAG_ID_SOURCES = ['电商DMP', '生服LDMP']
export const needsTagId = (source) => TAG_ID_SOURCES.includes(String(source || '').trim())
export const FREQ_OFFLINE = ['T+1', 'T+7']
/* 资产状态（PRD 三 v1.1）：草稿 → 提交后平台机审，通过即已上线 → 已下线。一期不设人工审核与分级环节 */
export const STATUS_LABEL = { draft: '草稿', online: '已上线', off: '已下线' }
/* 兼容旧版本地数据：待分级视为草稿，已上传 / 待审核视为已上线 */
export const normalizeStatus = (s) => (s === 'grading' ? 'draft' : s === 'pending' || s === 'uploaded' ? 'online' : s)
export const statusAfterSubmit = () => 'online'
export const MAX_ROWS = 500

/* 导入模板列，顺序即模板列顺序；effective_column_level 由系统计算，不在模板中 */
export const FIELDS = [
  { key: 'tag_id', label: '标签 ID', group: '基础展示', required: false, column: true, hint: '全平台唯一，字母 / 数字 / 下划线；电商DMP / 生服LDMP 必填且与平台一致，其他来源可留空由平台生成', example: 'age_seq_v3' },
  { key: 'tag_name', label: '标签中文名', group: '基础展示', required: true, hint: '≤ 50 字', example: '近30日下单序列' },
  { key: 'description', label: '业务口径描述', group: '基础展示', required: true, hint: '业务含义与加工逻辑，≥ 10 字', example: '近 30 天用户下单的类目序列，按下单时间倒序，T+1 更新' },
  { key: 'coverage', label: '覆盖率', group: '基础展示', required: true, hint: '0–100，最多 1 位小数，可带 %', example: '82.4' },
  { key: 'timeliness', label: '时效类型', group: '基础展示', required: true, hint: '1 = 离线，2 = 实时', example: '1' },
  { key: 'update_freq', label: '更新频率', group: '基础展示', required: false, hint: '离线必填 T+1 / T+7；实时自动为「实时」', example: 'T+1' },
  { key: 'owner', label: 'Owner（个人）', group: '表单归属', required: true, hint: '飞书账号，如 @zhangsan', example: '@zhangsan' },
  { key: 'owner_team', label: 'Owner Team', group: '表单归属', required: false, hint: '可不填', example: '电商 DMP 团队' },
  { key: 'source_system', label: '所属域', group: '表单归属', required: true, hint: SOURCES.join(' / '), example: '电商DMP' },
  { key: 'source_table', label: '来源表', group: '表单归属', required: true, hint: '库名.表名', example: 'ecom_dmp.dwd_user_order_di' },
  { key: 'source_field', label: '来源字段', group: '表单归属', required: true, hint: '来源表中存在的字段', example: 'order_cate_seq' },
  { key: 'table_security', label: '表密级', group: '密级', required: true, hint: '开放/L2 / 通用/L3基础 / 受控/L3高 / 高敏/L4（填写四档简称即可）', example: '受控' },
  { key: 'column_security_level', label: '列密级', group: '密级', required: false, hint: '有单独列密级时填写，否则留空', example: '' },
]

/* 演示用「已知数据」：真实环境改为查询飞书通讯录与元数据服务 */
export const DEMO_OWNERS = ['@zhangsan', '@lisi', '@wangwu', '@zhaoliu', '@dangjiaqi']
export const DEMO_TABLES = {
  'ecom_dmp.dwd_user_order_di': ['order_cate_seq', 'order_cnt_30d', 'pay_amount_30d'],
  'ecom_dmp.dws_ecom_cate_pref_df': ['cate_pref_top10', 'cate_pref_score'],
  'ecom_dmp.dws_ecom_consume_level_df': ['consume_level', 'consume_score'],
  'life_ldmp.dws_life_visit_freq_df': ['visit_cnt_30d', 'visit_level'],
  'life_ldmp.dwd_life_geo_zone_di': ['resident_zone', 'zone_level'],
  'ai_profile.dwd_llm_cate_interest_di': ['cate_interest', 'interest_score'],
  'xd_algo.dwd_xd_consume_fusion_di': ['fusion_score'],
}

/* 元信息完整度：基础展示、表单归属、表密级中已填写的比例（列密级可选，不计入） */
const COMPLETE_KEYS = ['tag_id', 'tag_name', 'description', 'coverage', 'timeliness', 'update_freq', 'owner', 'source_system', 'source_table', 'source_field', 'table_security']
export function completeness(a) { return Math.round((COMPLETE_KEYS.filter((k) => String(a[k] ?? '').trim()).length / COMPLETE_KEYS.length) * 100) }
export function effectiveLevel(table, column) {
  const t = SECURITY.indexOf(table), c = SECURITY.indexOf(column)
  if (t < 0) return ''
  return SECURITY[Math.max(t, c)]
}
export function freqFor(timeliness, freq) { return String(timeliness) === '2' ? '实时' : freq }
export function freqText(a) { return String(a.timeliness) === '2' ? '实时' : `离线 · ${a.update_freq}` }

/* 简单 CSV 解析：支持引号包裹与引号转义，去掉 Excel 导出的 BOM */
export function parseCsv(text) {
  const rows = [], src = String(text || '').replace(/^﻿/, '')
  let row = [], cell = '', quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((c) => c.trim())) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim())) rows.push(row)
  if (!rows.length) return { header: [], records: [] }
  const header = rows[0].map((h) => h.trim())
  /* 以 # 开头的行是模板里的说明行（填写要求、字段说明），解析时跳过 */
  const records = rows.slice(1).filter((r) => !String(r[0] ?? '').trim().startsWith('#')).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
  return { header, records }
}
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''))
export function toCsv(rows, keys) { return [keys.join(','), ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(','))].join('\n') }
export function templateCsv() {
  const keys = FIELDS.map((f) => f.key)
  const sample = Object.fromEntries(FIELDS.map((f) => [f.key, f.example]))
  const noId = { ...sample, tag_id: '', tag_name: 'AI 品类兴趣侧写', description: '基于大模型侧写输出的品类兴趣，T+7 更新', coverage: '64', timeliness: '1', update_freq: 'T+7', owner: '@wangwu', owner_team: 'AI 画像团队', source_system: 'AI用户画像', source_table: 'ai_profile.dwd_llm_cate_interest_di', source_field: 'cate_interest', table_security: '通用', column_security_level: '' }
  const realtime = { ...sample, tag_id: 'live_watch_rt', tag_name: '直播实时观看状态', description: '用户当前是否在直播间观看，秒级更新，用于实时触达', coverage: '35', timeliness: '2', update_freq: '', source_table: 'ecom_dmp.dwd_user_order_di', source_field: 'order_cnt_30d', table_security: '通用', column_security_level: '受控' }
  const need = Object.fromEntries(FIELDS.map((f, i) => [f.key, (i === 0 ? '#填写要求：' : '') + needOf(f)]))
  const hint = Object.fromEntries(FIELDS.map((f, i) => [f.key, (i === 0 ? '#说明：' : '') + [f.label, f.hint, f.hint.includes('必填') ? '' : needNote(f)].filter(Boolean).join('；')]))
  return toCsv([need, hint, sample, realtime, noId], keys)
}

/* 非 DMP 来源留空时按「表名_字段名」生成 tag_id，与已有 ID 冲突时加序号 */
export function autoTagId(sourceTable, sourceField, taken = []) {
  const table = String(sourceTable || '').split('.').pop() || 'asset'
  const base = `${table}_${String(sourceField || 'value')}`.replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').toLowerCase()
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base}_${n}`)) n++
  return `${base}_${n}`
}

/* 单行校验：返回规范化后的资产、错误与提示。existing = 平台已有 tag_id；dupIds = 文件内重复的 tag_id；
 * ownerOf = 已有资产的 Owner（tag_id → owner），用于区分「本人资产按更新处理」与「他人资产冲突」 */
export function validateAsset(input, { existing = [], dupIds = [], taken = [], ownerOf = {} } = {}) {
  const errors = [], notes = []
  const a = Object.fromEntries(FIELDS.map((f) => [f.key, String(input[f.key] ?? '').trim()]))
  for (const f of FIELDS) if (f.required && !a[f.key]) errors.push(`${f.label}必填`)
  if (a.tag_id && !/^[A-Za-z0-9_]+$/.test(a.tag_id)) errors.push('标签 ID 只能包含字母、数字、下划线')
  if (a.tag_id && dupIds.includes(a.tag_id)) errors.push('文件内标签 ID 重复')
  /* tag_id：DMP 来源必填且与平台一致；其他来源留空由平台生成 */
  if (!a.tag_id) {
    if (needsTagId(a.source_system)) errors.push(`接入 ${TAG_ID_SOURCES.join(' / ')} 的资产必须填写标签 ID，并与平台上的 tag_id 一致`)
    else if (a.source_table && a.source_field) {
      a.tag_id = autoTagId(a.source_table, a.source_field, [...existing, ...taken])
      notes.push(`未填写标签 ID，已按来源表与字段生成：${a.tag_id}`)
    } else errors.push('未填写标签 ID 时，需要来源表与来源字段用于生成')
  }
  if (a.tag_name.length > 50) errors.push('标签中文名超过 50 字')
  if (a.description && a.description.length < 10) errors.push('业务口径描述至少 10 字')
  if (a.coverage) {
    const n = Number(a.coverage.replace('%', ''))
    if (!Number.isFinite(n) || n < 0 || n > 100 || !/^\d+(\.\d)?%?$/.test(a.coverage)) errors.push('覆盖率需为 0–100，最多 1 位小数')
    else a.coverage = String(n)
  }
  if (a.timeliness && !['1', '2'].includes(a.timeliness)) errors.push('时效类型只能是 1（离线）或 2（实时）')
  if (a.timeliness === '1') {
    if (!FREQ_OFFLINE.includes(a.update_freq)) errors.push('离线标签的更新频率必须为 T+1 或 T+7')
  } else if (a.timeliness === '2') {
    if (a.update_freq && a.update_freq !== '实时') notes.push(`实时标签的更新频率已自动设为「实时」（原填写：${a.update_freq}）`)
    a.update_freq = '实时'
  }
  if (a.owner && !/^@[A-Za-z][\w.-]*$/.test(a.owner)) errors.push('Owner 需为飞书账号格式，如 @zhangsan')
  else if (a.owner && !DEMO_OWNERS.includes(a.owner)) errors.push(`Owner ${a.owner} 不是有效账号`)
  if (a.source_system && !SOURCES.includes(a.source_system)) errors.push(`所属域需为：${SOURCES.join(' / ')}`)
  if (a.source_table && !/^\w+\.\w+$/.test(a.source_table)) errors.push('来源表需为「库名.表名」格式')
  else if (a.source_table && !DEMO_TABLES[a.source_table]) errors.push(`来源表 ${a.source_table} 不存在`)
  else if (a.source_table && a.source_field && !DEMO_TABLES[a.source_table].includes(a.source_field)) errors.push(`来源表中没有字段 ${a.source_field}`)
  if (a.table_security && !SECURITY.includes(a.table_security)) errors.push(`表密级需为：${SECURITY.join(' / ')}`)
  if (a.column_security_level && !SECURITY.includes(a.column_security_level)) errors.push(`列密级需为：${SECURITY.join(' / ')} 或留空`)
  if (input.effective_column_level) notes.push('最终生效密级由系统计算，已忽略文件中的填写值')
  a.effective_column_level = effectiveLevel(a.table_security, a.column_security_level)
  if (a.column_security_level && a.effective_column_level !== a.table_security) notes.push(`列密级高于表密级，最终生效密级升为「${a.effective_column_level}」`)
  const action = existing.includes(a.tag_id) ? 'update' : 'create'
  if (action === 'update' && ownerOf[a.tag_id] && a.owner && ownerOf[a.tag_id] !== a.owner) errors.push(`标签 ID 属于他人资产（Owner ${ownerOf[a.tag_id]}），不能覆盖；如需新建，请换一个标签 ID`)
  return { asset: a, errors, notes, action }
}

export function validateImport(records, existing, ownerOf = {}) {
  const count = {}
  records.forEach((r) => { const id = String(r.tag_id || '').trim(); if (id) count[id] = (count[id] || 0) + 1 })
  const dupIds = Object.keys(count).filter((k) => count[k] > 1)
  const taken = [] // 本批内已占用（含自动生成）的 ID，避免同批重复
  return records.slice(0, MAX_ROWS).map((r, i) => {
    const res = validateAsset(r, { existing, dupIds, taken, ownerOf })
    if (res.asset.tag_id) taken.push(res.asset.tag_id)
    return { line: i + 2, ...res }
  })
}
export function missingColumns(header) {
  /* tag_id 不再强制填写，但列必须保留：DMP 来源要靠它对齐平台上的标签 */
  return FIELDS.filter((f) => (f.required || f.column) && !header.includes(f.key)).map((f) => f.key)
}
