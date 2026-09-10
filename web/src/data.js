/* ============================================================
 * UTUP · 数据与业务判定（单一事实源）
 * 3 视角权限 / 4 档分级 / 跨域升档 / 可见性矩阵 / Triton·DMP 路由
 * ============================================================ */

export const VIEWS = {
  consumer: {
    name: '消费方', icon: '🛒', role: 'consumer', domain: '电商', wl: true,
    levels: ['开放', '通用', '受控', '高敏'],
    desc: 'POC 白名单成员，检索标签、查看详情、路由申请与查看进度；跨域调用自动升档',
  },
  supplier: {
    name: '供给方 · Owner', icon: '📦', role: 'supplier', domain: '电商', wl: true,
    /* 所属来源域：供给方工作台仅汇总本来源域的申请与收益；平台管理员不设此字段，可查看全部 */
    ownSrc: '电商DMP',
    levels: ['开放', '通用', '受控', '高敏'],
    desc: '来源域管理员，汇总本域申请状态 + 跳转 Triton 审批 + 效果回收',
  },
  platform: {
    name: '平台管理员', icon: '🛡️', role: 'platform', domain: '平台', wl: true,
    levels: ['开放', '通用', '受控', '高敏'],
    desc: '分级审批路由 / 跨域升档规则 / 审计日志',
  },
}

export const NAV = {
  consumer: [
    {
      group: '消费方',
      items: [
        { key: 'market', label: '标签广场' },
        { key: 'myperm', label: '我的申请 / 权限' },
        { key: 'income', label: '消费与收益录入' },
      ],
    },
    {
      group: '占位入口',
      items: [
        { key: 'dualq', label: '双 QI 看板', soon: true },
        { key: 'llm', label: 'LLM 侧写标签', soon: true },
      ],
    },
    {
      group: '平台能力',
      items: [{ key: 'audit', label: '审计日志' }],
    },
  ],
  supplier: [
    {
      group: '供给方',
      items: [
        { key: 'workbench', label: '供给方工作台' },
        { key: 'cfg', label: '配置中心' },
        { key: 'assetin', label: '资产接入' },
      ],
    },
    {
      group: '平台能力',
      items: [{ key: 'audit', label: '审计日志' }],
    },
  ],
  platform: [
    {
      group: '消费方',
      items: [
        { key: 'market', label: '标签广场' },
        { key: 'myperm', label: '我的申请 / 权限' },
        { key: 'income', label: '消费与收益录入' },
      ],
    },
    {
      group: '供给方',
      items: [
        { key: 'workbench', label: '供给方工作台' },
        { key: 'cfg', label: '配置中心' },
        { key: 'assetin', label: '资产接入' },
      ],
    },
    {
      group: '占位入口',
      items: [
        { key: 'dualq', label: '双 QI 看板', soon: true },
        { key: 'llm', label: 'LLM 侧写标签', soon: true },
      ],
    },
    {
      group: '平台能力',
      items: [{ key: 'audit', label: '审计日志' }],
    },
  ],
}

export const NAV_LABELS = {
  market: '标签广场',
  myperm: '我的申请 / 权限',
  income: '消费与收益录入',
  workbench: '供给方工作台',
  cfg: '配置中心',
  assetin: '资产接入',
  audit: '审计日志',
}

/* 四档分级规范 */
export const LEVELS = {
  开放: { code: 'L2', cls: 'l2', approve: '免审批 · 自助订阅', approver: '—', valid: '永久（默认 180 天）' },
  通用: { code: 'L3-基础', cls: 'l3', approve: '自助申请 + 留痕', approver: '平台自动通过', valid: '180 天' },
  受控: { code: 'L3-高', cls: 'l3', approve: '来源方 Owner 审批', approver: '标签 Owner / 团队', valid: '90 天' },
  高敏: { code: 'L4', cls: 'l4', approve: '来源方合规流程', approver: '跳转来源方审批系统 + 法务加签', valid: '30 天' },
}

export const LEVEL_ORDER = ['开放', '通用', '受控', '高敏']

