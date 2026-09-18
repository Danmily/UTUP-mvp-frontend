/* ============================================================
 * Aurora Design 4.0 — 本地同名组件库（fallback）
 * 仅当未安装内网真实组件库 @ecom/aurora 时，由 Vite 别名接管。
 * API 风格对齐 Aurora / AntD（Button、Layout、Menu、Tabs、Table、
 * Modal、Form、Select、Tag、Alert、message 等），业务代码统一
 * `import { ... } from '@ecom/aurora'`，切换真实库时无需改动。
 * ============================================================ */
import React, {
  createContext, useContext, useState, useEffect, useRef, useCallback,
} from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import './aurora.css'

/* ---------------- ConfigProvider / theme ---------------- */
const ThemeContext = createContext({ token: {} })
export function ConfigProvider({ theme = {}, children }) {
  const token = theme.token || {}
  const style = {}
  if (token.colorPrimary) style['--au-primary'] = token.colorPrimary
  if (token.colorSuccess) style['--au-success'] = token.colorSuccess
  if (token.colorWarning) style['--au-warning'] = token.colorWarning
  if (token.colorError) style['--au-danger'] = token.colorError
  if (token.borderRadius != null) style['--au-radius'] = `${token.borderRadius}px`
  return (
    <ThemeContext.Provider value={{ token }}>
      <div className="au-root" style={style}>{children}<MessageContainer /></div>
    </ThemeContext.Provider>
  )
}
export const useTheme = () => useContext(ThemeContext)

/* ---------------- message（全局轻提示） ---------------- */
let pushMessage = null
const MessageContainer = () => {
  const [list, setList] = useState([])
  useEffect(() => {
    pushMessage = (type, content) => {
      const id = Math.random().toString(36).slice(2)
      setList((l) => [...l, { id, type, content }])
      setTimeout(() => setList((l) => l.filter((m) => m.id !== id)), 2600)
    }
    return () => { pushMessage = null }
  }, [])
  const icon = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️', loading: '⏳' }
  return (
    <div className="au-message-container">
      {list.map((m) => (
        <div key={m.id} className={`au-message au-message-${m.type}`}>
          <span>{icon[m.type] || 'ℹ️'}</span><span>{m.content}</span>
        </div>
      ))}
    </div>
  )
}
export const message = {
  success: (c) => pushMessage?.('success', c),
  error: (c) => pushMessage?.('error', c),
  warning: (c) => pushMessage?.('warning', c),
  info: (c) => pushMessage?.('info', c),
  loading: (c) => pushMessage?.('loading', c),
}

/* ---------------- Typography ---------------- */
export const Typography = {
  Title: ({ level = 2, children, style }) => {
    const Tag = `h${Math.min(level, 4)}`
    const cls = { 1: 'au-typography-h1', 2: 'au-typography-h2', 3: 'au-typography-h3', 4: 'au-typography-h4' }[Math.min(level, 4)]
    return <Tag className={cls} style={style}>{children}</Tag>
  },
  Text: ({ type, children, strong, style }) => (
    <span className={`au-typography-text ${type === 'secondary' ? 'secondary' : ''}`}
      style={{ fontWeight: strong ? 600 : undefined, ...style }}>{children}</span>
  ),
  Paragraph: ({ children, style }) => <p className="au-typography-paragraph" style={style}>{children}</p>,
  Link: ({ children, onClick, href, style }) => (
    <a className="au-typography-link" href={href} onClick={onClick} style={style}>{children}</a>
  ),
}

/* ---------------- Button ---------------- */
export function Button({
  type = 'default', size, danger, disabled, loading, icon, block, htmlType,
  onClick, children, className = '', style, ghost,
}) {
  const cls = [
    'au-btn',
    type === 'primary' ? 'au-btn-primary' : type === 'text' ? 'au-btn-text'
      : type === 'link' ? 'au-btn-link' : type === 'dashed' ? 'au-btn-dashed' : 'au-btn-default',
    size === 'large' ? 'au-btn-lg' : size === 'small' ? 'au-btn-sm' : '',
    danger ? 'au-btn-danger' : '',
    block ? 'au-btn-block' : '',
    className,
  ].filter(Boolean).join(' ')
  return (
    <button type={htmlType || 'button'} className={cls} disabled={disabled || loading}
      onClick={onClick} style={style}>
      {loading ? '⏳' : icon}{children}
    </button>
  )
}
export const ButtonGroup = ({ children, style }) => <div className="au-btn-group" style={style}>{children}</div>

