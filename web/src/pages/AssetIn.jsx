import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, Modal, Space, Tabs, Tag, message } from '@ecom/aurora'
import { TAGS, nowStamp, levelLabel } from '../data.js'
import { LevelChip } from '../mvp-ui.jsx'
import {
  FIELDS, FORM_GROUPS, SECURITY, SECURITY_LEVELS, DOMAINS, TIMELINESS, FREQS, OFFICIAL, STATUS_LABEL, MAX_ROWS, ASSET_KEY,
  DEMO_ME, DEMO_OWNERS, DEMO_OFFICERS, DEMO_TABLES, TAG_ID_DOMAINS,
  freqText, parseCsv, templateCsv, toCsv, validateAsset, validateImport, missingColumns,
  completeness, normalizeStatus, statusAfterSubmit, needOf, needNote, needsTagId, autoTagId, levelMatches,
} from '../flows/asset-model.mjs'

/* 资产管理（PRD 三「供给方版本更新 v1.1」）：资产接入（单个录入 / 批量导入）、平台机审上线、草稿、更新左右对比、
 * 下线与影响处理、批量下线、导出我的资产、导入记录；演示数据存于浏览器 */
const DB = { 电商DMP: 'ecom_dmp', 生服LDMP: 'life_ldmp', AI用户画像: 'ai_profile', 双域算法资产: 'xd_algo' }
const DOMAIN_OF = { 电商DMP: 'DMP', 生服LDMP: 'LDMP' }
const SECURITY_OF = { 开放: 'L2', 通用: 'L3', 受控: 'L3', 高敏: 'L4' }
const SOP = ['准备', '下载模板', '填写', '合规确认', '上传并机审', '上线']
const STATUS_TABS = [['all', '资产总数'], ['online', '已上线'], ['draft', '草稿'], ['off', '已下线']]
const PAGE = 10
/* 提交前检查清单（PRD 资产接入 · 提交前检查） */
const CHECKLIST = [
  ['tpl', '使用的是当前最新模板，未增删列、未修改表头'],
  ['required', '必填字段均已填写，未用空格代替内容'],
  ['enum', '枚举类字段取自模板给定范围，未自行新增值'],
  ['batch', '已知悉整批口径：一行不合规则本批文件不导入'],
]
const LEVEL_OPTS = SECURITY.map((x) => ({ v: x, l: levelLabel(x) }))

/* 演示目录补齐种子资产引用的数据源，保证编辑已上线资产时能通过机审 */
for (const t of TAGS) { const k = `${DB[t.src] || 'ecom_dmp'}.${t.table}`; if (!DEMO_TABLES[k]) DEMO_TABLES[k] = ['label_value'] }
const seed = () => TAGS.map((t) => ({
  source_domain: DOMAIN_OF[t.src] || '其他标签资产', tag_id: 'tag_' + t.id, tag_name: t.name, description: t.desc,
  timeliness: t.freq === '实时' ? '实时' : '离线', update_freq: t.freq === '实时' ? '实时' : t.freq === 'T+7' ? '周更' : 'T+1', coverage: String(t.cov || ''),
  owner: DEMO_ME, source_db: DB[t.src] || 'ecom_dmp', source_table: t.table, source_field: 'label_value',
  security_level: SECURITY_OF[t.level] || 'L3', unified_level: t.level, official_mark: t.official ? '官方' : '非官方', usage_limit: '', remark: '',
  status: 'online', updated: '2026-09-20 10:00', by: 'system',
})).concat([
  /* 演示：草稿与已下线的资产 */
  { source_domain: 'LDMP', tag_id: 'life_cate_pref_v2', tag_name: '生服品类偏好 V2', description: '基于近 90 天到店核销记录计算的品类偏好，T+1 更新', timeliness: '离线', update_freq: 'T+1', coverage: '71', owner: DEMO_ME, source_db: 'life_ldmp', source_table: 'dws_life_visit_freq_df', source_field: 'visit_level', security_level: '', unified_level: '', status: 'draft', updated: '2026-10-09 15:20', by: DEMO_ME },
  { source_domain: '其他标签资产', tag_id: 'draft_ai_summary', autoDraftId: true, tag_name: 'AI 深层消费心理 Summary', description: '', timeliness: '离线', update_freq: '周更', coverage: '', owner: DEMO_ME, source_db: 'ai_profile', source_table: 'dwd_llm_cate_interest_di', source_field: 'cate_interest', security_level: '', unified_level: '', status: 'draft', updated: '2026-10-09 16:02', by: DEMO_ME },
  { source_domain: 'DMP', tag_id: 'old_active_v1', tag_name: '旧版活跃序列 V1', description: '旧版活跃天数序列，已由活跃天数分层替代', timeliness: '离线', update_freq: 'T+1', coverage: '90', owner: DEMO_ME, source_db: 'ecom_dmp', source_table: 'dwd_user_order_di', source_field: 'order_cnt_30d', security_level: 'L3', unified_level: '受控', status: 'off', offReason: '已由新版标签替代', offAt: '2026-09-30', updated: '2026-09-30 18:00', by: DEMO_ME },
])
function load() { try { const v = JSON.parse(localStorage.getItem(ASSET_KEY)); if (Array.isArray(v) && v.length) return v.map((a) => ({ ...a, status: normalizeStatus(a.status) })) } catch { /* 使用种子数据 */ } return seed() }
function download(name, text) {
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }))
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const blank = () => Object.fromEntries(FIELDS.map((f) => [f.key, f.key === 'timeliness' ? '离线' : f.key === 'update_freq' ? 'T+1' : '']))

/* 下线影响范围：真实环境查询权限系统、申请单与圈人任务；演示按资产 ID 生成稳定的示例数 */
function impactOf(a) {
  let h = 0
  for (const ch of a.tag_id) h = (h * 31 + ch.charCodeAt(0)) % 9973
  return { holders: h % 37 + 3, inflight: h % 5, tasks: h % 4 }
}
const sumImpact = (list) => list.map(impactOf).reduce((s, x) => ({ holders: s.holders + x.holders, inflight: s.inflight + x.inflight, tasks: s.tasks + x.tasks }), { holders: 0, inflight: 0, tasks: 0 })