/* 跨域升档映射：跨来源域调用时密级就高 */
export const CROSS_CFG = {
  开放: '开放',
  通用: '受控',
  受控: '高敏',
  高敏: '高敏',
}

export function upgrade(level) {
  return CROSS_CFG[level] || level
}

/* 审批路由：PSM 系统间调用走 DMP / LDMP；人消费标签走 Triton（门户不落工单） */
export function applyPath(tag) {
  return tag.callType === 'psm'
    ? {
        name: '系统间调用（PSM）',
        target: 'DMP / LDMP',
        detail: `PSM 申请 → 跳转 ${tag.domain === '生服' ? 'LDMP' : 'DMP'}，由其承接 PSM 归属校验与建单`,
      }
    : {
        name: '人消费标签',
        target: 'Triton',
        detail: `标签申请 → 定位上游 Hive 表 ${tag.table} → 深链跳转 Triton 发起`,
      }
}

/* 标签目录（27 条） */
export const TAGS = [
  {
    id: 14479, name: '电商支付交易单数分层', domain: '电商', level: '高敏', callType: 'tag',
    owner: '电商风控团队', team: '电商风控', src: '电商DMP', table: 'dwd_ecom_pay_order_di',
    cov: 92, freq: 'T+1',
    desc: '含支付金额与订单明细，直接关联资金账户，反查自然人；泄露可用于精准诈骗 / 套现。',
    enums: ['高消费(≥3000/月)', '中消费', '低消费', '无支付'], official: true,
  },
  {
    id: 14501, name: '电商消费力分层 ecom_consumption_level', domain: '电商', level: '受控', callType: 'tag',
    owner: '电商增长团队', team: '电商增长', src: '电商DMP', table: 'dws_ecom_consume_level_df',
    cov: 88, freq: 'T+1',
    desc: '刻画消费能力与偏好，滥用可导致差别定价 / 骚扰营销，是组合识别的高权重维度。',
    enums: ['S 高消费力', 'A', 'B', 'C 低消费力'], official: true,
  },
  {
    id: 14520, name: '品类偏好序列 Top10', domain: '电商', level: '受控', callType: 'tag',
    owner: '电商增长团队', team: '电商增长', src: '电商DMP', table: 'dws_ecom_cate_pref_df',
    cov: 81, freq: 'T+7',
    desc: '用户近 90 天一级 / 二级类目偏好序列，用于人群圈选与推荐。',
    enums: ['3C数码', '美妆个护', '服饰鞋包', '食品生鲜', '母婴'], official: true,
  },
  {
    id: 14533, name: '活跃天数分层（近 30 天）', domain: '电商', level: '通用', callType: 'tag',
    owner: '电商数据团队', team: '电商数据', src: '电商DMP', table: 'dws_ecom_active_days_df',
    cov: 97, freq: 'T+1',
    desc: '粒度粗、群体大，单独识别度低；可叠加使用，故留痕可追、不免审。',
    enums: ['高活(≥20天)', '中活', '低活', '沉默'], official: true,
  },
  {
    id: 14540, name: '二级类目购买人群包', domain: '电商', level: '通用', callType: 'psm',
    owner: '电商数据团队', team: '电商数据', src: '电商DMP', table: 'dws_ecom_cate_buyer_df',
    cov: 90, freq: 'T+1',
    desc: '按二级类目聚合的购买人群，系统间调用场景，走 PSM 申请。',
    enums: ['美妆购买人群', '3C购买人群', '母婴购买人群'], official: false,
  },
  {
    id: 14555, name: '聚合类目分布（脱敏）', domain: '电商', level: '开放', callType: 'tag',
    owner: '电商数据团队', team: '电商数据', src: '电商DMP', table: 'ads_ecom_cate_dist_df',
    cov: 100, freq: 'T+1',
    desc: '已聚合脱敏、无个体指向，滥用面小，可自助订阅免审批。',
    enums: ['类目分布指数'], official: false,
  },
  {
    id: 14560, name: '退货退款率分层', domain: '电商', level: '受控', callType: 'tag',
    owner: '电商风控团队', team: '电商风控', src: '电商DMP', table: 'dws_ecom_refund_rate_df',
    cov: 85, freq: 'T+1',
    desc: '售后行为分层，与风控 / 商家体验强相关，滥用可致差别服务。',
    enums: ['低退款', '中退款', '高退款', '异常退款'], official: true,
  },
  {
    id: 14566, name: '客单价分层 avg_order_amount', domain: '电商', level: '通用', callType: 'tag',
    owner: '电商增长团队', team: '电商增长', src: '电商DMP', table: 'dws_ecom_aov_level_df',
    cov: 94, freq: 'T+1',
    desc: '近 90 天平均订单金额分层，用于人群圈选与价格带运营。',
    enums: ['高客单', '中客单', '低客单'], official: true,
  },
  {
    id: 14572, name: '加购收藏活跃度', domain: '电商', level: '通用', callType: 'tag',
    owner: '电商数据团队', team: '电商数据', src: '电商DMP', table: 'dws_ecom_cart_active_df',
    cov: 89, freq: 'T+1',
    desc: '加购 / 收藏行为频次分层，反映购买意向强度。',
    enums: ['高意向', '中意向', '低意向'], official: false,
  },
  {
    id: 14578, name: '大促敏感度分层', domain: '电商', level: '受控', callType: 'tag',
    owner: '电商增长团队', team: '电商增长', src: '电商DMP', table: 'dws_ecom_promo_sens_df',
    cov: 78, freq: 'T+7',
    desc: '对大促 / 优惠的响应敏感度，用于营销投放，避免过度骚扰。',
    enums: ['强敏感', '中敏感', '弱敏感', '不敏感'], official: true,
  },
  {
    id: 14584, name: '会员等级分布（脱敏）', domain: '电商', level: '开放', callType: 'tag',
    owner: '电商数据团队', team: '电商数据', src: '电商DMP', table: 'ads_ecom_member_dist_df',
    cov: 100, freq: 'T+1',
    desc: '会员等级聚合分布，无个体指向，可自助订阅。',
    enums: ['普通', '银卡', '金卡', '黑卡'], official: false,
  },
  {
    id: 14590, name: '直播互动活跃度', domain: '电商', level: '通用', callType: 'tag',
    owner: '电商内容团队', team: '电商内容', src: '电商DMP', table: 'dws_ecom_live_engage_df',
    cov: 73, freq: 'T+1',
    desc: '直播间观看 / 互动 / 转化行为分层，用于内容与货品匹配。',
    enums: ['高互动', '中互动', '低互动'], official: false,
  },
  {
    id: 14580, name: '生服到店消费频次', domain: '生服', level: '受控', callType: 'tag',
    owner: '生服数据团队', team: '生服数据', src: '生服LDMP', table: 'dws_life_visit_freq_df',
    cov: 76, freq: 'T+1',
    desc: '到店核销频次分层，跨域调用（电商消费方）将自动升档。',
    enums: ['高频', '中频', '低频'], official: true,
  },
  {
    id: 14606, name: '到店客单价分层', domain: '生服', level: '受控', callType: 'tag',
    owner: '生服数据团队', team: '生服数据', src: '生服LDMP', table: 'dws_life_aov_level_df',
    cov: 80, freq: 'T+1',
    desc: '到店消费客单价分层，用于本地生活商户运营。',
    enums: ['高客单', '中客单', '低客单'], official: true,
  },
  {
    id: 14612, name: '团购券核销率', domain: '生服', level: '通用', callType: 'tag',
    owner: '生服增长团队', team: '生服增长', src: '生服LDMP', table: 'dws_life_coupon_redeem_df',
    cov: 83, freq: 'T+1',
    desc: '团购 / 代金券核销行为分层，反映到店转化效率。',
    enums: ['高核销', '中核销', '低核销'], official: false,
  },
  {
    id: 14618, name: '到店品类偏好', domain: '生服', level: '通用', callType: 'tag',
    owner: '生服增长团队', team: '生服增长', src: '生服LDMP', table: 'dws_life_cate_pref_df',
    cov: 77, freq: 'T+7',
    desc: '到店餐饮 / 休闲 / 丽人等品类偏好，用于本地推荐。',
    enums: ['餐饮', '休闲娱乐', '丽人', '亲子'], official: false,
  },
  {
    id: 14624, name: '常驻商圈分层', domain: '生服', level: '高敏', callType: 'tag',
    owner: '生服数据团队', team: '生服数据', src: '生服LDMP', table: 'dwd_life_geo_zone_di',
    cov: 69, freq: 'T+7',
    desc: '含地理位置聚集特征，可反推居住 / 工作区域，属高敏，需法务加签。',
    enums: ['核心商圈', '社区商圈', '近郊', '跨城'], official: true,
  },
  {
    id: 14630, name: '到店时段偏好（脱敏）', domain: '生服', level: '开放', callType: 'tag',
    owner: '生服增长团队', team: '生服增长', src: '生服LDMP', table: 'ads_life_time_dist_df',
    cov: 100, freq: 'T+1',
    desc: '到店消费时段聚合分布，无个体指向，可自助订阅。',
    enums: ['工作日', '周末', '午市', '晚市'], official: false,
  },
  {
    id: 14602, name: 'LLM 深层心理画像', domain: '电商', level: '高敏', callType: 'tag',
    owner: 'AI 平台 · 侧写', team: 'AI平台', src: 'AI用户画像', table: 'dwd_llm_psy_profile_di',
    cov: 64, freq: 'T+7',
    desc: '侧写理解类标签，深层心理画像默认受控 / 高敏级，仅白名单可见入口。',
    enums: ['价格敏感型', '品质导向型', '冲动消费型'], official: false,
  },
  {
    id: 14610, name: '品类兴趣（LLM 侧写）', domain: '电商', level: '通用', callType: 'tag',
    owner: 'AI 平台 · 侧写', team: 'AI平台', src: 'AI用户画像', table: 'dwd_llm_cate_interest_di',
    cov: 70, freq: 'T+7',
    desc: '品类兴趣通用级侧写标签，可申请自助留痕。',
    enums: ['运动户外', '家居家装', '图书文娱'], official: false,
  },
  {
    id: 14640, name: '消费决策风格（LLM 推断）', domain: '电商', level: '受控', callType: 'tag',
    owner: 'AI 平台 · 侧写', team: 'AI平台', src: 'AI用户画像', table: 'dwd_llm_decision_style_di',
    cov: 61, freq: 'T+7',
    desc: '基于行为文本推断的决策风格，受控级，需 Owner 审批。',
    enums: ['理性比价型', '跟随推荐型', '品牌忠诚型'], official: false,
  },
  {
    id: 14646, name: '内容兴趣主题（LLM）', domain: '电商', level: '通用', callType: 'tag',
    owner: 'AI 平台 · 侧写', team: 'AI平台', src: 'AI用户画像', table: 'dwd_llm_content_topic_di',
    cov: 66, freq: 'T+7',
    desc: '内容消费兴趣主题聚类，用于内容与货品匹配。',
    enums: ['科技数码', '美食', '旅行', '健身'], official: false,
  },
  {
    id: 14652, name: '生命阶段推断（LLM）', domain: '电商', level: '受控', callType: 'tag',
    owner: 'AI 平台 · 侧写', team: 'AI平台', src: 'AI用户画像', table: 'dwd_llm_life_stage_di',
    cov: 58, freq: 'T+7',
    desc: '基于综合信号推断的生命阶段，敏感度较高，受控级。',
    enums: ['学生', '新职场', '已婚有娃', '银发'], official: false,
  },
  {
    id: 14660, name: '跨域消费力融合分', domain: '电商', level: '高敏', callType: 'tag',
    owner: '算法平台 · 融合', team: '算法平台', src: '双域算法资产', table: 'dwd_xd_consume_fusion_di',
    cov: 71, freq: 'T+7',
    desc: '融合电商 + 生服双域消费信号的综合评分，跨域高权重，属高敏。',
    enums: ['S', 'A', 'B', 'C'], official: true,
  },
  {
    id: 14666, name: '跨域生命周期阶段', domain: '电商', level: '受控', callType: 'tag',
    owner: '算法平台 · 融合', team: '算法平台', src: '双域算法资产', table: 'dws_xd_lifecycle_df',
    cov: 74, freq: 'T+7',
    desc: '结合双域行为判定的用户生命周期阶段，用于分层运营。',
    enums: ['新客', '成长', '成熟', '流失预警'], official: true,
  },
  {
    id: 14672, name: '双域高价值人群包', domain: '生服', level: '高敏', callType: 'psm',
    owner: '算法平台 · 融合', team: '算法平台', src: '双域算法资产', table: 'dws_xd_high_value_crowd_df',
    cov: 68, freq: 'T+7',
    desc: '双域高价值人群系统间调用，跨域 + 高敏，走 PSM + 法务加签。',
    enums: ['双域高价值', '电商高价值', '生服高价值'], official: false,
  },
  {
    id: 14678, name: '跨域流失预警分', domain: '电商', level: '受控', callType: 'tag',
    owner: '算法平台 · 融合', team: '算法平台', src: '双域算法资产', table: 'dws_xd_churn_risk_df',
    cov: 72, freq: 'T+1',
    desc: '融合双域活跃 / 消费衰减信号的流失预警评分，用于挽回运营。',
    enums: ['高流失风险', '中风险', '低风险'], official: true,
  },
]