/* ---------------- Space / Grid / Divider ---------------- */
export function Space({ direction, size = 12, align, wrap, children, style, block }) {
  const gap = typeof size === 'number' ? size : 12
  return (
    <div className={`au-space ${direction === 'vertical' ? 'au-space-vertical' : ''} ${block ? 'au-space-block' : ''}`}
      style={{ gap, alignItems: align || (direction === 'vertical' ? 'flex-start' : 'center'), flexWrap: wrap ? 'wrap' : undefined, ...style }}>
      {React.Children.toArray(children).filter(Boolean).map((c, i) => (
        <React.Fragment key={i}>{c}</React.Fragment>
      ))}
    </div>
  )
}
export function Row({ gutter = 0, children, style }) {
  return <div className="au-row" style={{ margin: 0 - gutter / 2, ...style }}>
    {React.Children.map(children, (c) => React.isValidElement(c) ? React.cloneElement(c, { gutter }) : c)}
  </div>
}
export function Col({ span = 24, gutter = 0, children, style }) {
  const width = `calc(${(span / 24) * 100}% - ${gutter}px)`
  return <div className="au-col" style={{ width, padding: `0 ${gutter / 2}px`, ...style }}>{children}</div>
}
export function Divider({ type, style }) {
  return type === 'vertical'
    ? <hr className="au-divider-vertical" style={style} />
    : <hr className="au-divider" style={style} />
}

/* ---------------- Layout ---------------- */
export function Layout({ children, style, hasSider }) {
  return <section className={`au-layout ${hasSider ? 'au-layout-has-sider' : ''}`} style={style}>{children}</section>
}
Layout.Header = ({ children, style }) => <header className="au-header" style={style}>{children}</header>
Layout.Sider = ({ children, width, style }) => (
  <aside className="au-sider" style={{ width, flexBasis: width, ...style }}>{children}</aside>
)
Layout.Content = ({ children, style }) => <main className="au-content" style={style}>{children}</main>
Layout.Footer = ({ children, style }) => <footer className="au-footer" style={style}>{children}</footer>

/* ---------------- Menu ---------------- */
export function Menu({ items = [], selectedKeys = [], onSelect, mode = 'inline', style }) {
  return (
    <ul className="au-menu" style={style}>
      {items.map((it) => {
        if (it.type === 'group') {
          return (
            <li key={it.key || it.label}>
              <div className="au-menu-item-group-title">{it.label}</div>
              <ul className="au-menu" style={{ margin: 0, padding: 0 }}>
                {it.children?.map((c) => (
                  <li key={c.key}
                    className={['au-menu-item',
                      selectedKeys.includes(c.key) ? 'au-menu-item-selected' : '',
                      c.disabled ? 'au-menu-item-disabled' : ''].filter(Boolean).join(' ')}
                    onClick={() => !c.disabled && (onSelect ? onSelect(c) : c.onClick?.(c))}>
                    {c.icon && <span>{c.icon}</span>}<span>{c.label}</span>
                    {c.disabled && <span style={{ marginLeft: 'auto' }}>🔒</span>}
                  </li>
                ))}
              </ul>
            </li>
          )
        }
        return (
          <li key={it.key}
            className={['au-menu-item', selectedKeys.includes(it.key) ? 'au-menu-item-selected' : '',
              it.disabled ? 'au-menu-item-disabled' : ''].filter(Boolean).join(' ')}
            onClick={() => !it.disabled && (onSelect ? onSelect(it) : it.onClick?.(it))}>
            {it.icon && <span>{it.icon}</span>}<span>{it.label}</span>
          </li>
        )
      })}
    </ul>
  )
}

