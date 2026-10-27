/* 资产管理模型（对应 PRD 三「供给方版本更新 v1.1」与资产接入 SOP「二、字段填写规则」）：字段、联动规则、机审校验。纯函数，便于测试 */
export const SECURITY = ['开放', '通用', '受控', '高敏'] // 统一级别，从低到高
export const SECURITY_LEVELS = ['L1', 'L2', 'L3', 'L4'] // 公司数据密级，对齐 DataSecurity-202
/* 统一级别与密级的对应：开放→L2、通用→L3基础、受控→L3高、高敏→L4（L1 按开放处理） */
export const LEVEL_MATCH = { L1: ['开放'], L2: ['开放'], L3: ['通用', '受控'], L4: ['高敏'] }
export const DOMAINS = ['DMP', 'LDMP', '其他标签资产']
/* 资产 ID：来源域为 DMP / LDMP 时必填且与原系统一致；其他标签资产没有原系统 ID，留空由平台按源表与源字段生成 */
export const TAG_ID_DOMAINS = ['DMP', 'LDMP']
export const needsTagId = (domain) => TAG_ID_DOMAINS.includes(String(domain || '').trim())
export const TIMELINESS = ['离线', '实时']
export const FREQS = ['实时', '小时', 'T+1', '周更', '月更']
export const OFFICIAL = ['官方', '非官方']
/* 填写要求：必填 / 条件必填（满足条件时必填）/ 选填 */
export const needOf = (f) => (f.required ? '必填' : f.key === 'tag_id' ? '条件必填' : '选填')
export const needNote = (f) => (f.key === 'tag_id' ? `来源域为 ${TAG_ID_DOMAINS.join(' / ')} 时必填，须与原系统 ID 一致；其他标签资产留空由平台生成` : '')
/* 资产状态（PRD 三 v1.1）：草稿 → 提交后平台机审，通过即已上线 → 已下线。一期不设人工审核与分级环节 */
export const STATUS_LABEL = { draft: '草稿', online: '已上线', off: '已下线' }
/* 兼容旧版本地数据：待分级视为草稿，已上传 / 待审核视为已上线 */
export const normalizeStatus = (s) => (s === 'grading' ? 'draft' : s === 'pending' || s === 'uploaded' ? 'online' : s)
export const statusAfterSubmit = () => 'online'
export const MAX_ROWS = 500
/* 资产数据在浏览器中的存储键；标签广场、我的申请读取其中的下线记录做提醒 */
export const ASSET_KEY = 'utup.assets.v2'

/* 导入模板列，顺序即模板列顺序（与 SOP「门户上传资产格式文档信息」一致）；group 为单个录入表单分组 */
export const FIELDS = [
  { key: 'source_domain', label: '来源域', group: '基础信息', required: true, hint: DOMAINS.join(' / ') + '，按枚举选择，不自行新增值', example: 'DMP' },
  { key: 'tag_id', label: '资产 ID', group: '基础信息', required: false, column: true, hint: '原系统标签唯一 ID，字母 / 数字 / 下划线', example: 'tag_14587' },
  { key: 'tag_name', label: '标签名称', group: '基础信息', required: true, hint: '标签中文名称，≤ 50 字', example: '消费力预测' },
  { key: 'description', label: '业务口径描述', group: '基础信息', required: true, hint: '至少写清业务含义、枚举或单位、加工逻辑、适用场景和使用限制，≥ 10 字', example: '按近 90 天支付金额预测的消费力分层，T+1 更新，适用于人群圈选' },
  { key: 'timeliness', label: '时效性', group: '基础信息', required: true, hint: TIMELINESS.join(' / '), example: '离线' },
  { key: 'update_freq', label: '更新频率', group: '基础信息', required: true, hint: FREQS.join(' / ') + '；实时资产固定为「实时」', example: 'T+1' },
  { key: 'coverage', label: '覆盖率', group: '基础信息', required: false, hint: '0–100，最多 1 位小数，可带 %；暂无可留空', example: '68' },
  { key: 'owner', label: '资产 Owner', group: '来源与归属', required: true, hint: '员工账号，如 @zhangsan，负责业务口径和后续维护', example: '@zhangsan' },
  { key: 'source_db', label: '源库', group: '来源与归属', required: true, hint: '上游数据库名，不填中文别名', example: 'ecom_dmp' },
  { key: 'source_table', label: '源表', group: '来源与归属', required: true, hint: '上游表名，与源库、源字段共同定位数据源', example: 'dwd_user_order_di' },
  { key: 'source_field', label: '源字段', group: '来源与归属', required: true, hint: '源表中存在的字段', example: 'order_cate_seq' },
  { key: 'security_level', label: '密级', group: '密级与分级', required: true, hint: SECURITY_LEVELS.join(' / ') + '，对齐 DataSecurity-202', example: 'L3' },
  { key: 'unified_level', label: '统一级别', group: '密级与分级', required: true, hint: '开放/L2、通用/L3基础、受控/L3高、高敏/L4，与密级对应（填写简称即可）', example: '受控' },
  { key: 'official_mark', label: '是否官方', group: '选填信息', required: false, hint: '官方 / 非官方；选「官方」需有可追溯的认证依据', example: '官方' },
  { key: 'usage_limit', label: '使用限制', group: '选填信息', required: false, hint: '标签不能怎么用，如仅支持正向圈选', example: '仅支持正向圈选，不支持排除' },
  { key: 'remark', label: '备注', group: '选填信息', required: false, hint: '其他补充说明，不参与校验', example: '' },
]
export const FORM_GROUPS = ['基础信息', '来源与归属', '密级与分级', '选填信息']

