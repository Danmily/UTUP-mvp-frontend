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
  /* 演示假设已能拿到审批结果：审批中不能重复申请，被拒绝后才能重新申请。
     真实环境门户读不到 Triton 单据状态，上线前需要解决状态来源。 */
  const latest = applies.filter(a => a.tagId === tag.id).sort((a,b) => b.at.localeCompare(a.at))[0]
  if (latest?.approval === 'rejected') return { code: 'rejected', label: '可申请', selectable: true, reason: '' }
  if (latest && (latest.approval === 'pending' || latest.submissionStatus === 'submitted' || (!latest.approval && !perm)))
    return { code: 'applied', label: '已申请', selectable: false, reason: '审批中：流转完成（通过或被拒绝）前不能重复申请' }
  if (isExpired(perm)) return { code: 'expired', label: '已过期', selectable: true, reason: '权限已过期，可以重新申请' }
  return { code: 'apply', label: '可申请', selectable: true, reason: '' }
}
/* 前端只展示三种状态：可使用 / 已申请 / 可申请。
   过期、被拒绝、需线下对接等内部状态都归入「可申请」（有些权限在门户上线前就已存在，统一按实时权限显示「可使用」） */
export function displayStatus(state) {
  if (state.code === 'active') return { code: 'active', label: '可使用' }
  if (state.code === 'applied') return { code: 'applied', label: '已申请' }
  return { code: 'apply', label: '可申请' }
}
export function togglePageSelection(selected, eligibleIds) {
  const all = eligibleIds.length > 0 && eligibleIds.every(id => selected.includes(id))
  return all ? selected.filter(id => !eligibleIds.includes(id)) : [...new Set([...selected,...eligibleIds])]
}
export function makeDraft(tags, previous) {
  return { scene: previous?.scene || '', description: previous?.description || '', evidence: previous?.evidence || '',
    tags, overrides: Object.fromEntries(tags.map(t => [t.id, previous?.overrides?.[t.id] || {}])), step: 'edit', error: '', outcome: 'success' }
}
/* 使用场景自带标准使用说明：前端只展示场景名，说明随申请一并提交 */
export const sceneNote = scene => SCENE_DESCRIPTIONS[scene] || ''
export function submittedPurpose(purpose) {
  const note = sceneNote(purpose.scene), extra = (purpose.description || '').trim()
  return { scene: purpose.scene, sceneNote: note, supplement: extra, description: extra ? `${note}\n补充说明：${extra}` : note }
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

export const PENDING_MAX = 100
export const PENDING_PAGE_SIZE = 10
export const pendingKey = view => `utup.pending-tags.v1.${view.role}.${view.domain}`
export function mergePending(current, added) { return [...new Set([...current, ...added])] }
export function parsePending(raw, knownIds) {
  try { const value=JSON.parse(raw || '[]');return Array.isArray(value)?[...new Set(value.filter(id=>knownIds.includes(id)))]:[] } catch { return [] }
}
