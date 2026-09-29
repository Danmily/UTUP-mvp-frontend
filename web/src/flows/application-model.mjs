import { visibility, isActive, isExpired, livePerm, LEVELS } from '../data.js'

export const SCENE_DESCRIPTIONS = {
  人群圈选: '根据业务目标组合所申请标签，筛选符合条件的目标人群，并在获准的业务场景中使用。',
  用户360: '结合所申请标签补充用户画像，在获准平台查看用户偏好与行为特征，辅助业务分析。',
  模型特征: '将所申请标签作为当前业务模型的候选特征，在获准环境内完成特征验证与效果评估。',
  营销投放: '使用所申请标签筛选营销目标人群，支持获准渠道的活动投放及后续效果分析。',
  数据分析: '在获准的数据分析环境中使用所申请标签，分析目标用户群体的分布及行为差异。',
}
export function assetState(view, tag, applies, perm = livePerm(tag.id)) {
  if (isActive(perm)) return { code: 'active', label: '可使用', selectable: false, reason: '已有有效权限，无需重复申请' }
  const vis = visibility(view, tag)
  if (!vis.visible || !vis.canApply) return { code: 'visible', label: '需联系 POC', selectable: false, reason: vis.reason }
  if (tag.callType === 'psm') return { code: 'manual', label: '需线下对接', selectable: false, reason: '系统间实时调用需联系来源方产品，暂不纳入本次批量申请' }
  const records = applies.filter(a => a.tagId === tag.id).sort((a,b) => b.at.localeCompare(a.at))
  if (records[0]?.submissionStatus === 'submitted') return { code: 'applied', label: '已提交 · 待同步', selectable: false, reason: '本次演示已提交，请到我的申请查看；尚未获得权限' }
  if (isExpired(perm)) return { code: 'expired', label: '已过期', selectable: true, reason: '权限已过期，可以重新申请' }
  if (records.length) return { code: 'applied', label: '已申请 · 未生效', selectable: true, reason: '已有申请记录，审批详情请在来源系统核对后再申请' }
  return { code: 'apply', label: '可申请', selectable: true, reason: '' }
}
export function togglePageSelection(selected, eligibleIds) {
  const all = eligibleIds.length > 0 && eligibleIds.every(id => selected.includes(id))
  return all ? selected.filter(id => !eligibleIds.includes(id)) : [...new Set([...selected,...eligibleIds])]
}
export function makeDraft(tags, previous) {
  return { scene: previous?.scene || '', description: previous?.description || '', evidence: previous?.evidence || '',
    tags, overrides: Object.fromEntries(tags.map(t => [t.id, previous?.overrides?.[t.id] || {}])), step: 'edit', error: '', outcome: 'success' }
}
export function resolvedPurpose(draft, tag) {
  return draft.overrides[tag.id]?.custom ? draft.overrides[tag.id] : { scene: draft.scene, description: draft.description }
}
export function validateDraft(view, draft, applies) {
  if (!draft.tags.length) return '请至少选择一个标签'
  for (const tag of draft.tags) {
    const state = assetState(view,tag,applies)
    if (!state.selectable) return `${tag.name}：${state.reason}，请返回调整清单`
    const p = resolvedPurpose(draft,tag)
    if (!p.scene) return `${tag.name}：请选择使用场景`
    if ((p.description || '').trim().length < 5) return `${tag.name}：使用说明至少填写 5 个字符，并说明实际用途`
  }
  return ''
}
export function applicationRow(view, tag) {
  const v=visibility(view,tag),rule=LEVELS[v.eff]
  return { tag, effectiveLevel:v.eff, cross:v.cross, owner:tag.owner, approval:rule.approve, validity:rule.valid }
}
export function submissionPlan(draft, retry = false) {
  return draft.tags.map((tag,i) => ({tag, purpose:resolvedPurpose(draft,tag), success:retry || draft.outcome!=='partial' || i!==draft.tags.length-1}))
}
