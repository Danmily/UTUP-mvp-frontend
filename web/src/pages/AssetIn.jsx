import { useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, Modal, Space, Statistic, Tabs, Tag, message } from '@ecom/aurora'
import { TAGS, nowStamp } from '../data.js'
import { LevelChip } from '../mvp-ui.jsx'
import {
  FIELDS, SECURITY, SOURCES, FREQ_OFFLINE, STATUS_LABEL, MAX_ROWS, DEMO_OWNERS, DEMO_TABLES,
  effectiveLevel, freqText, parseCsv, templateCsv, toCsv, validateAsset, validateImport, missingColumns,
} from '../flows/asset-model.mjs'

/* 资产接入（V2 · 3.2）：单个录入 + 批量导入 + 审核上下线；演示数据存于浏览器 */
const KEY = 'utup.assets.v1'
const DB = { 电商DMP: 'ecom_dmp', 生服LDMP: 'life_ldmp', AI用户画像: 'ai_profile', 双域算法资产: 'xd_algo' }
const SOP = ['准备', '下载模板', '填写', '上传校验', '预览修正', '提交审核', '审核上线', '下线']
const seed = () => TAGS.map((t) => ({
  tag_id: 'tag_' + t.id, tag_name: t.name, description: t.desc, coverage: String(t.cov || 0),
  timeliness: t.freq === '实时' ? '2' : '1', update_freq: t.freq === '实时' ? '实时' : (t.freq === 'T+7' ? 'T+7' : 'T+1'),
  owner: '@zhangsan', owner_team: t.owner, source_system: t.src, source_table: `${DB[t.src] || 'ecom_dmp'}.${t.table}`, source_field: 'label_value',
  table_security: t.level, column_security_level: '', effective_column_level: t.level, status: 'online', updated: '2026-09-20 10:00', by: 'system',
}))
function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(v) && v.length) return v } catch { /* 使用种子数据 */ } return seed() }
function download(name, text) {
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }))
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const blank = () => Object.fromEntries(FIELDS.map((f) => [f.key, f.key === 'timeliness' ? '1' : f.key === 'update_freq' ? 'T+1' : '']))

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
  const [offTarget, setOffTarget] = useState(null), [offReason, setOffReason] = useState('')
  const [filter, setFilter] = useState('')
  const fileRef = useRef(null)
  const isAdmin = V.role === 'platform'

  function setAssets(next) { setAssetsRaw((old) => { const v = typeof next === 'function' ? next(old) : next; try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* 仅保留在本页 */ } return v }) }
  const ids = assets.map((a) => a.tag_id)
  const stats = useMemo(() => ({ all: assets.length, online: assets.filter((a) => a.status === 'online').length, pending: assets.filter((a) => a.status === 'pending').length, off: assets.filter((a) => a.status === 'off').length }), [assets])

  /* 提交：新增或更新都先进入「待审核」，审核通过才上线 */
  function upsert(list, by) {
    const at = nowStamp().slice(0, 16)
    setAssets((old) => {
      const map = new Map(old.map((a) => [a.tag_id, a]))
      for (const a of list) map.set(a.tag_id, { ...map.get(a.tag_id), ...a, status: 'pending', wanted: a.status || 'online', updated: at, by })
      return [...map.values()]
    })
  }

  /* ---- 单个录入 ---- */
  function editAsset(a) { setEditing(a.tag_id); setForm({ ...blank(), ...a, status: a.status === 'off' ? 'off' : 'online' }); setFormResult(null); setTab('form') }
  function newAsset() { setEditing(null); setForm(blank()); setFormResult(null); setTab('form') }
  function submitForm() {
    const r = validateAsset(form, { existing: editing ? [] : ids })
    if (!editing && ids.includes(r.asset.tag_id)) r.errors.push('标签 ID 已存在，请到资产列表中编辑')
    setFormResult(r)
    if (r.errors.length) return
    upsert([r.asset], 'user')
    pushAudit?.(`${editing ? '更新' : '新增'}资产并提交审核：${r.asset.tag_name}（${r.asset.tag_id}）`, r.asset.effective_column_level)
    message.success(`已提交审核：${r.asset.tag_name}`)
    setTab('list'); setEditing(null); setForm(blank()); setFormResult(null)
  }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v, ...(k === 'timeliness' ? { update_freq: v === '2' ? '实时' : 'T+1' } : {}) }))

  /* ---- 批量导入 ---- */
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
    if (miss.length) { setFileError(`缺少必需列：${miss.join('、')}。请使用最新模板。`); setRows(null); return }
    if (!records.length) { setFileError('文件中没有数据行'); setRows(null); return }
    setFileError(records.length > MAX_ROWS ? `文件共 ${records.length} 行，超过单次上限 ${MAX_ROWS} 行，只校验前 ${MAX_ROWS} 行` : '')
    setRows(validateImport(records, ids))
  }
  function demoFile() {
    const keys = FIELDS.map((f) => f.key)
    const ok = { tag_id: 'order_seq_30d', tag_name: '近30日下单序列', description: '近 30 天用户下单的类目序列，按下单时间倒序，T+1 更新', coverage: '82.4%', timeliness: '1', update_freq: 'T+1', owner: '@zhangsan', owner_team: '电商 DMP 团队', source_system: '电商DMP', source_table: 'ecom_dmp.dwd_user_order_di', source_field: 'order_cate_seq', table_security: '受控', column_security_level: '', status: 'online' }
    const rows = [
      ok,
      { ...ok, tag_id: 'live_watch_rt', tag_name: '直播实时观看状态', description: '用户当前是否在直播间观看，秒级更新', coverage: '35', timeliness: '2', update_freq: 'T+1', source_field: 'order_cnt_30d', table_security: '通用', column_security_level: '受控' },
      { ...ok, tag_id: 'tag_14520', tag_name: '品类偏好序列 Top10', source_table: 'ecom_dmp.dws_ecom_cate_pref_df', source_field: 'cate_pref_top10' },
      { ...ok, tag_id: 'visit_level', tag_name: '到店频次分层', coverage: '120', timeliness: '1', update_freq: '', owner: '@nobody', source_system: '生服LDMP', source_table: 'life_ldmp.dws_life_visit_freq_df', source_field: 'visit_cnt' },
      { ...ok, tag_id: 'visit_level', tag_name: '重复的标签', table_security: '机密' },
    ]
    readCsv(toCsv(rows, keys), '演示文件.csv')
  }
  const okRows = rows?.filter((r) => !r.errors.length) || [], badRows = rows?.filter((r) => r.errors.length) || []
  function submitImport() {
    if (!okRows.length) return
    upsert(okRows.map((r) => r.asset), 'import')
    const log = { at: nowStamp().slice(0, 16), file: fileName, by: V.name, create: okRows.filter((r) => r.action === 'create').length, update: okRows.filter((r) => r.action === 'update').length, fail: badRows.length }
    setLogs((l) => [log, ...l])
    pushAudit?.(`批量导入资产：${fileName}，新增 ${log.create}、更新 ${log.update}、失败 ${log.fail}`)
    message.success(`已提交 ${okRows.length} 个资产审核${badRows.length ? `，${badRows.length} 行待修正` : ''}`)
    setRows(badRows.length ? badRows : null)
    if (!badRows.length) setTab('list')
  }
  function downloadErrors() {
    download('资产导入-错误清单.csv', toCsv(badRows.map((r) => ({ ...r.asset, line: r.line, errors: r.errors.join('；') })), ['line', 'errors', ...FIELDS.map((f) => f.key)]))
  }

  /* ---- 审核与上下线 ---- */
  function approve(a) { setAssets((old) => old.map((x) => (x.tag_id === a.tag_id ? { ...x, status: x.wanted === 'off' ? 'off' : 'online', updated: nowStamp().slice(0, 16) } : x))); pushAudit?.(`审核通过资产：${a.tag_name}`); message.success('已审核通过') }
  function goOnline(a) { setAssets((old) => old.map((x) => (x.tag_id === a.tag_id ? { ...x, status: 'pending', wanted: 'online' } : x))); message.success('已提交上线审核') }
  function confirmOff() {
    if (offReason.trim().length < 4) return
    setAssets((old) => old.map((x) => (x.tag_id === offTarget.tag_id ? { ...x, status: 'off', offReason: offReason.trim(), updated: nowStamp().slice(0, 16) } : x)))
    pushAudit?.(`下线资产：${offTarget.tag_name}，原因：${offReason.trim()}`)
    message.success('已下线，标签广场不再展示'); setOffTarget(null); setOffReason('')
  }

  const shown = assets.filter((a) => !filter || a.status === filter)
  const list = (
    <>
      <div className="asset-kpis">
        {[['', '资产总数', stats.all], ['online', '已上线', stats.online], ['pending', '待审核', stats.pending], ['off', '已下线', stats.off]].map(([k, t, v]) => (
          <button key={t} type="button" className={`asset-kpi${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}><Statistic title={t} value={v} /></button>
        ))}
      </div>
      <Card title="资产列表" extra={<Space><Button onClick={() => setTab('import')}>批量导入</Button><Button type="primary" onClick={newAsset}>单个录入</Button></Space>}>
        <table className="asset-table">
          <thead><tr><th>标签</th><th>来源域 · 来源表.字段</th><th>时效 · 更新频率</th><th>覆盖率</th><th>最终生效密级</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>{shown.map((a) => (
            <tr key={a.tag_id}>
              <td><b>{a.tag_name}</b><small>{a.tag_id}</small></td>
              <td>{a.source_system}<small>{a.source_table}.{a.source_field}</small></td>
              <td>{freqText(a)}</td>
              <td>{a.coverage}%</td>
              <td><LevelChip level={a.effective_column_level} />{a.column_security_level && a.effective_column_level !== a.table_security && <small className="asset-up">列密级升档（表密级 {a.table_security}）</small>}</td>
              <td><Tag color={a.status === 'online' ? 'success' : a.status === 'pending' ? 'warning' : undefined}>{STATUS_LABEL[a.status]}</Tag>{a.status === 'off' && a.offReason && <small>{a.offReason}</small>}</td>
              <td className="asset-ops">
                <Button type="link" size="small" onClick={() => editAsset(a)}>编辑</Button>
                {a.status === 'online' && <Button type="link" size="small" onClick={() => setOffTarget(a)}>下线</Button>}
                {a.status === 'off' && <Button type="link" size="small" onClick={() => goOnline(a)}>重新上线</Button>}
                {a.status === 'pending' && (isAdmin ? <Button type="link" size="small" onClick={() => approve(a)}>审核通过</Button> : <span className="asset-muted">等待平台审核</span>)}
              </td>
            </tr>
          ))}</tbody>
        </table>
        {!shown.length && <p className="asset-muted asset-empty">没有符合条件的资产</p>}
      </Card>
    </>
  )

  const eff = effectiveLevel(form.table_security, form.column_security_level)
  const input = (k, props = {}) => <input className="au-input" id={`asset-${k}`} value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={FIELDS.find((f) => f.key === k)?.example ? '如 ' + FIELDS.find((f) => f.key === k).example : ''} {...props} />
  const select = (k, opts, empty) => <select className="au-input" id={`asset-${k}`} value={form[k]} onChange={(e) => set(k, e.target.value)}>{empty && <option value="">{empty}</option>}{opts.map((o) => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}</select>
  const field = (k, el, wide) => { const f = FIELDS.find((x) => x.key === k); return <label className={`asset-field${wide ? ' wide' : ''}`} htmlFor={`asset-${k}`}><span>{f.label}{f.required && <i>*</i>}</span>{el}{f.hint && <small>{f.hint}</small>}</label> }
  const formView = (
    <Card title={editing ? `编辑资产 · ${editing}` : '单个录入'} extra={<Button onClick={() => setTab('list')}>返回列表</Button>}>
      {formResult?.errors.length > 0 && <Alert type="error" message="请先修正以下问题" description={formResult.errors.join('；')} />}
      <section className="asset-group"><h4><b>1</b>基础展示</h4><div className="asset-grid">
        {field('tag_id', input('tag_id', { disabled: !!editing }))}
        {field('tag_name', input('tag_name'))}
        {field('description', <textarea className="au-textarea" id="asset-description" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="该标签的业务含义、加工逻辑…" />, true)}
        {field('coverage', input('coverage'))}
        <div className="asset-field"><span>时效类型 / 更新频率<i>*</i></span><div className="asset-pair">{select('timeliness', [{ v: '1', l: '1 · 离线' }, { v: '2', l: '2 · 实时' }])}{form.timeliness === '2' ? <input className="au-input" value="实时" disabled aria-label="更新频率" /> : select('update_freq', FREQ_OFFLINE)}</div><small>实时标签的更新频率固定为「实时」；离线标签选 T+1 或 T+7</small></div>
      </div></section>
      <section className="asset-group"><h4><b>2</b>责任溯源</h4><div className="asset-grid">
        {field('owner', input('owner', { list: 'asset-owners' }))}
        {field('owner_team', input('owner_team'))}
        {field('source_system', select('source_system', SOURCES, '请选择来源域'))}
        {field('source_table', input('source_table', { list: 'asset-tables' }))}
        {field('source_field', form.source_table && DEMO_TABLES[form.source_table] ? select('source_field', DEMO_TABLES[form.source_table], '请选择字段') : input('source_field'))}
      </div></section>
      <section className="asset-group"><h4><b>3</b>密级与状态</h4><div className="asset-grid">
        {field('table_security', select('table_security', SECURITY, '请选择表密级'))}
        {field('column_security_level', select('column_security_level', SECURITY, '无单独列密级'))}
        <div className="asset-field"><span>最终生效密级（系统计算）</span><div className="asset-eff">{eff ? <LevelChip level={eff} /> : <span className="asset-muted">选择表密级后自动计算</span>}{eff && form.column_security_level && eff !== form.table_security && <small className="asset-up">列密级高于表密级，已升档</small>}</div><small>取表密级与列密级中较高的一级</small></div>
        {field('status', select('status', [{ v: 'online', l: 'online · 审核通过后上线' }, { v: 'off', l: 'off · 暂不上线' }]))}
      </div></section>
      <datalist id="asset-owners">{DEMO_OWNERS.map((o) => <option key={o} value={o} />)}</datalist>
      <datalist id="asset-tables">{Object.keys(DEMO_TABLES).map((o) => <option key={o} value={o} />)}</datalist>
      {formResult?.notes.length > 0 && <Alert type="info" message={formResult.notes.join('；')} />}
      <div className="asset-actions"><span className="asset-muted">提交后进入「待审核」，审核通过后在标签广场上线</span><Space><Button onClick={() => setTab('list')}>取消</Button><Button type="primary" onClick={submitForm}>{editing ? '保存并提交审核' : '提交审核'}</Button></Space></div>
    </Card>
  )

  const importView = (
    <Card title="批量导入" extra={<Button onClick={() => setTab('list')}>返回列表</Button>}>
      <ol className="asset-steps">
        <li><b>1</b><div><strong>下载模板</strong><p>列名即字段名，含填写说明与示例行</p><Button size="small" onClick={() => download('资产导入模板.csv', templateCsv())}>下载导入模板</Button></div></li>
        <li><b>2</b><div><strong>填写并上传</strong><p>一行一个标签，CSV 格式，单次最多 {MAX_ROWS} 行</p><Space><Button size="small" type="primary" onClick={() => fileRef.current?.click()}>上传 CSV</Button><Button size="small" onClick={demoFile}>用演示文件试试</Button></Space><input ref={fileRef} type="file" accept=".csv" hidden onChange={onFile} /></div></li>
        <li><b>3</b><div><strong>校验、修正、提交</strong><p>以标签 ID 识别新增 / 更新；通过的行可先提交，错误行留下修正</p></div></li>
      </ol>
      <details className="asset-spec"><summary>查看字段说明（{FIELDS.length} 列）</summary><table className="asset-table"><thead><tr><th>列名</th><th>名称</th><th>必填</th><th>说明</th></tr></thead><tbody>{FIELDS.map((f) => <tr key={f.key}><td><code>{f.key}</code></td><td>{f.label}</td><td>{f.required ? '是' : f.key === 'update_freq' ? '离线必填' : '否'}</td><td>{f.hint}</td></tr>)}<tr><td><code>effective_column_level</code></td><td>最终生效密级</td><td>—</td><td>系统计算，文件中填写会被忽略</td></tr></tbody></table></details>
      {fileError && <Alert type="warning" message={fileError} />}
      {rows && <>
        <div className="asset-result-bar"><span>{fileName} · 共 {rows.length} 行：<b className="ok">✅ 新增 {okRows.filter((r) => r.action === 'create').length}</b><b className="up">🔄 更新 {okRows.filter((r) => r.action === 'update').length}</b><b className="bad">❌ 错误 {badRows.length}</b></span>
          <Space>{badRows.length > 0 && <Button size="small" onClick={downloadErrors}>下载错误清单</Button>}<Button size="small" type="primary" disabled={!okRows.length} onClick={submitImport}>提交通过的 {okRows.length} 行</Button></Space></div>
        <table className="asset-table">
          <thead><tr><th>行</th><th>结果</th><th>标签</th><th>时效 · 频率</th><th>最终生效密级</th><th>说明</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.line} className={r.errors.length ? 'is-bad' : ''}>
              <td>{r.line}</td>
              <td>{r.errors.length ? <Tag color="danger">错误</Tag> : r.action === 'update' ? <Tag color="primary">更新</Tag> : <Tag color="success">新增</Tag>}</td>
              <td><b>{r.asset.tag_name || '—'}</b><small>{r.asset.tag_id || '—'}</small></td>
              <td>{r.asset.timeliness ? freqText(r.asset) : '—'}</td>
              <td>{r.asset.effective_column_level ? <LevelChip level={r.asset.effective_column_level} /> : '—'}</td>
              <td className="asset-msgs">{r.errors.map((e) => <p key={e} className="bad">{e}</p>)}{r.notes.map((n) => <p key={n}>{n}</p>)}{r.action === 'update' && !r.errors.length && <p>将覆盖平台中已有的同 ID 资产</p>}</td>
            </tr>
          ))}</tbody>
        </table>
      </>}
    </Card>
  )

  const logView = (
    <Card title="导入记录">
      {logs.length ? <table className="asset-table"><thead><tr><th>时间</th><th>文件</th><th>操作人</th><th>新增</th><th>更新</th><th>失败</th></tr></thead><tbody>{logs.map((l, i) => <tr key={i}><td>{l.at}</td><td>{l.file}</td><td>{l.by}</td><td>{l.create}</td><td>{l.update}</td><td>{l.fail}</td></tr>)}</tbody></table> : <p className="asset-muted asset-empty">还没有导入记录</p>}
    </Card>
  )

  return (
    <>
      <div className="page-head"><div className="page-title">资产接入</div></div>
      <div className="asset-sop" aria-label="资产上传 SOP">{SOP.map((s, i) => <span key={s}><b>{i + 1}</b>{s}</span>)}</div>
      <Alert type="info" message="演示环境：Owner、来源表与字段按演示目录校验；审核通过需切换到「平台管理员」视角。" />
      <div style={{ height: 12 }} />
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'list', label: '资产列表', children: list },
        { key: 'form', label: editing ? '编辑资产' : '单个录入', children: formView },
        { key: 'import', label: '批量导入', children: importView },
        { key: 'logs', label: `导入记录${logs.length ? `（${logs.length}）` : ''}`, children: logView },
      ]} />
      {offTarget && <Modal open title={`下线资产 · ${offTarget.tag_name}`} onCancel={() => { setOffTarget(null); setOffReason('') }} footer={<Space><Button onClick={() => { setOffTarget(null); setOffReason('') }}>取消</Button><Button type="primary" disabled={offReason.trim().length < 4} onClick={confirmOff}>确认下线</Button></Space>}>
        <p className="asset-muted">下线后标签广场立即不再展示该标签。请填写下线原因（至少 4 个字）。</p>
        <textarea className="au-textarea" rows={3} value={offReason} onChange={(e) => setOffReason(e.target.value)} placeholder="如：上游表下线，口径停止维护" aria-label="下线原因" />
      </Modal>}
    </>
  )
}
