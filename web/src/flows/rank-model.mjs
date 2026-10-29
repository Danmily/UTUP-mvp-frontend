/* 热度榜（演示）：资产按近期申请与圈人引用计热度，场景按发起次数，线索按搜索热度；真实环境由埋点与数据服务提供 */
const h = (s) => { let x = 7; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) % 100003; return x }
export const RANGES = [['7d', '近 7 天', 1], ['30d', '近 30 天', 3.6]]

export function assetRank(tags, { range = '7d', domain = '' } = {}) {
  const k = RANGES.find((r) => r[0] === range)[2]
  return tags
    .filter((t) => !domain || t.domain === domain)
    .map((t) => {
      const apply = Math.round(((h(t.id) % 90) + 10 + (t.cov || 0) / 4) * k)
      const use = Math.round(((h(t.id + 'u') % 160) + 20) * k)
      const trend = (h(t.id + range) % 120) - 30
      return { id: t.id, name: t.name, domain: t.domain, level: t.level, owner: t.owner, apply, use, heat: apply * 3 + use, trend }
    })
    .sort((a, b) => b.heat - a.heat)
}

export const SCENES = [
  { name: '暑期大促 · 老客召回', domain: '电商', heat: 842, trend: 26, adopt: 71, q: '召回买过服饰或户外、近 90 天没有下单的老客，用于暑期大促' },
  { name: '门店到店获客', domain: '生服', heat: 615, trend: 11, adopt: 64, q: '为上海一家火锅门店找有火锅偏好、可能到店的潜在新客' },
  { name: '新品推广', domain: '电商', heat: 588, trend: -4, adopt: 58, q: '给波司登找对羽绒服感兴趣、近 90 天有服饰消费、中高消费能力的用户，用于新品推广' },
  { name: '跨域高价值用户', domain: '跨域', heat: 432, trend: 17, adopt: 49, q: '圈出电商消费较低、但生服消费较高的潜在高价值用户' },
  { name: '美妆沉默老客召回', domain: '电商', heat: 397, trend: -6, adopt: 66, q: '召回买过美妆、但最近一段时间没有下单的老用户，排除高退货人群' },
  { name: '生服发券 · 高核销人群', domain: '生服', heat: 351, trend: 9, adopt: 55, q: '找团购券核销率高、近 30 天有到店的用户，用于生服发券' },
]
export const TOPICS = [
  { name: '高温天气 · 防晒清凉', heat: 9620, trend: 142, source: '站内搜索热词', q: '圈出近 30 天浏览过防晒、清凉用品但未下单的用户，用于高温专场' },
  { name: '暑期出游 · 景区到店', heat: 8410, trend: 87, source: '历史相似任务', q: '为暑期出游人群推荐景区周边到店团购，排除近 30 天已核销用户' },
  { name: '开学季 · 学生换新', heat: 6930, trend: 64, source: '节点日历', q: '找近 90 天购买过文具、数码配件的学生人群，用于 8 月开学季换新' },
  { name: '露营装备', heat: 5120, trend: 33, source: '站内搜索热词', q: '找近 30 天收藏或加购露营装备、中高消费能力的用户' },
  { name: '奥运观赛 · 运动服饰', heat: 4380, trend: 21, source: '热点事件', q: '找关注体育赛事内容、近 90 天购买过运动服饰的用户' },
  { name: '中秋礼盒', heat: 3010, trend: 12, source: '节点日历', q: '找往年中秋购买过礼盒、近 90 天有食品饮料消费的用户' },
]
