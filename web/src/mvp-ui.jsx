/* ============================================================
 * 业务通用展示组件（全部基于 @ecom/aurora 组件封装）
 * LevelChip / CrossBadge / StatusTag / RiskTag / DocCell
 * ============================================================ */
import { Tag, Typography } from '@ecom/aurora'
import { LEVELS } from './data.js'

const LV_COLOR = { 开放: 'primary', 通用: 'warning', 受控: 'warning', 高敏: 'danger' }

export function LevelChip({ level }) {
  const lv = LEVELS[level]
  if (!lv) return null
  return <Tag color={LV_COLOR[level]}>{level} · {lv.code}</Tag>
}

export function CrossBadge({ children }) {
  return (
    <Tag style={{ background: '#F5E8FF', color: '#722ED1', border: '1px solid #D3ADF7' }}>
      {children || '⚡ 跨域升档'}
    </Tag>
  )
}

const ST_COLOR = {
  生效中: 'success',
  已通过: 'success',
  审批中: 'primary',
  即将到期: 'warning',
  已拒绝: 'danger',
}

export function StatusTag({ status }) {
  return <Tag color={ST_COLOR[status]}>{status}</Tag>
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