/* 演示用「已知数据」：真实环境改为查询飞书通讯录与元数据服务 */
export const DEMO_ME = '@zhangsan' // 演示中的当前供给方
export const DEMO_OWNERS = ['@zhangsan', '@lisi', '@wangwu', '@zhaoliu']
export const DEMO_OFFICERS = ['@hegui_wang', '@hegui_li', '@hegui_zhao'] // 合规确认人（员工选择器的演示名单）
export const DEMO_TABLES = {
  'ecom_dmp.dwd_user_order_di': ['order_cate_seq', 'order_cnt_30d', 'pay_amount_30d'],
  'ecom_dmp.dws_ecom_cate_pref_df': ['cate_pref_top10', 'cate_pref_score'],
  'ecom_dmp.dws_ecom_consume_level_df': ['consume_level', 'consume_score'],
  'life_ldmp.dws_life_visit_freq_df': ['visit_cnt_30d', 'visit_level'],
  'life_ldmp.dwd_life_geo_zone_di': ['resident_zone', 'zone_level'],
  'ai_profile.dwd_llm_cate_interest_di': ['cate_interest', 'interest_score'],
  'xd_algo.dwd_xd_consume_fusion_di': ['fusion_score'],
}

/* 元信息完整度：必填字段与覆盖率中已填写的比例 */
const COMPLETE_KEYS = FIELDS.filter((f) => f.required || ['tag_id', 'coverage'].includes(f.key)).map((f) => f.key)
export function completeness(a) { return Math.round((COMPLETE_KEYS.filter((k) => String(a[k] ?? '').trim()).length / COMPLETE_KEYS.length) * 100) }
/* 统一级别允许写全称（如「受控/L3高」），统一存简称 */
export const normLevel = (v) => String(v || '').trim().split('/')[0]
export const levelMatches = (security, unified) => (LEVEL_MATCH[security] || []).includes(unified)
export function freqText(a) { return a.timeliness === '实时' ? '实时' : `${a.timeliness || '—'} · ${a.update_freq || '—'}` }
export const sourceText = (a) => `${a.source_domain || '—'} · ${a.source_db || '—'}.${a.source_table || '—'}.${a.source_field || '—'}`

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
  const realtime = { ...sample, tag_id: 'tag_14590', tag_name: '直播实时观看状态', description: '用户当前是否在直播间观看，秒级更新，用于实时触达', timeliness: '实时', update_freq: '实时', coverage: '35', source_field: 'order_cnt_30d', security_level: 'L3', unified_level: '通用', official_mark: '', usage_limit: '' }
  const noId = { ...sample, source_domain: '其他标签资产', tag_id: '', tag_name: 'AI 品类兴趣侧写', description: '基于大模型侧写输出的品类兴趣，周更', update_freq: '周更', coverage: '', owner: '@wangwu', source_db: 'ai_profile', source_table: 'dwd_llm_cate_interest_di', source_field: 'cate_interest', security_level: 'L3', unified_level: '通用', official_mark: '非官方', usage_limit: '' }
  const need = Object.fromEntries(FIELDS.map((f, i) => [f.key, (i === 0 ? '#填写要求：' : '') + needOf(f)]))
  const hint = Object.fromEntries(FIELDS.map((f, i) => [f.key, (i === 0 ? '#说明：' : '') + [f.label, f.hint, needNote(f)].filter(Boolean).join('；')]))
  return toCsv([need, hint, sample, realtime, noId], keys)
}

