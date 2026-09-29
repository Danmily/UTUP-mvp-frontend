/* ============================================================
 * 页面兜底：接口异常、空数据、外部系统跳转失败
 * 评审用演示态（顶栏「正常 / 空数据 / 接口异常」）驱动，线上由真实请求状态驱动
 * ============================================================ */
import { Button, Empty, Alert, Space, Typography, message } from '@ecom/aurora'

/* 接口加载失败：给明确原因和重试入口，不留白屏 */
export function LoadFailed({ what = '数据', onRetry }) {
  return (
    <div className="fallback-box">
      <div className="fallback-ic">⚠️</div>
      <div className="fallback-title">{what}加载失败</div>
      <div className="fallback-desc">可能是网络波动或上游接口超时，请稍后重试；持续失败请联系门户值班同学。</div>
      {onRetry && <Button type="primary" size="small" onClick={onRetry}>重新加载</Button>}
    </div>
  )
}

/* 空数据：区分「本来就没有」和「筛选筛没了」，后者给清空筛选的出口 */
export function EmptyState({ title, desc, action }) {
  return (
    <Empty
      description={
        <>
          {title}
          {desc && <><br /><span style={{ fontSize: 12 }}>{desc}</span></>}
          {action && <><br /><div style={{ marginTop: 10 }}>{action}</div></>}
        </>
      }
    />
  )
}

/* 状态同步延迟提示：门户读到的状态可能落后于外部系统 */
export function SyncDelayTip({ children }) {
  return (
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      {children || '状态由外部系统同步，可能有几分钟延迟；如与外部系统不一致，以外部系统为准。'}
    </Typography.Text>
  )
}

/* 外部平台跳转：失败时不静默，给出手动打开的兜底 */
export function jumpExternal(name, ok = true) {
  if (ok) {
    message.info(`演示跳转目标：${name}。当前未配置真实链接，未打开外部页面。`)
    return
  }
  message.error(`${name}跳转失败：目标系统暂时不可用。可稍后重试，或在浏览器中手动打开${name}。`)
}

export { Space }