/* 来源域 KPI */
export const CATALOG = [
  { d: '电商DMP', n: 2043 },
  { d: '生服LDMP', n: 1972 },
  { d: 'AI用户画像', n: 316 },
  { d: '双域算法资产', n: 57 },
]

/* 我的申请 / 权限（消费方只读镜像） */
export const INITIAL_MYPERM = [
  { id: 'APP-24098', tagId: 14533, tag: '活跃天数分层（近 30 天）', level: '通用', src: '电商DMP', status: '生效中', grantAt: '2026-07-20', valid: '2027-01-16', days: 131, scene: '人群圈选' },
  { id: 'APP-24112', tagId: 14555, tag: '聚合类目分布（脱敏）', level: '开放', src: '电商DMP', status: '生效中', grantAt: '2026-06-01', valid: '永久', days: 9999, scene: '数据分析' },
  { id: 'APP-24230', tagId: 14501, tag: '电商消费力分层', level: '受控', src: '电商DMP', status: '审批中', grantAt: '—', valid: '—', days: 0, scene: '营销投放' },
  { id: 'APP-24255', tagId: 14580, tag: '生服到店消费频次（跨域）', level: '高敏', src: '生服LDMP', status: '即将到期', grantAt: '2026-06-11', valid: '2026-09-11', days: 4, scene: '模型特征', cross: true },
  { id: 'APP-24301', tagId: 14602, tag: 'LLM 深层心理画像', level: '高敏', src: 'AI用户画像', status: '已拒绝', grantAt: '—', valid: '—', days: 0, scene: '模型特征', reject: '未提供收益测算与法务意见' },
]

