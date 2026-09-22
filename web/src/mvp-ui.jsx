/* ============================================================
 * 业务通用展示组件（全部基于 @ecom/aurora 组件封装）
 * LevelChip / CrossBadge / ApplyTag / EffectTag / ValidText / RiskTag / DocCell
 * ============================================================ */
import { Tag, Tooltip, Typography } from '@ecom/aurora'
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