/* ---------------- Tabs ---------------- */
export function Tabs({ items = [], activeKey, onChange, type }) {
  const [inner, setInner] = useState(items[0]?.key)
  const key = activeKey || inner
  const current = items.find((i) => i.key === key) || items[0]
  return (
    <div>
      <div className="au-tabs-nav" role="tablist">
        {items.map((i) => (
          <button key={i.key} className={`au-tab ${i.key === key ? 'au-tab-active' : ''}`}
            onClick={() => { setInner(i.key); onChange?.(i.key) }}>{i.label}</button>
        ))}
      </div>
      <div>{current?.children}</div>
    </div>
  )
}

/* ---------------- Card ---------------- */
export function Card({ title, extra, children, style, bodyStyle, headStyle, bordered, className = '' }) {
  return (
    <div className={`au-card ${className}`} style={{ border: bordered === false ? 'none' : undefined, ...style }}>
      {(title || extra) && (
        <div className="au-card-head" style={headStyle}>
          <div className="au-card-head-title">{title}</div>
          <div>{extra}</div>
        </div>
      )}
      <div className="au-card-body" style={bodyStyle}>{children}</div>
    </div>
  )
}

/* ---------------- Tag / Badge ---------------- */
export function Tag({ color, children, style, icon }) {
  const cls = ['au-tag', color ? `au-tag-${color}` : ''].filter(Boolean).join(' ')
  return <span className={cls} style={style}>{icon}{children}</span>
}
export function Badge({ count, children }) {
  return <span className="au-badge">{children}{count > 0 && <span className="au-badge-count">{count > 99 ? '99+' : count}</span>}</span>
}

/* ---------------- Form ---------------- */
export function Form({ children, onFinish, layout, style }) {
  return <form className="au-form" style={style} onSubmit={(e) => { e.preventDefault(); onFinish?.() }}>{children}</form>
}
Form.Item = function Item({ label, required, children, style }) {
  return (
    <div className="au-form-item" style={style}>
      {label && <label className={`au-form-label ${required ? 'au-form-label-required' : ''}`}>{label}</label>}
      {children}
    </div>
  )
}