/* 供给方工作台 · 本域申请审批（示例数据） */
export const APPROVALS = [
  { id: 'TKT-88012', applicant: '电商增长团队', tags: ['电商消费力分层'], src: '电商DMP', level: '受控', scene: '营销投放', at: '2026-09-05 14:22', status: '审批中', cross: false },
  { id: 'TKT-88030', applicant: '生服算法团队', tags: ['品类偏好序列 Top10', '电商消费力分层'], src: '电商DMP', level: '高敏', scene: '模型特征', at: '2026-09-06 09:10', status: '审批中', cross: true, up: '受控→高敏' },
  { id: 'TKT-88041', applicant: '电商数据团队', tags: ['二级类目购买人群包'], src: '电商DMP', level: '通用', scene: '人群圈选', at: '2026-09-06 16:48', status: '审批中', cross: false },
  { id: 'TKT-88055', applicant: '电商风控团队', tags: ['电商支付交易单数分层'], src: '电商DMP', level: '高敏', scene: '数据分析', at: '2026-09-07 08:30', status: '审批中', cross: false },
  { id: 'TKT-87990', applicant: '电商增长团队', tags: ['品类偏好序列 Top10'], src: '电商DMP', level: '受控', scene: '数据分析', at: '2026-09-03 11:05', status: '已通过', cross: false },
  { id: 'TKT-87965', applicant: '生服算法团队', tags: ['电商消费力分层'], src: '电商DMP', level: '受控', scene: '模型特征', at: '2026-09-02 15:40', status: '已拒绝', cross: false, reject: '用途说明不充分' },
  { id: 'TKT-88070', applicant: '电商增长团队', tags: ['生服到店消费频次'], src: '生服LDMP', level: '高敏', scene: '人群圈选', at: '2026-09-06 11:20', status: '审批中', cross: true, up: '受控→高敏' },
  { id: 'TKT-88083', applicant: '生服增长团队', tags: ['团购券核销率', '到店品类偏好'], src: '生服LDMP', level: '通用', scene: '营销投放', at: '2026-09-07 10:05', status: '已通过', cross: false },
  { id: 'TKT-88096', applicant: '电商风控团队', tags: ['常驻商圈分层'], src: '生服LDMP', level: '高敏', scene: '数据分析', at: '2026-09-04 17:12', status: '已拒绝', cross: true, up: '高敏→高敏', reject: '位置类数据缺少法务意见' },
  { id: 'TKT-88104', applicant: '电商数据团队', tags: ['品类兴趣（LLM 侧写）'], src: 'AI用户画像', level: '通用', scene: '模型特征', at: '2026-09-07 14:36', status: '审批中', cross: false },
  { id: 'TKT-88117', applicant: '算法平台 · 融合', tags: ['LLM 深层心理画像'], src: 'AI用户画像', level: '高敏', scene: '模型特征', at: '2026-09-05 09:48', status: '已拒绝', cross: false, reject: '侧写标签未提供白名单授权依据' },
  { id: 'TKT-88125', applicant: '电商增长团队', tags: ['跨域生命周期阶段'], src: '双域算法资产', level: '受控', scene: '营销投放', at: '2026-09-06 15:02', status: '审批中', cross: false },
  { id: 'TKT-88138', applicant: '生服算法团队', tags: ['双域高价值人群包'], src: '双域算法资产', level: '高敏', scene: '人群圈选', at: '2026-09-03 13:27', status: '已通过', cross: true, up: '高敏→高敏' },
]