/* 其他标签资产留空时按「表名_字段名」生成 tag_id，与已有 ID 冲突时加序号 */
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
  /* 兼容 1 / 2 写法与统一级别全称 */
  if (a.timeliness === '1') a.timeliness = '离线'
  if (a.timeliness === '2') a.timeliness = '实时'
  a.unified_level = normLevel(a.unified_level)
  if (a.timeliness === '实时' && a.update_freq !== '实时') {
    if (a.update_freq) notes.push(`实时资产的更新频率已自动设为「实时」（原填写：${a.update_freq}）`)
    a.update_freq = '实时'
  }
  for (const f of FIELDS) if (f.required && !a[f.key]) errors.push(`${f.label}必填`)
  if (a.source_domain && !DOMAINS.includes(a.source_domain)) errors.push(`来源域需为：${DOMAINS.join(' / ')}`)
  if (a.tag_id && !/^[A-Za-z0-9_]+$/.test(a.tag_id)) errors.push('资产 ID 只能包含字母、数字、下划线')
  if (a.tag_id && dupIds.includes(a.tag_id)) errors.push('文件内资产 ID 重复')
  if (!a.tag_id) {
    if (needsTagId(a.source_domain)) errors.push(`来源域为 ${TAG_ID_DOMAINS.join(' / ')} 时必须填写资产 ID，并与原系统一致`)
    else if (a.source_domain && a.source_table && a.source_field) {
      a.tag_id = autoTagId(a.source_table, a.source_field, [...existing, ...taken])
      notes.push(`未填写资产 ID，已按源表与源字段生成：${a.tag_id}`)
    } else if (a.source_domain) errors.push('未填写资产 ID 时，需要源表与源字段用于生成')
  }
  if (a.tag_name.length > 50) errors.push('标签名称超过 50 字')
  if (a.description && a.description.length < 10) errors.push('业务口径描述至少 10 字')
  if (a.timeliness && !TIMELINESS.includes(a.timeliness)) errors.push(`时效性需为：${TIMELINESS.join(' / ')}`)
  if (a.update_freq && !FREQS.includes(a.update_freq)) errors.push(`更新频率需为：${FREQS.join(' / ')}`)
  else if (a.timeliness === '离线' && a.update_freq === '实时') errors.push('离线资产的更新频率不能为「实时」')
  if (a.coverage) {
    const n = Number(a.coverage.replace('%', ''))
    if (!Number.isFinite(n) || n < 0 || n > 100 || !/^\d+(\.\d)?%?$/.test(a.coverage)) errors.push('覆盖率需为 0–100，最多 1 位小数')
    else a.coverage = String(n)
  }
  if (a.owner && !/^@[A-Za-z][\w.-]*$/.test(a.owner)) errors.push('资产 Owner 需为员工账号格式，如 @zhangsan')
  else if (a.owner && !DEMO_OWNERS.includes(a.owner)) errors.push(`资产 Owner ${a.owner} 不是有效账号`)
  const bad = (v) => v && !/^\w+$/.test(v)
  if (bad(a.source_db)) errors.push('源库只能填写库名（字母、数字、下划线）')
  else if (bad(a.source_table)) errors.push('源表只能填写表名（字母、数字、下划线）')
  else if (a.source_db && a.source_table) {
    const key = `${a.source_db}.${a.source_table}`
    if (!DEMO_TABLES[key]) errors.push(`数据源 ${key} 不存在`)
    else if (a.source_field && !DEMO_TABLES[key].includes(a.source_field)) errors.push(`源表中没有字段 ${a.source_field}`)
  }
  if (a.security_level && !SECURITY_LEVELS.includes(a.security_level)) errors.push(`密级需为：${SECURITY_LEVELS.join(' / ')}`)
  if (a.unified_level && !SECURITY.includes(a.unified_level)) errors.push('统一级别需为：开放 / 通用 / 受控 / 高敏')
  else if (SECURITY_LEVELS.includes(a.security_level) && a.unified_level && !levelMatches(a.security_level, a.unified_level)) errors.push(`统一级别「${a.unified_level}」与密级 ${a.security_level} 不对应（L2→开放，L3→通用 / 受控，L4→高敏）`)
  if (a.official_mark && !OFFICIAL.includes(a.official_mark)) errors.push('是否官方需为：官方 / 非官方')
  /* 1026 会议：豆包相关兴趣字段不可上架 */
  if (/豆包/.test(`${a.tag_name} ${a.description}`) && /兴趣/.test(`${a.tag_name} ${a.description}`)) errors.push('豆包相关兴趣字段不可上架')
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
  /* 资产 ID 不强制填写，但列必须保留：DMP / LDMP 要靠它对齐原系统标签 */
  return FIELDS.filter((f) => (f.required || f.column) && !header.includes(f.key)).map((f) => f.key)
}