/* 更新对比：左栏线上版本，右栏本次提交，逐字段比较 */
const showVal = (k, v) => { const t = String(v ?? '').trim(); if (!t) return '—'; return k === 'unified_level' ? levelLabel(t) : t }
/* 编辑已上线资产时，只有密级或数据源（来源域 / 源库 / 源表 / 源字段）变化才需要重新做合规确认；其他字段保存后直接机审 */
const COMP_KEYS = ['security_level', 'unified_level', 'source_domain', 'source_db', 'source_table', 'source_field']
const compChanged = (before, after) => COMP_KEYS.some((k) => String(before?.[k] ?? '').trim() !== String(after?.[k] ?? '').trim())
function diffRows(before, after) {
  return FIELDS
    .map((f) => ({ key: f.key, label: f.label, before: showVal(f.key, before[f.key]), after: showVal(f.key, after[f.key]) }))
    .map((x) => ({ ...x, changed: x.before !== x.after }))
}

export default function AssetIn({ V, pushAudit }) {
  const [assets, setAssetsRaw] = useState(load)
  const [logs, setLogs] = useState([])
  const [tab, setTab] = useState('list')
  const [editing, setEditing] = useState(null) // 编辑中的 tag_id；null 为新建
  const [form, setForm] = useState(blank)
  const [formResult, setFormResult] = useState(null)
  const [rows, setRows] = useState(null) // 批量导入校验结果
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState('')
  const [statusTab, setStatusTab] = useState('all'), [q, setQ] = useState(''), [dom, setDom] = useState(''), [page, setPage] = useState(1)
  const [sel, setSel] = useState([]) // 批量下线勾选
  const [offList, setOffList] = useState(null), [offReason, setOffReason] = useState(''), [offAck, setOffAck] = useState(false)
  const [metaTarget, setMetaTarget] = useState(null), [delTarget, setDelTarget] = useState(null)
  const [diff, setDiff] = useState(null), [diffOnly, setDiffOnly] = useState(true) // diff：{ title, rows, onConfirm? }
  const fileRef = useRef(null), errRef = useRef(null)
  /* 合规确认信息（PRD）：合规确认人（员工选择器）、确认结论（通过 / 不通过，仅通过可提交）、确认依据 */
  const [comp, setComp] = useState({ officer: '', result: '', evidence: '' })
  const [compErr, setCompErr] = useState('')
  const [checks, setChecks] = useState({})
  const allChecked = CHECKLIST.every(([k]) => checks[k])
  const setC = (k, v) => { setComp((c) => ({ ...c, [k]: v })); setCompErr('') }

  function setAssets(next) { setAssetsRaw((old) => { const v = typeof next === 'function' ? next(old) : next; try { localStorage.setItem(ASSET_KEY, JSON.stringify(v)) } catch { /* 仅保留在本页 */ } return v }) }
  const ids = assets.map((a) => a.tag_id)
  const counts = useMemo(() => Object.fromEntries(STATUS_TABS.map(([k]) => [k, k === 'all' ? assets.length : assets.filter((a) => a.status === k).length])), [assets])
  useEffect(() => { if (formResult?.errors.length) errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [formResult])

  function checkCompliance() {
    if (!comp.officer) { setCompErr('请选择合规确认人'); return false }
    if (comp.result !== '通过') { setCompErr(comp.result === '不通过' ? '合规确认结论为「不通过」，不能提交' : '请选择合规确认结论'); return false }
    setCompErr(''); return true
  }
  const compFields = () => ({ compliance_officer: comp.officer, compliance_result: comp.result, compliance_evidence: comp.evidence.trim(), compliance_at: nowStamp().slice(0, 16) })
  const batchNo = () => 'B' + nowStamp().replace(/\D/g, '').slice(2, 14)
  const addLog = (log) => setLogs((l) => [{ no: batchNo(), at: nowStamp().slice(0, 16), by: V.name, officer: comp.officer || '—', result: comp.result || '—', ...log }, ...l])
  const NO_COMP = { officer: '—', result: '无需（未改密级与数据源）' }

  const complianceBlock = (scope) => (
    <section className="asset-group asset-compliance">
      <h4><b>合规</b>合规确认信息</h4>
      <p className="asset-muted">提交前须联系所属业务的合规同学，确认{scope}允许接入和使用。由供给方填写确认结果并留存凭证；平台负责字段、格式、枚举值和重复记录校验，不替业务寻找合规负责人，也不对资产内容作业务正确性背书。</p>
      <div className="asset-grid">
        <label className="asset-field" htmlFor="comp-officer"><span>合规确认人<i>*</i></span>
          <select className="au-input" id="comp-officer" value={comp.officer} onChange={(e) => setC('officer', e.target.value)}>
            <option value="">选择员工</option>{DEMO_OFFICERS.map((o) => <option key={o}>{o}</option>)}
          </select>
          <small>使用员工选择器，不允许填写纯文本姓名</small></label>
        <div className="asset-field"><span>确认结论<i>*</i></span>
          <div className="asset-pair">
            {['通过', '不通过'].map((v) => <label key={v} className="asset-radio"><input type="radio" name="comp-result" checked={comp.result === v} onChange={() => setC('result', v)} />{v}</label>)}
          </div>
          <small>只有结论为「通过」且必填信息完整时，才允许提交</small></div>
        <label className="asset-field wide" htmlFor="comp-evidence"><span>确认依据<em className="asset-need-inline n-选填">选填</em></span>
          <input className="au-input" id="comp-evidence" value={comp.evidence} onChange={(e) => setC('evidence', e.target.value)} placeholder="审批单、群聊、邮件或文档链接" />
          <small>确认时间与提交人由系统自动记录，并与本次接入批次绑定</small></label>
      </div>
      {comp.result === '不通过' && <Alert type="warning" message="合规确认未通过，暂不能提交。请与合规同学沟通后再提交。" />}
      {compErr && <Alert type="error" message={compErr} />}
    </section>
  )

  /* 提交：平台机审（固定规则校验字段与格式）通过即上线；已上线资产编辑后同样重新机审 */
  function upsert(list, by) {
    const at = nowStamp().slice(0, 16)
    setAssets((old) => {
      const map = new Map(old.map((a) => [a.tag_id, a]))
      for (const a of list) map.set(a.tag_id, { ...map.get(a.tag_id), ...a, status: statusAfterSubmit(a), offReason: '', offAt: '', autoDraftId: false, updated: at, by })
      return [...map.values()]
    })
  }
  const patch = (id, change) => setAssets((old) => old.map((x) => (x.tag_id === id ? { ...x, ...change, updated: nowStamp().slice(0, 16) } : x)))

  /* ---- 单个录入 ---- */
  const editingAsset = editing ? assets.find((a) => a.tag_id === editing) : null
  const editingDraft = editingAsset?.status === 'draft'
  /* 表单对应的线上资产：编辑已上线 / 已下线资产，或新建时填了本人名下已有的资产 ID */
  const formBefore = editingAsset && !editingDraft ? editingAsset
    : !editing ? assets.find((a) => a.status !== 'draft' && a.tag_id === String(form.tag_id || '').trim() && a.owner === String(form.owner || '').trim()) : null
  const needCompForm = !formBefore || compChanged(formBefore, form)
  function editAsset(a) { setEditing(a.tag_id); setForm({ ...blank(), ...a, tag_id: a.autoDraftId ? '' : a.tag_id }); setFormResult(null); setTab('form') }
  function newAsset() { setEditing(null); setForm(blank()); setFormResult(null); setTab('form') }
  function resetForm() { setDiff(null); setTab('list'); setEditing(null); setForm(blank()); setFormResult(null) }
  function submitForm() {
    /* 提交草稿时，草稿本身不算「已有资产」；taken：生成 tag_id 时要避开平台上已有的 ID */
    const draftKey = editingDraft ? editing : null
    const others = assets.filter((a) => a.tag_id !== draftKey)
    const existing = others.map((a) => a.tag_id)
    const ownerOf = Object.fromEntries(others.map((a) => [a.tag_id, a.owner]))
    const r = validateAsset(form, { existing, taken: existing, ownerOf })
    setFormResult(r)
    if (r.errors.length) { addLog({ mode: '单个', created: 0, updated: 0, failed: 1, file: r.asset.tag_name || '—' }); return }
    /* 资产 ID 已存在且为本人资产：按更新处理；只有密级或数据源变化才需要重新合规确认 */
    const before = r.action === 'update' ? others.find((a) => a.tag_id === r.asset.tag_id) : null
    const needComp = !before || compChanged(before, r.asset)
    if (needComp) {
      if (!checkCompliance()) return
      Object.assign(r.asset, compFields())
    }
    if (before) {
      const d = diffRows(before, r.asset)
      if (!d.some((x) => x.changed)) { message.info('没有修改任何字段'); return }
      setDiffOnly(true)
      setDiff({ title: `更新确认 · ${before.tag_name}（${before.tag_id}）`, rows: d, onConfirm: () => commitForm(r, draftKey, true, needComp) })
      return
    }
    commitForm(r, draftKey, false, needComp)
  }
  function commitForm(r, draftKey, isUpdate, needComp) {
    if (draftKey && draftKey !== r.asset.tag_id) setAssets((old) => old.filter((x) => x.tag_id !== draftKey))
    upsert([r.asset], V.name) // 未重新确认时沿用该资产已有的合规确认记录
    addLog({ mode: '单个', created: isUpdate ? 0 : 1, updated: isUpdate ? 1 : 0, failed: 0, file: r.asset.tag_name, ...(needComp ? {} : NO_COMP) })
    pushAudit?.(`${isUpdate ? '更新' : '接入'}资产：${r.asset.tag_name}（${r.asset.tag_id}）→ 机审通过，已上线；${needComp ? `合规确认人 ${comp.officer}` : '未改密级与数据源，沿用原合规确认'}`, r.asset.unified_level)
    message.success(`机审通过，${isUpdate ? '更新已生效' : '已上线'}：${r.asset.tag_name}`)
    resetForm()
  }
  /* 草稿：不校验、不机审、不上线，仅资产 Owner 可见；至少需要标签名称 */
  function saveDraft() {
    const name = String(form.tag_name || '').trim()
    if (!name) { setFormResult({ errors: ['保存草稿至少需要填写标签名称'], notes: [] }); return }
    const typed = String(form.tag_id || '').trim()
    const id = typed || (editingDraft && editingAsset.autoDraftId ? editing : `draft_${Date.now()}`)
    if (assets.some((a) => a.tag_id === id && a.tag_id !== editing)) { setFormResult({ errors: ['资产 ID 已存在，请换一个，或到资产列表中编辑已有资产'], notes: [] }); return }
    setAssets((old) => [...old.filter((x) => x.tag_id !== editing && x.tag_id !== id), {
      ...form, tag_id: id, tag_name: name, owner: form.owner || DEMO_ME, autoDraftId: !typed, status: 'draft', offReason: '', updated: nowStamp().slice(0, 16), by: V.name,
    }])
    message.success('草稿已保存，可在资产列表「草稿」中继续编辑')
    resetForm()
  }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v, ...(k === 'timeliness' ? { update_freq: v === '实时' ? '实时' : 'T+1' } : {}), ...(k === 'source_db' || k === 'source_table' ? { source_field: '' } : {}) }))

  /* ---- 批量导入（含批量更新：导出我的资产 → 修改 → 上传） ---- */
  async function onFile(e) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (!/\.csv$/i.test(f.name)) { setFileError('请上传 CSV 文件（Excel 可「另存为 CSV UTF-8」）'); return }
    readCsv(await f.text(), f.name)
  }
  function readCsv(text, name) {
    const { header, records } = parseCsv(text)
    const miss = missingColumns(header)
    setFileName(name)
    if (miss.length) { setFileError(`模板版本不一致：缺少列 ${miss.join('、')}。请重新下载最新模板，迁移数据后上传。`); setRows(null); return }
    if (!records.length) { setFileError('文件中没有数据行'); setRows(null); return }
    setFileError(records.length > MAX_ROWS ? `文件共 ${records.length} 行，超过单次上限 ${MAX_ROWS} 行，只校验前 ${MAX_ROWS} 行` : '')
    const res = validateImport(records, ids, Object.fromEntries(assets.map((a) => [a.tag_id, a.owner])))
    setRows(res)
    const bad = res.filter((r) => r.errors.length).length
    if (bad) addLog({ mode: '批量', file: name, created: 0, updated: 0, failed: bad })
  }
  function demoFile() {
    const keys = FIELDS.map((f) => f.key)
    const mine = assets.find((a) => a.tag_id === 'tag_14501') || assets.find((a) => a.status === 'online')
    const ok = { source_domain: 'DMP', tag_id: 'tag_14595', tag_name: '近30日下单序列', description: '近 30 天用户下单的类目序列，按下单时间倒序，T+1 更新', timeliness: '离线', update_freq: 'T+1', coverage: '82.4%', owner: DEMO_ME, source_db: 'ecom_dmp', source_table: 'dwd_user_order_di', source_field: 'order_cate_seq', security_level: 'L3', unified_level: '受控', official_mark: '官方', usage_limit: '', remark: '' }
    const list = [
      ok,
      { ...mine, coverage: '90', usage_limit: '仅支持正向圈选' }, // 本人已有资产 → 更新
      { ...ok, tag_id: 'tag_14596', tag_name: '直播实时观看状态', description: '用户当前是否在直播间观看，秒级更新', timeliness: '实时', update_freq: 'T+1', source_field: 'order_cnt_30d', security_level: 'L4', unified_level: '通用' },
      { ...ok, tag_id: 'tag_14597', tag_name: '到店频次分层', coverage: '120', update_freq: '每天', owner: '@nobody', source_domain: 'LDMP', source_db: 'life_ldmp', source_table: 'dws_life_visit_freq_df', source_field: 'visit_cnt' },
      { ...ok, tag_id: 'tag_14595', tag_name: '重复的标签', security_level: 'L5' },
      /* 其他标签资产留空 ID 会自动生成；DMP 留空则报错 */
      { ...ok, source_domain: '其他标签资产', tag_id: '', tag_name: 'AI 品类兴趣侧写', description: '基于大模型侧写输出的品类兴趣，周更', update_freq: '周更', coverage: '64', owner: '@wangwu', source_db: 'ai_profile', source_table: 'dwd_llm_cate_interest_di', source_field: 'cate_interest', unified_level: '通用' },
      { ...ok, tag_id: '', tag_name: '缺 ID 的 DMP 标签', source_field: 'order_cnt_30d' },
    ]
    readCsv(toCsv(list, keys), '演示文件.csv')
  }
  const okRows = rows?.filter((r) => !r.errors.length) || [], badRows = rows?.filter((r) => r.errors.length) || []
  /* 一行需要合规确认：新增资产，或更新时改了密级或数据源 */
  const rowNeedsComp = (r) => r.action === 'create' || compChanged(assets.find((a) => a.tag_id === r.asset.tag_id), r.asset)
  const batchNeedsComp = !rows || rows.some(rowNeedsComp)
  function submitImport() {
    /* 整批校验：一批里只要有一条不合规，本批文件就不导入 */
    if (!rows?.length || badRows.length) return
    if (batchNeedsComp && !checkCompliance()) return
    if (!allChecked) { setCompErr('提交前检查清单需逐项确认'); return }
    upsert(okRows.map((r) => (rowNeedsComp(r) ? Object.assign(r.asset, compFields()) : r.asset)), V.name)
    const created = okRows.filter((r) => r.action === 'create').length, updated = okRows.filter((r) => r.action === 'update').length
    addLog({ mode: '批量', file: fileName, created, updated, failed: 0, ...(batchNeedsComp ? {} : NO_COMP) })
    pushAudit?.(`批量导入资产：${fileName}，新增 ${created}、更新 ${updated}；${batchNeedsComp ? `合规确认人 ${comp.officer}` : '均未改密级与数据源，沿用原合规确认'}`)
    message.success(`机审通过，已整批导入并上线 ${okRows.length} 个资产（新增 ${created}、更新 ${updated}）`)
    setRows(null)
    setTab('list')
  }
  function downloadErrors() {
    download('资产导入-错误清单.csv', toCsv(badRows.map((r) => ({ ...r.asset, line: r.line, errors: r.errors.join('；') })), ['line', 'errors', ...FIELDS.map((f) => f.key)]))
  }
  /* 导出我的资产：按最新模板格式导出本人名下的已上线 / 已下线资产，修改后通过批量导入上传即为批量更新 */
  function exportMine() {
    const mine = assets.filter((a) => a.owner === DEMO_ME && a.status !== 'draft')
    download('我的资产-导出.csv', toCsv(mine, FIELDS.map((f) => f.key)))
    message.success(`已导出 ${mine.length} 个资产；修改后在「批量导入」上传，按资产 ID 识别为更新`)
  }

  /* ---- 上下线 ---- */
  function openOff(list) { setOffList(list); setOffReason(''); setOffAck(false) }
  function confirmOff() {
    if (offReason.trim().length < 4 || !offAck) return
    const at = nowStamp().slice(0, 10), names = offList.map((a) => a.tag_name)
    const offIds = new Set(offList.map((a) => a.tag_id))
    setAssets((old) => old.map((x) => (offIds.has(x.tag_id) ? { ...x, status: 'off', offReason: offReason.trim(), offAt: at, updated: nowStamp().slice(0, 16) } : x)))
    pushAudit?.(`${offList.length > 1 ? '批量' : ''}下线资产：${names.join('、')}，原因：${offReason.trim()}`)
    message.success(`已下线 ${offList.length} 个资产；受影响消费方将在标签广场、我的申请 / 权限页看到提醒，并收到 IM bot 通知`)
    setSel((s) => s.filter((id) => !offIds.has(id))); setOffList(null)
  }
  /* 已下线资产重新上线：重新走一次机审 */
  function goOnline(a) {
    const r = validateAsset(a, { existing: ids })
    if (r.errors.length) { message.error(`重新机审未通过：${r.errors[0]}。请先编辑修正`); return }
    patch(a.tag_id, { status: 'online', offReason: '', offAt: '' })
    pushAudit?.(`重新上线资产：${a.tag_name}（重新机审通过）`, a.unified_level)
    message.success('重新机审通过，已上线')
  }
  function confirmDelete() { setAssets((old) => old.filter((x) => x.tag_id !== delTarget.tag_id)); pushAudit?.(`删除资产：${delTarget.tag_name}（${delTarget.tag_id}）`); message.success('已删除'); setDelTarget(null) }

  const kw = q.trim().toLowerCase()
  const shown = assets.filter((a) => (statusTab === 'all' || a.status === statusTab) && (!dom || a.source_domain === dom) && (!kw || `${a.tag_name} ${a.tag_id} ${a.source_table}`.toLowerCase().includes(kw)))
  const pages = Math.max(1, Math.ceil(shown.length / PAGE)), pageNow = Math.min(page, pages), pageRows = shown.slice((pageNow - 1) * PAGE, pageNow * PAGE)
  const pageOnline = pageRows.filter((a) => a.status === 'online').map((a) => a.tag_id)
  const pageAllOn = pageOnline.length > 0 && pageOnline.every((id) => sel.includes(id))
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const togglePage = () => setSel((s) => (pageAllOn ? s.filter((id) => !pageOnline.includes(id)) : [...new Set([...s, ...pageOnline])]))
  const statusTag = (st) => <Tag color={st === 'online' ? 'success' : st === 'draft' ? 'warning' : undefined}>{STATUS_LABEL[st]}</Tag>
  const selAssets = assets.filter((a) => sel.includes(a.tag_id) && a.status === 'online')

  const list = (
    <Card title="我的标签资产" extra={<Space><Button onClick={exportMine}>导出我的资产</Button><Button onClick={() => setTab('import')}>批量导入</Button><Button type="primary" onClick={newAsset}>+ 单个录入</Button></Space>}>
      <div className="asset-status-tabs" role="tablist">{STATUS_TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={statusTab === k} className={statusTab === k ? 'on' : ''} onClick={() => { setStatusTab(k); setPage(1) }}>{l}<b>{counts[k]}</b></button>)}</div>
      <div className="asset-filters">
        <input className="au-input" placeholder="搜索标签名称 / 资产 ID / 源表" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} aria-label="搜索资产" />
        <select className="au-input" value={dom} onChange={(e) => { setDom(e.target.value); setPage(1) }} aria-label="来源域"><option value="">全部来源域</option>{DOMAINS.map((x) => <option key={x}>{x}</option>)}</select>
      </div>
      {selAssets.length > 0 && <div className="asset-batch-bar"><span>已选 <b>{selAssets.length}</b> 个已上线资产</span><Space><Button size="small" onClick={() => setSel([])}>取消选择</Button><Button size="small" type="primary" onClick={() => openOff(selAssets)}>批量下线</Button></Space></div>}
      <table className="asset-table">
        <thead><tr>
          <th className="asset-check"><input type="checkbox" aria-label="勾选本页已上线资产" checked={pageAllOn} disabled={!pageOnline.length} onChange={togglePage} /></th>
          <th>标签</th><th>来源</th><th>时效 · 更新频率</th><th>覆盖率</th><th>最终生效密级</th><th>状态</th><th>操作</th>
        </tr></thead>
        <tbody>{pageRows.map((a) => (
          <tr key={a.tag_id}>
            <td className="asset-check">{a.status === 'online' && <input type="checkbox" aria-label={`勾选 ${a.tag_name}`} checked={sel.includes(a.tag_id)} onChange={() => toggle(a.tag_id)} />}</td>
            <td><button type="button" className="asset-name" onClick={() => setMetaTarget(a)}>{a.tag_name}</button><small>{a.autoDraftId ? '资产 ID 未填写' : a.tag_id}</small></td>
            <td className="asset-src">{a.source_domain || '—'}<small>{a.source_db}.{a.source_table}</small><small>{a.source_field}</small></td>
            <td>{freqText(a)}</td>
            <td>{a.coverage ? `${a.coverage}%` : '—'}</td>
            <td>{a.unified_level ? <LevelChip level={a.unified_level} /> : '—'}</td>
            <td>{statusTag(a.status)}{a.status === 'off' && <small>{a.offAt} 下线{a.offReason ? ` · ${a.offReason}` : ''}</small>}</td>
            <td className="asset-ops">
              <Button size="small" type="link" onClick={() => setMetaTarget(a)}>元信息</Button>
              {a.status !== 'off' && <Button size="small" type="link" onClick={() => editAsset(a)}>编辑</Button>}
              {a.status === 'draft' && <Button size="small" type="link" onClick={() => { editAsset(a); message.info('补充必填信息与合规确认后点击「提交」，机审通过即上线') }}>提交</Button>}
              {a.status === 'online' && <Button size="small" type="link" onClick={() => openOff([a])}>下线</Button>}
              {a.status === 'off' && <Button size="small" type="link" onClick={() => goOnline(a)}>重新上线</Button>}
              {a.status !== 'online' && <Button size="small" type="link" onClick={() => setDelTarget(a)}>删除</Button>}
            </td>
          </tr>
        ))}</tbody>
      </table>
      {!shown.length && <p className="asset-muted asset-empty">没有符合条件的资产</p>}
      {shown.length > 0 && <div className="pending-pager"><span>共 {shown.length} 条 · 第 {pageNow} / {pages} 页</span><Space><Button size="small" disabled={pageNow === 1} onClick={() => setPage(pageNow - 1)}>上一页</Button><Button size="small" disabled={pageNow === pages} onClick={() => setPage(pageNow + 1)}>下一页</Button></Space></div>}
      <div className="asset-rules">🔒 规则：提交后由平台机审（固定规则校验字段与格式），通过即上线并同步至标签广场；更新已有资产时先左右对比确认差异；草稿不校验、不上线，仅资产 Owner 可见；下线需填写原因并确认影响范围；已上线资产不可直接删除，需先下线。</div>
    </Card>
  )

  /* ---- 单个录入表单 ---- */
  const tagIdNeeded = needsTagId(form.source_domain)
  const autoId = !tagIdNeeded && form.source_domain && form.source_table && form.source_field ? autoTagId(form.source_table, form.source_field, ids.filter((x) => x !== editing)) : ''
  const tagIdHint = tagIdNeeded ? `来源域为 ${TAG_ID_DOMAINS.join(' / ')} 时必填，须与原系统 ID 一致`
    : !form.source_domain ? '先选择来源域：DMP / LDMP 必填，其他标签资产可留空'
      : autoId ? `其他标签资产无需填写；留空将生成 ${autoId}` : '其他标签资产无需填写；留空时由平台按源表与源字段生成'
  const tableKey = `${form.source_db}.${form.source_table}`
  const input = (k, props = {}) => <input className="au-input" id={`asset-${k}`} value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} placeholder={FIELDS.find((f) => f.key === k)?.example ? '如 ' + FIELDS.find((f) => f.key === k).example : ''} {...props} />
  const select = (k, opts, empty) => <select className="au-input" id={`asset-${k}`} value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)}>{empty && <option value="">{empty}</option>}{opts.map((o) => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}</select>
  const field = (k, el, wide, opt = {}) => {
    const f = FIELDS.find((x) => x.key === k)
    const need = opt.need || needOf(f)
    return (
      <label className={`asset-field${wide ? ' wide' : ''}`} htmlFor={`asset-${k}`} key={k}>
        <span>{f.label}{need === '必填' ? <i>*</i> : <em className={`asset-need-inline n-${need}`}>{need}</em>}</span>
        {el}
        <small>{opt.hint || f.hint}</small>
      </label>
    )
  }
  const control = {
    source_domain: () => field('source_domain', select('source_domain', DOMAINS, '请选择来源域')),
    tag_id: () => field('tag_id', input('tag_id', { disabled: !!editing && !editingDraft, placeholder: tagIdNeeded ? '如 tag_14587，须与原系统一致' : '可留空，由平台生成' }), false, { need: tagIdNeeded ? '必填' : '条件必填', hint: tagIdHint }),
    tag_name: () => field('tag_name', input('tag_name')),
    description: () => field('description', <textarea className="au-textarea" id="asset-description" rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="业务含义、枚举或单位、加工逻辑、适用场景和使用限制" />, true),
    timeliness: () => field('timeliness', select('timeliness', TIMELINESS)),
    update_freq: () => field('update_freq', form.timeliness === '实时' ? <input className="au-input" id="asset-update_freq" value="实时" disabled /> : select('update_freq', FREQS.filter((x) => x !== '实时'))),
    coverage: () => field('coverage', input('coverage')),
    owner: () => field('owner', input('owner', { list: 'asset-owners' })),
    source_db: () => field('source_db', input('source_db', { list: 'asset-dbs' })),
    source_table: () => field('source_table', input('source_table', { list: 'asset-tables' })),
    source_field: () => field('source_field', DEMO_TABLES[tableKey] ? select('source_field', DEMO_TABLES[tableKey], '请选择字段') : input('source_field')),
    security_level: () => field('security_level', select('security_level', SECURITY_LEVELS, '请选择密级')),
    unified_level: () => field('unified_level', select('unified_level', LEVEL_OPTS, '请选择统一级别'), false, {
      hint: form.security_level && form.unified_level && !levelMatches(form.security_level, form.unified_level) ? `⚠ 与密级 ${form.security_level} 不对应：L2→开放，L3→通用 / 受控，L4→高敏` : undefined,
    }),
    official_mark: () => field('official_mark', select('official_mark', OFFICIAL, '不填写')),
    usage_limit: () => field('usage_limit', input('usage_limit')),
    remark: () => field('remark', input('remark'), true),
  }
  const formView = (
    <Card title={editing ? `${editingDraft ? '编辑草稿' : '编辑资产'} · ${editingAsset?.tag_name || editing}` : '单个录入'} extra={<Button onClick={() => setTab('list')}>返回列表</Button>}>
      <div className="asset-sop" aria-label="资产接入流程">{SOP.map((s, i) => <span key={s}><b>{i + 1}</b>{s}</span>)}</div>
      <div ref={errRef}>{formResult?.errors.length > 0 && <Alert type="error" message="机审未通过，请先修正以下问题" description={formResult.errors.join('；')} />}</div>
      {FORM_GROUPS.map((g, i) => (
        <section key={g} className="asset-group"><h4><b>{i + 1}</b>{g}</h4><div className="asset-grid">{FIELDS.filter((f) => f.group === g).map((f) => control[f.key]())}</div></section>
      ))}
      {needCompForm ? <>
        {formBefore && <Alert type="warning" message="本次修改了密级或数据源，需重新完成合规确认后才能提交" />}
        {complianceBlock('该资产')}
      </> : <div className="asset-comp-skip">✅ 本次未修改密级与数据源，无需重新合规确认，保存后直接进入平台机审（沿用该资产已有的合规确认记录）。如修改密级、统一级别、来源域、源库、源表或源字段，需补充合规确认信息。</div>}
      <datalist id="asset-owners">{DEMO_OWNERS.map((o) => <option key={o} value={o} />)}</datalist>
      <datalist id="asset-dbs">{[...new Set(Object.keys(DEMO_TABLES).map((k) => k.split('.')[0]))].map((o) => <option key={o} value={o} />)}</datalist>
      <datalist id="asset-tables">{Object.keys(DEMO_TABLES).filter((k) => !form.source_db || k.startsWith(form.source_db + '.')).map((k) => <option key={k} value={k.split('.')[1]} />)}</datalist>
      {formResult?.notes.length > 0 && <Alert type="info" message={formResult.notes.join('；')} />}
      <div className="asset-actions"><span className="asset-muted">提交后平台机审，通过即上线；资产 ID 已是本人资产时按更新处理，先展示左右对比</span><Space><Button onClick={() => setTab('list')}>取消</Button>{(!editing || editingDraft) && <Button onClick={saveDraft}>保存草稿</Button>}<Button type="primary" disabled={needCompForm && comp.result === '不通过'} onClick={submitForm}>{formBefore ? '保存并提交机审' : '提交'}</Button></Space></div>
    </Card>
  )

  const importView = (
    <Card title="批量导入" extra={<Button onClick={() => setTab('list')}>返回列表</Button>}>
      <div className="asset-sop" aria-label="资产接入流程">{SOP.map((s, i) => <span key={s}><b>{i + 1}</b>{s}</span>)}</div>
      <ol className="asset-steps">
        <li><b>1</b><div><strong>下载模板</strong><p>第 1 行为列名；第 2、3 行是「填写要求」和「字段说明」（以 # 开头，导入时自动跳过）；之后是示例行。按列顺序填写，不增删列、不修改表头</p><Button size="small" onClick={() => download('资产导入模板.csv', templateCsv())}>下载最新模板</Button></div></li>
        <li><b>2</b><div><strong>填写并上传</strong><p>一行一个资产，CSV 格式，单次最多 {MAX_ROWS} 行。批量更新：先在资产列表「导出我的资产」，修改后在此上传</p><Space><Button size="small" type="primary" onClick={() => fileRef.current?.click()}>上传 CSV</Button><Button size="small" onClick={demoFile}>用演示文件试试</Button></Space><input ref={fileRef} type="file" accept=".csv" hidden onChange={onFile} /></div></li>
        <li><b>3</b><div><strong>平台机审、提交</strong><p>按资产 ID 识别新增 / 更新（本人资产按更新处理，可查看差异；他人资产报冲突）；<b>整批校验</b>：只要有一行不合规，本批文件就不导入，修复后重新上传整批文件</p></div></li>
      </ol>
      <section className="asset-need">
        <h4>字段填写要求</h4>
        {['必填', '条件必填', '选填'].map((n) => <div key={n} className="asset-need-row"><span className={`asset-need-tag n-${n}`}>{n}</span><div>{FIELDS.filter((f) => needOf(f) === n).map((f) => <span key={f.key} className="asset-need-chip" title={f.hint}><code>{f.key}</code>{f.label}{needNote(f) && <em>（{needNote(f)}）</em>}</span>)}</div></div>)}
        <details className="asset-spec"><summary>查看完整字段说明（{FIELDS.length} 列）</summary><table className="asset-table"><thead><tr><th>列名</th><th>名称</th><th>填写要求</th><th>说明</th></tr></thead><tbody>{FIELDS.map((f) => <tr key={f.key}><td><code>{f.key}</code></td><td>{f.label}</td><td><span className={`asset-need-tag n-${needOf(f)}`}>{needOf(f)}</span></td><td>{[f.hint, needNote(f)].filter(Boolean).join('；')}</td></tr>)}</tbody></table></details>
      </section>
      {batchNeedsComp ? complianceBlock('本批资产') : <div className="asset-comp-skip">✅ 本批均为已有资产的更新，且未修改密级与数据源，无需重新合规确认，提交后直接进入平台机审。</div>}
      <section className="asset-group asset-checklist">
        <h4><b>检查</b>提交前检查清单</h4>
        {CHECKLIST.map(([k, label]) => (
          <label key={k} className="asset-radio asset-check-item">
            <input type="checkbox" checked={!!checks[k]} onChange={() => { setChecks((c) => ({ ...c, [k]: !c[k] })); setCompErr('') }} />
            {label}
          </label>
        ))}
      </section>
      {fileError && <Alert type="warning" message={fileError} />}
      {rows && <>
        <div className="asset-result-bar"><span>{fileName} · 共 {rows.length} 行：<b className="ok">✅ 新增 {okRows.filter((r) => r.action === 'create').length}</b><b className="up">🔄 更新 {okRows.filter((r) => r.action === 'update').length}</b><b className="bad">❌ 错误 {badRows.length}</b></span>
          <Space>{badRows.length > 0 && <Button size="small" onClick={downloadErrors}>下载错误清单</Button>}<Button size="small" type="primary" disabled={!rows.length || badRows.length > 0 || (batchNeedsComp && comp.result === '不通过') || !allChecked} onClick={submitImport}>导入全部 {rows.length} 行</Button></Space></div>
        {badRows.length > 0 && <Alert type="error" message={`机审未通过：本批存在 ${badRows.length} 行不合规记录，整批文件不导入。按下表定位修复后，重新上传整批文件。`} />}
        <table className="asset-table">
          <thead><tr><th>行</th><th>结果</th><th>标签</th><th>时效 · 频率</th><th>最终生效密级</th><th>说明</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.line} className={r.errors.length ? 'is-bad' : ''}>
              <td>{r.line}</td>
              <td>{r.errors.length ? <Tag color="danger">错误</Tag> : r.action === 'update' ? <Tag color="primary">更新</Tag> : <Tag color="success">新增</Tag>}</td>
              <td><b>{r.asset.tag_name || '—'}</b><small>{r.asset.tag_id || '—'}</small></td>
              <td>{r.asset.timeliness ? freqText(r.asset) : '—'}</td>
              <td>{SECURITY.includes(r.asset.unified_level) ? <LevelChip level={r.asset.unified_level} /> : '—'}</td>
              <td className="asset-msgs">{r.errors.map((e) => <p key={e} className="bad">{e}</p>)}{r.notes.map((n) => <p key={n}>{n}</p>)}{r.action === 'update' && !r.errors.length && <p>本人名下已有资产，按更新处理 <Button size="small" type="link" onClick={() => { const before = assets.find((a) => a.tag_id === r.asset.tag_id); setDiffOnly(true); setDiff({ title: `更新差异 · ${before.tag_name}（${before.tag_id}）`, rows: diffRows(before, r.asset) }) }}>查看差异</Button></p>}</td>
            </tr>
          ))}</tbody>
        </table>
      </>}
    </Card>
  )

  const logView = (
    <Card title="导入记录">
      {logs.length ? <table className="asset-table"><thead><tr><th>批次号</th><th>提交时间</th><th>提交人</th><th>接入方式</th><th>文件 / 资产</th><th>合规确认人 · 结论</th><th>机审结果</th></tr></thead><tbody>{logs.map((l) => (
        <tr key={l.no + l.at + l.file}>
          <td><code>{l.no}</code></td><td>{l.at}</td><td>{l.by}</td><td>{l.mode}</td><td>{l.file}</td><td>{l.officer} · {l.result}</td>
          <td>{l.failed ? <Tag color="danger">失败 {l.failed} 行</Tag> : <Tag color="success">通过</Tag>}{!l.failed && <small>新增 {l.created} · 更新 {l.updated}</small>}</td>
        </tr>
      ))}</tbody></table> : <p className="asset-muted asset-empty">还没有导入记录。单个录入与批量导入的每次提交都会记录在这里</p>}
    </Card>
  )

  const offImpact = offList ? sumImpact(offList) : null
  return (
    <>
      <div className="page-head"><div className="page-title">资产管理</div></div>
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'list', label: '资产列表', children: list },
        { key: 'form', label: editing ? (editingDraft ? '编辑草稿' : '编辑资产') : '单个录入', children: formView },
        { key: 'import', label: '批量导入', children: importView },
        { key: 'logs', label: `导入记录${logs.length ? `（${logs.length}）` : ''}`, children: logView },
      ]} />
      {metaTarget && <Modal open width={680} title={`元信息 · ${metaTarget.tag_name}`} onCancel={() => setMetaTarget(null)} footer={<Space><Button onClick={() => setMetaTarget(null)}>关闭</Button>{metaTarget.status !== 'off' && <Button type="primary" onClick={() => { const a = metaTarget; setMetaTarget(null); editAsset(a) }}>编辑</Button>}</Space>}>
        <div className="asset-meta-head">{statusTag(metaTarget.status)}<span>元信息完整度 <b>{completeness(metaTarget)}%</b></span><span className="asset-muted">最近更新 {metaTarget.updated} · {metaTarget.by}</span></div>
        {FORM_GROUPS.map((g) => <section key={g} className="asset-meta-group"><h4>{g}</h4><dl>{FIELDS.filter((f) => f.group === g).map((f) => <div key={f.key}><dt>{f.label}</dt><dd className={String(metaTarget[f.key] ?? '').trim() || !f.required ? '' : 'missing'}>{f.key === 'unified_level' && metaTarget.unified_level ? <LevelChip level={metaTarget.unified_level} /> : String(metaTarget[f.key] ?? '').trim() || '未填写'}</dd></div>)}</dl></section>)}
        {metaTarget.compliance_officer && <section className="asset-meta-group"><h4>合规确认</h4><dl><div><dt>合规确认人</dt><dd>{metaTarget.compliance_officer}</dd></div><div><dt>确认结论</dt><dd>{metaTarget.compliance_result}</dd></div><div><dt>确认依据</dt><dd>{metaTarget.compliance_evidence || '未填写'}</dd></div><div><dt>确认时间</dt><dd>{metaTarget.compliance_at}</dd></div></dl></section>}
      </Modal>}
      {diff && (() => {
        const changed = diff.rows.filter((x) => x.changed)
        return <Modal open width={760} title={diff.title} onCancel={() => setDiff(null)} footer={<Space>{diff.onConfirm ? <><Button onClick={() => setDiff(null)}>返回修改</Button><Button type="primary" onClick={diff.onConfirm}>确认更新</Button></> : <Button onClick={() => setDiff(null)}>关闭</Button>}</Space>}>
          <div className="asset-diff-head"><span>共修改 <b>{changed.length}</b> 个字段</span><label className="asset-radio"><input type="checkbox" checked={diffOnly} onChange={() => setDiffOnly((v) => !v)} />只看有变化的字段</label></div>
          {changed.some((x) => COMP_KEYS.includes(x.key)) ? <Alert type="warning" message="密级或数据源有变化：本次提交附带新的合规确认记录" /> : <Alert type="info" message="未修改密级与数据源：沿用原合规确认记录，确认后直接进入机审" />}
          <table className="asset-table asset-diff">
            <thead><tr><th>字段</th><th>线上版本</th><th>本次提交</th></tr></thead>
            <tbody>{diff.rows.filter((x) => !diffOnly || x.changed).map((x) => <tr key={x.key} className={x.changed ? 'is-changed' : ''}><td>{x.label}</td><td className="before">{x.before}</td><td className="after">{x.after}</td></tr>)}</tbody>
          </table>
        </Modal>
      })()}
      {delTarget && <Modal open title={`删除资产 · ${delTarget.tag_name}`} onCancel={() => setDelTarget(null)} footer={<Space><Button onClick={() => setDelTarget(null)}>取消</Button><Button type="primary" onClick={confirmDelete}>确认删除</Button></Space>}>
        <p>删除后该资产的登记信息将被移除，无法恢复。{delTarget.status === 'draft' ? '（草稿）' : <>资产 ID：<code>{delTarget.tag_id}</code></>}</p>
      </Modal>}
      {offList && <Modal open width={620} title={offList.length > 1 ? `批量下线 · ${offList.length} 个资产` : `下线资产 · ${offList[0].tag_name}`} onCancel={() => setOffList(null)} footer={<Space><Button onClick={() => setOffList(null)}>取消</Button><Button type="primary" disabled={offReason.trim().length < 4 || !offAck} onClick={confirmOff}>确认下线</Button></Space>}>
        {offList.length > 1 && <p className="asset-muted">{offList.map((a) => a.tag_name).join('、')}</p>}
        <div className="asset-impact">
          <div><b>{offImpact.holders}</b><span>持有生效权限的消费方</span></div>
          <div><b>{offImpact.inflight}</b><span>在途申请单</span></div>
          <div><b>{offImpact.tasks}</b><span>引用的圈人任务 / 模板</span></div>
        </div>
        <p className="asset-muted">下线后：标签广场不再展示该资产；受影响消费方会在标签广场与「我的申请 / 权限」页顶部看到提醒，并收到 IM bot 通知；在途申请单自动关闭；引用的圈人定期更新任务自动暂停。（影响人数为演示数据）</p>
        <textarea className="au-textarea" rows={3} value={offReason} onChange={(e) => setOffReason(e.target.value)} placeholder="下线原因（至少 4 个字），如：上游表下线，口径停止维护" aria-label="下线原因" />
        <label className="asset-radio asset-off-ack"><input type="checkbox" checked={offAck} onChange={() => setOffAck((v) => !v)} />我已知晓以上影响范围，确认下线</label>
      </Modal>}
    </>
  )
}