/* 效果回收记录 */
export const INITIAL_INCOME = [
  { assets: ['电商消费力分层'], scene: '营销投放', income: 'ROI +12%（618 大促）', doc: '收益测算-618大促.docx', docUrl: 'https://bytedance.larkoffice.com/docx/demo618', by: '电商增长团队', at: '2026-09-05 10:20' },
  { assets: ['品类偏好序列 Top10', '电商消费力分层'], scene: '推荐特征', income: 'CTR +5.3%', doc: 'AB实验报告-推荐特征.docx', docUrl: 'https://bytedance.larkoffice.com/docx/demoAB', by: '电商数据团队', at: '2026-09-03 16:40' },
  { assets: ['团购券核销率'], scene: '营销投放', income: '到店核销率 +8.1%', doc: '本地生活券投放复盘.docx', docUrl: 'https://bytedance.larkoffice.com/docx/demoLife', by: '生服增长团队', at: '2026-09-04 11:15' },
  { assets: ['跨域生命周期阶段'], scene: '人群圈选', income: '沉睡用户召回率 +6.4%', doc: '跨域召回实验小结.docx', docUrl: 'https://bytedance.larkoffice.com/docx/demoXD', by: '算法平台 · 融合', at: '2026-09-02 09:30' },
]

/* 来源域合规文档 */
export const COMPLIANCE = {
  电商DMP: {
    title: '《中国电商外部用户数据采买规范_26Q3》',
    url: 'https://bytedance.larkoffice.com/wiki/WvMSw2O3ViC0tCkA2Cqcq2nNn8f',
    note: '电商用户数据对外供给须遵循外采规范；跨域 / 高敏使用需走源头合规审批。',
  },
  生服LDMP: {
    title: '《本地生活数据使用合规规范》',
    url: 'https://bytedance.larkoffice.com/wiki/demoLDMP',
    note: '到店 / 地理类数据涉及位置敏感，跨域调用自动升档并加签合规。',
  },
  AI用户画像: {
    title: '《LLM 侧写标签使用合规须知》',
    url: 'https://bytedance.larkoffice.com/wiki/demoLLM',
    note: '侧写理解类标签默认受控 / 高敏，仅白名单可见，需走跨域申请流程。',
  },
  双域算法资产: {
    title: '《跨域数据融合使用合规规范》',
    url: 'https://bytedance.larkoffice.com/wiki/demoXD',
    note: '融合双域信号的资产属跨域高权重，密级就高、审批更严。',
  },
}

