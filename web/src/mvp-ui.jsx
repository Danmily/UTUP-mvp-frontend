/* ============================================================
 * 业务通用展示组件（全部基于 @ecom/aurora 组件封装）
 * LevelChip / CrossBadge / ApplyTag / EffectTag / ValidText / RiskTag / DocCell
 * ============================================================ */
import { useState } from 'react'
import { Button, Modal, Tag, Tooltip, Typography } from '@ecom/aurora'
import { ASSET_KEY } from './flows/asset-model.mjs'
import { LEVELS, SOON_DAYS, INACTIVE_TIP, levelLabel, isActive, isExpired } from './data.js'

/* 分级色板：开放绿 / 通用黄 / 受控橙 / 高敏红，四档一眼可分 */
const lvStyle = (k) => ({
  background: `var(--lv-${k}-bg)`,
  color: `var(--lv-${k})`,
  border: `1px solid var(--lv-${k}-bd)`,
  whiteSpace: 'nowrap',
})

export function LevelChip({ level }) {
  const lv = LEVELS[level]
  if (!lv) return null
  return <Tag style={lvStyle(lv.cls)}>{levelLabel(level)}</Tag>
}

export function CrossBadge({ children }) {
  return (
    <Tag style={{ background: '#F5E8FF', color: '#722ED1', border: '1px solid #D3ADF7' }}>
      {children || '跨域升档'}
    </Tag>
  )
}

/* 申请状态：门户只记录「是否提交过申请」，所以只有一种取值 */
export function ApplyTag() {
  return <Tag color="primary">已申请</Tag>
}

/* 生效状态：按「用户 × 标签」实时查询的权限结果；已申请但未生效时附问号释义 */
export function EffectTag({ perm, applied = true }) {
  if (isActive(perm)) return <Tag color="success">生效中</Tag>
  if (!applied) return <Tag>未生效</Tag>
  return (
    <span className="effect-tag">
      <Tag color="danger">未生效</Tag>
      <Tooltip title={INACTIVE_TIP}>
        <span className="q-icon" tabIndex={0} aria-label={INACTIVE_TIP}>?</span>
      </Tooltip>
    </span>
  )
}

/* 有效期 / 剩余：临近到期标橙，已过期标红 */
export function ValidText({ perm }) {
  if (!perm) return <span style={{ fontSize: 12, color: 'var(--mute)' }}>—</span>
  if (isExpired(perm)) return <span style={{ fontSize: 12, color: 'var(--err)' }}>已于 {perm.valid} 过期</span>
  if (perm.valid === '永久') return <span style={{ fontSize: 12 }}>永久</span>
  const soon = perm.days <= SOON_DAYS
  return (
    <span style={{ fontSize: 12, color: soon ? 'var(--warn)' : undefined }}>
      {perm.valid} · 剩 {perm.days} 天
    </span>
  )
}

export function RiskTag({ risk }) {
  return <Tag color={risk === '关注' ? 'warning' : 'primary'}>{risk}</Tag>
}

export function DocCell({ record }) {
  return record.docUrl ? (
    <Typography.Link href={record.docUrl} target="_blank">📄 {record.doc}</Typography.Link>
  ) : (
    <Tag>{record.doc}</Tag>
  )
}

/* 资产下线提醒（PRD 资产管理 · 下线影响处理）：受影响消费方（申请过该标签）在标签广场与「我的申请 / 权限」页顶部看到，
 * 可关闭，点击查看受影响的标签资产清单。下线记录来自资产管理（浏览器存储） */
const mdText = (d) => { const [, m, day] = String(d || '').split('-'); return m ? `${Number(m)}月${Number(day)}日` : d }
export function OfflineAlert({ myapply = [] }) {
  const [list] = useState(() => {
    const mine = new Set(myapply.map((a) => 'tag_' + a.tagId))
    try { return (JSON.parse(localStorage.getItem(ASSET_KEY)) || []).filter((a) => a.status === 'off' && a.offAt && mine.has(a.tag_id)) } catch { return [] }
  })
  const key = 'utup.offline-alert.closed:' + list.map((a) => a.tag_id + a.offAt).join(',')
  const [closed, setClosed] = useState(() => { try { return sessionStorage.getItem(key) === '1' } catch { return false } })
  const [open, setOpen] = useState(false)
  if (!list.length || closed) return null
  const close = () => { setClosed(true); try { sessionStorage.setItem(key, '1') } catch { /* 仅本次关闭 */ } }
  const text = list.length === 1
    ? `『${list[0].tag_name}』标签已于 ${mdText(list[0].offAt)} 下线，请注意`
    : `『${list[0].tag_name}』、『${list[1].tag_name}』${list.length > 2 ? `等 ${list.length} 个` : ''}标签已下线，请注意`
  return (
    <>
      <div className="offline-alert" role="alert">
        <span className="offline-alert-icon">⚠️</span>
        <span className="offline-alert-text">{text}</span>
        <Button type="link" size="small" onClick={() => setOpen(true)}>查看受影响的标签资产 →</Button>
        <button type="button" className="offline-alert-close" aria-label="关闭提醒" onClick={close}>×</button>
      </div>
      {open && <Modal open width={640} title="已下线的标签资产" onCancel={() => setOpen(false)} footer={<Button onClick={() => setOpen(false)}>关闭</Button>}>
        <p className="asset-muted">以下标签已由供给方下线：标签广场不再展示，相关权限与圈人任务将受影响，未完成的申请单已自动关闭。</p>
        <table className="asset-table"><thead><tr><th>标签</th><th>下线时间</th><th>下线原因</th></tr></thead>
          <tbody>{list.map((a) => <tr key={a.tag_id}><td><b>{a.tag_name}</b><small>{a.tag_id}</small></td><td>{a.offAt}</td><td>{a.offReason || '—'}</td></tr>)}</tbody></table>
      </Modal>}
    </>
  )
}
