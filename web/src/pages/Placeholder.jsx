import { Card, Tag, Empty, Typography } from '@ecom/aurora'

const KIND = {
  cfg: {
    title: '配置中心',
    icon: '⚙️',
    head: '配置中心 · 规划中',
    desc: '分级 → 审批路由配置、跨域升档规则、白名单范围等平台配置能力将在后续版本开放，本期仅展示入口占位。',
    pills: ['分级审批路由', '跨域升档规则', '白名单范围'],
  },
  assetin: {
    title: '资产接入',
    icon: '📥',
    head: '资产接入 · 规划中',
    desc: '人消费标签接入（Hive 表 → Triton）、系统间调用接入（PSM → DMP / LDMP）、上架资产元数据登记与分级申报等能力将在后续版本开放，本期仅展示入口占位。',
    pills: ['人消费标签接入', '系统间调用接入', '资产上架 SOP'],
  },
}

export default function Placeholder({ kind }) {
  const c = KIND[kind] || KIND.cfg
  return (
    <>
      <div className="page-head"><div className="page-title">{c.title}</div></div>
      <Card bodyStyle={{ textAlign: 'center', padding: '56px 24px' }}>
        <div style={{ fontSize: 40, lineHeight: 1 }}>{c.icon}</div>
        <Typography.Title level={4} style={{ justifyContent: 'center', marginTop: 14 }}>
          {c.head}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ maxWidth: 520, margin: '8px auto 0', fontSize: 13 }}>
          {c.desc}
        </Typography.Paragraph>
        <div style={{ marginTop: 18, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {c.pills.map((p) => <Tag key={p}>{p}</Tag>)}
        </div>
        <div style={{ height: 16 }} />
        <Empty description="该模块为本期占位入口，能力规划中" />
      </Card>
    </>
  )
}