/* ---------------- Input / Select / controls ---------------- */
export function Input({ value, onChange, placeholder, prefix, suffix, style, onPressEnter, disabled }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', width: '100%', position: 'relative' }}>
      {prefix && <span style={{ position: 'absolute', left: 10, color: 'var(--au-text-3)' }}>{prefix}</span>}
      <input className="au-input" value={value || ''} disabled={disabled}
        style={{ paddingLeft: prefix ? 32 : 12, paddingRight: suffix ? 32 : 12, ...style }}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onPressEnter?.(e)} />
      {suffix && <span style={{ position: 'absolute', right: 10, color: 'var(--au-text-3)' }}>{suffix}</span>}
    </span>
  )
}
export function TextArea({ value, onChange, placeholder, rows = 4, style }) {
  return <textarea className="au-textarea" rows={rows} value={value || ''} placeholder={placeholder}
    style={style} onChange={(e) => onChange?.(e.target.value)} />
}
export function Select({ value, onChange, options = [], placeholder, style, allowClear, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  const selected = options.find((o) => o.value === value)
  return (
    <div ref={ref} className={`au-select ${open ? 'au-select-open' : ''}`} style={style}
      onClick={() => !disabled && setOpen((o) => !o)}>
      <div className="au-select-inner">
        <span className={selected ? '' : 'au-select-placeholder'}>{selected ? selected.label : (placeholder || '请选择')}</span>
        <span className="au-select-arrow">▾</span>
      </div>
      {open && (
        <div className="au-select-dropdown">
          {allowClear && value !== undefined && value !== null && value !== '' && (
            <div className="au-select-option" onClick={() => { onChange?.(undefined); setOpen(false) }}>清空</div>
          )}
          {options.map((o) => (
            <div key={o.value} className={`au-select-option ${o.value === value ? 'au-select-option-selected' : ''}`}
              onClick={() => { onChange?.(o.value); setOpen(false) }}>{o.label}</div>
          ))}
        </div>
      )}
    </div>
  )
}
export function Radio({ checked, onChange, children, disabled }) {
  return <label className="au-radio" style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
    <input type="radio" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />{children}
  </label>
}
Radio.Group = function RadioGroup({ value, onChange, options, children }) {
  const kids = options ? options.map((o) => (
    <Radio key={o.value} checked={value === o.value} onChange={() => onChange?.(o.value)}>{o.label}</Radio>
  )) : children
  return <div className="au-space" style={{ gap: 16 }}>{kids}</div>
}
export function Checkbox({ checked, onChange, children, disabled }) {
  return <label className="au-checkbox" style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
    <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />{children}
  </label>
}
Checkbox.Group = function CheckboxGroup({ value = [], onChange, options }) {
  const toggle = (v, on) => onChange?.(on ? [...value, v] : value.filter((x) => x !== v))
  return <div className="au-space" style={{ gap: 16 }}>
    {options.map((o) => <Checkbox key={o.value} checked={value.includes(o.value)}
      onChange={(on) => toggle(o.value, on)}>{o.label}</Checkbox>)}
  </div>
}
export function Switch({ checked, onChange }) {
  return <button type="button" className={`au-switch ${checked ? 'au-switch-checked' : ''}`}
    onClick={() => onChange?.(!checked)} aria-pressed={checked} />
}

/* ---------------- Modal ---------------- */
export function Modal({ open, title, onOk, onCancel, children, footer, width, confirmLoading, okText = '确定', cancelText = '取消', okType = 'primary', wide }) {
  if (!open) return null
  return (
    <div className="au-modal-mask" onMouseDown={(e) => e.target === e.currentTarget && onCancel?.()}>
      <div className={`au-modal ${wide ? 'au-modal-wide' : ''}`} style={width ? { width } : undefined}
        role="dialog" aria-modal="true">
        <div className="au-modal-header">
          <div className="au-modal-title">{title}</div>
          <button className="au-modal-close" onClick={onCancel} aria-label="关闭">✕</button>
        </div>
        <div className="au-modal-body">{children}</div>
        {footer !== null && (
          <div className="au-modal-footer">
            {footer || (<>
              <Button onClick={onCancel}>{cancelText}</Button>
              <Button type={okType} loading={confirmLoading} onClick={onOk}>{okText}</Button>
            </>)}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- Alert ---------------- */
export function Alert({ type = 'info', message, description, showIcon = true }) {
  const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' }
  return (
    <div className={`au-alert au-alert-${type}`}>
      {showIcon && <span className="au-alert-icon">{icons[type]}</span>}
      <div>
        <div style={{ fontWeight: 500 }}>{message}</div>
        {description && <div style={{ marginTop: 2, opacity: 0.85 }}>{description}</div>}
      </div>
    </div>
  )
}

/* ---------------- Steps / Progress / Spin / Empty ---------------- */
export function Steps({ items = [], current = 0 }) {
  return (
    <div className="au-steps">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <div className={`au-step ${i < current ? 'au-step-finish' : i === current ? 'au-step-active' : ''}`}>
            <span className="au-step-num">{i < current ? '✓' : i + 1}</span><span>{it.title}</span>
          </div>
          {i < items.length - 1 && <span className="au-step-arrow">→</span>}
        </React.Fragment>
      ))}
    </div>
  )
}
export function Progress({ percent = 0, strokeColor }) {
  return <div className="au-progress"><div className="au-progress-bar"
    style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: strokeColor }} /></div>
}
export function Spin({ spinning = true, children, tip }) {
  if (!spinning) return children || null
  return <div className="au-spin-container"><span className="au-spin" />{tip && <span style={{ marginLeft: 10, color: 'var(--au-text-3)' }}>{tip}</span>}</div>
}
export function Empty({ description = '暂无数据' }) {
  return <div className="au-empty">📭<div style={{ marginTop: 8 }}>{description}</div></div>
}

