/* 资产展示规则（1026 会议结论）：枚举示例 JSON、覆盖度 / 召回率 / tag 数量、敏感字段不展示枚举、豆包兴趣字段不上架。纯函数，便于测试 */
export const BIZ_DOMAINS = ['电商', '生服']

/* 不展示具体枚举值及示例的敏感字段：生服消费水平、生服兴趣信息、常驻经纬度 hash（工作 / 居住）、常驻 POI（工作 / 居住） */
const NO_ENUM_IDS = { 14580: '生服消费水平', 14606: '生服消费水平', 14618: '生服兴趣信息', 14624: '常驻位置（经纬度 hash / POI）' }
const NO_ENUM_RULES = [
  [/常驻.*(经纬度|POI|poi|位置)|经纬度\s*hash/i, '常驻位置（经纬度 hash / POI）'],
  [/生服.*(消费水平|消费力)/, '生服消费水平'],
  [/生服.*兴趣/, '生服兴趣信息'],
]
export function noEnumReason(t) {
  if (NO_ENUM_IDS[t.id]) return NO_ENUM_IDS[t.id]
  const text = `${t.name || ''} ${t.desc || ''}`
  return (NO_ENUM_RULES.find(([re]) => re.test(text)) || [])[1] || ''
}

/* 豆包相关兴趣字段不可上架：门户不展示，供给方接入时机审拦截 */
export const DELIST_RULE = '豆包相关兴趣字段不可上架'
export function isDelisted(t) {
  const text = `${t.name || t.tag_name || ''} ${t.desc || t.description || ''}`
  return /豆包/.test(text) && /兴趣/.test(text)
}

/* 资产指标：覆盖度取登记值；召回率与 tag 数量真实环境由数据服务提供，演示按资产 ID 生成稳定示例值 */
export function assetMetrics(t) {
  const recall = 62 + ((Number(t.id) * 7) % 33)
  return {
    coverage: t.cov != null && t.cov !== '' ? `${t.cov}%` : '—',
    recall: `${recall}%`,
    tagCount: Array.isArray(t.enums) ? t.enums.length : 0,
  }
}

/* 枚举示例 JSON：敏感字段只给出不展示原因，不输出枚举值与示例 */
export function enumJson(t) {
  const m = assetMetrics(t)
  const reason = noEnumReason(t)
  return {
    tag_id: t.id,
    tag_name: t.name,
    biz_domain: t.domain,
    coverage: m.coverage,
    recall: m.recall,
    tag_count: m.tagCount,
    enum_examples: reason ? `不展示（敏感字段：${reason}）` : (t.enums || []),
  }
}