/* 资产名 → 来源域：收益记录只存标签名，按名反查其所属来源域 */
export function srcOfAsset(name) {
  return TAGS.find((t) => t.name === name)?.src || ''
}

/* 一条收益记录涉及的全部来源域（一条记录可关联多个标签） */
export function srcsOfIncome(record) {
  return [...new Set((record.assets || [record.tag] || []).map(srcOfAsset).filter(Boolean))]
}

export function complianceOf(tag) {
  return COMPLIANCE[tag.src] || COMPLIANCE.电商DMP
}

/* 审计日志 */
export const INITIAL_AUDIT = [
  { time: '2026-09-07 08:31:02', who: 'user', what: '查看标签详情：电商支付交易单数分层', lvl: '高敏', risk: '记录' },
  { time: '2026-09-07 08:30:41', who: 'user', what: '标签广场检索：关键词=消费力', lvl: '—', risk: '记录' },
  { time: '2026-09-06 16:49:10', who: '电商数据团队', what: '唤起 DMP SDK 申请抽屉：二级类目购买人群包', lvl: '通用', risk: '记录' },
  { time: '2026-09-06 09:11:55', who: '生服算法团队', what: '跨域升档触发：受控→高敏（品类偏好序列）', lvl: '高敏', risk: '关注' },
  { time: '2026-09-05 14:23:08', who: '电商增长团队', what: '申请提交成功：电商消费力分层 · 单号 TKT-88012', lvl: '受控', risk: '记录' },
  { time: '2026-09-05 10:12:33', who: 'user', what: '访问双 QI 看板：电商×双QI 交易概览', lvl: '—', risk: '关注' },
  { time: '2026-09-04 19:02:17', who: 'user', what: '访问 LLM 侧写 tab：品类兴趣（LLM 侧写）', lvl: '通用', risk: '记录' },
]

/* 可见性矩阵：依据视角（白名单 / 归属域）与标签分级、是否跨域，给出脱敏 / 可申请 / 升档结果 */
export function visibility(view, tag) {
  const wl = view.wl
  const cross = tag.domain !== view.domain && view.domain !== '平台'
  const level = tag.level
  const eff = cross ? upgrade(level) : level

  if (level === '开放') {
    return { visible: true, real: true, canApply: true, cross, eff, reason: '自助订阅免审批' }
  }
  if (level === '通用') {
    return { visible: true, real: true, canApply: true, cross, eff, reason: '自助申请留痕' }
  }
  if (level === '受控') {
    return wl
      ? { visible: true, real: false, canApply: true, cross, eff, reason: 'Owner 审批' }
      : { visible: true, real: false, canApply: false, cross, eff, reason: '非白名单，请走本域 POC 前置收口' }
  }
  return wl
    ? { visible: true, real: false, canApply: true, cross, eff, reason: '跳来源方合规流程 + 法务加签' }
    : { visible: false, real: false, canApply: false, cross, eff, reason: '非白名单，高敏标签不可见' }
}

export function nowStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