/* ---------------- Statistic / Breadcrumb / Descriptions ---------------- */
export function Statistic({ title, value, prefix, suffix, valueStyle }) {
  return (
    <div className="au-statistic">
      {title && <div className="au-statistic-title">{title}</div>}
      <div className="au-statistic-content" style={valueStyle}>
        {prefix && <span className="au-statistic-prefix">{prefix}</span>}{value}{suffix && <span style={{ fontSize: 14, marginLeft: 2 }}>{suffix}</span>}
      </div>
    </div>
  )
}
export function Breadcrumb({ items = [] }) {
  return (
    <div className="au-breadcrumb">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="au-breadcrumb-sep">/</span>}
          <span className={i === items.length - 1 ? 'au-breadcrumb-current' : ''}>{it.title}</span>
        </React.Fragment>
      ))}
    </div>
  )
}
export function Descriptions({ items = [], column = 1, bordered = true, title }) {
  const rows = []
  for (let i = 0; i < items.length; i += column) rows.push(items.slice(i, i + column))
  return (
    <div>
      {title && <div style={{ fontWeight: 600, marginBottom: 10 }}>{title}</div>}
      <div className="au-descriptions">
        {rows.map((r, ri) => (
          <div className="au-descriptions-row" key={ri}>
            {r.map((it, ci) => (
              <div className="au-descriptions-item" key={ci}>
                <div className="au-descriptions-item-label">{it.label}</div>
                <div className="au-descriptions-item-value">{it.children}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
/* 悬停 / 聚焦时在锚点上方弹出；浮层挂到 body，避免被表格横向滚动等 overflow 容器裁切 */
export function Tooltip({ title, children }) {
  const [pos, setPos] = useState(null)
  const show = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    setPos({ left: r.left + r.width / 2, top: r.top })
  }
  const hide = () => setPos(null)
  useEffect(() => {
    if (!pos) return undefined
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [pos])
  return (
    <span className="au-tooltip-anchor" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {pos && title && createPortal(
        <span className="au-tooltip" role="tooltip" style={{ left: pos.left, top: pos.top }}>{title}</span>,
        document.body,
      )}
    </span>
  )
}

/* ---------------- Table（含客户端分页） ---------------- */
export function Table({
  dataSource = [], columns = [], rowKey = 'id', loading, pagination = true,
  onRow, rowClassName, size, style,
}) {
  const pageSize = (typeof pagination === 'object' && pagination.pageSize) || 10
  const [page, setPage] = useState(1)
  const total = dataSource.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const cur = Math.min(page, pages)
  const paged = pagination ? dataSource.slice((cur - 1) * pageSize, cur * pageSize) : dataSource
  const keyOf = (r, i) => (typeof rowKey === 'function' ? rowKey(r) : r[rowKey]) ?? i
  return (
    <div>
      <div className="au-table-wrapper" style={style}>
        <table className="au-table" style={size === 'small' ? { fontSize: 12 } : undefined}>
          <thead>
            <tr>{columns.map((c) => <th key={c.key || c.dataIndex} style={c.width ? { width: c.width } : undefined}>{c.title}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length}><Spin /></td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={columns.length}><Empty /></td></tr>
            ) : paged.map((r, i) => (
              <tr key={keyOf(r, i)} className={`${onRow ? 'au-table-row-clickable' : ''} ${rowClassName?.(r) || ''}`}
                onClick={() => onRow?.(r)}>
                {columns.map((c) => (
                  <td key={c.key || c.dataIndex}>{c.render ? c.render(r[c.dataIndex], r, i) : (r[c.dataIndex] ?? '—')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && total > pageSize && (
        <Space style={{ justifyContent: 'flex-end', width: '100%', marginTop: 12 }} size={8}>
          <Button size="small" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>上一页</Button>
          <span style={{ fontSize: 13, color: 'var(--au-text-3)' }}>{cur} / {pages}</span>
          <Button size="small" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>下一页</Button>
        </Space>
      )}
    </div>
  )
}

export default {
  ConfigProvider, message, Typography, Button, ButtonGroup, Space, Row, Col, Divider,
  Layout, Menu, Tabs, Card, Tag, Badge, Form, Input, TextArea, Select, Radio, Checkbox, Switch,
  Modal, Alert, Steps, Progress, Spin, Empty, Statistic, Breadcrumb, Descriptions, Tooltip, Table,
}
