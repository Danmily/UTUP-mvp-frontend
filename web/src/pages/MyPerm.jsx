import { useState, useMemo } from 'react'
import {
  Button, Card, Table, Modal, Descriptions, Alert, Statistic, Space, Tag, Typography, message,
} from '@ecom/aurora'
import { LEVELS, SOON_DAYS, INACTIVE_TIP, myPermRows, isActive, isExpired } from '../data.js'
import { LevelChip, CrossBadge, ApplyTag, EffectTag, ValidText } from '../mvp-ui.jsx'
import { useApplyFlow } from './Market.jsx'

/* 我的申请 / 权限（0918 改版）：用户标签权限列表
 * 一行 = 当前用户 × 一个标签，展示最新一次申请；不展示申请单号。
 * 申请状态取门户记录（只有「已申请」）；生效状态每次进入页面实时查询权限接口。
 * KPI：申请单数 ｜ 已生效 ｜ 已过期 */
const FILTER_LABEL = { active: '已生效', expired: '已过期' }

export default function MyPerm({ V, myapply, addApply, pushAudit }) {
  const [detailId, setDetailId] = useState(null)
  const [st, setSt] = useState('') // '' 全部 | active 已生效 | expired 已过期
  const applyFlow = useApplyFlow({ V, addApply, pushAudit })

  const rows = useMemo(() => myPermRows(V, myapply), [V, myapply])
  const stats = useMemo(() => ({
    tickets: myapply.length,
    active: rows.filter((r) => isActive(r.perm)).length,
    expired: rows.filter((r) => isExpired(r.perm)).length,
    soon: rows.filter((r) => isActive(r.perm) && r.perm.valid !== '永久' && r.perm.days <= SOON_DAYS),
  }), [rows, myapply])
  const list = rows.filter((r) => !st || (st === 'active' ? isActive(r.perm) : isExpired(r.perm)))
  const detail = detailId ? rows.find((r) => r.tagId === detailId) : null

  function reapply(tagId) {
    setDetailId(null)
    applyFlow.start(tagId)
  }

  const columns = [
    {
      title: '最新申请时间',
      dataIndex: 'last',
      width: 150,
      render: (v) => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{v.at}</span>,
    },
    {
      title: '标签',
      dataIndex: 'tag',
      render: (v, r) => (
        <span>
          {v}
          {r.cross && <> <CrossBadge>跨域</CrossBadge></>}
        </span>
      ),
    },
    { title: '分级', dataIndex: 'level', render: (v) => <LevelChip level={v} /> },
    { title: '来源域', dataIndex: 'src' },
    { title: '消费场景', dataIndex: 'last', key: 'scene', render: (v) => v.scene },
    { title: '申请状态', key: 'apply', render: () => <ApplyTag /> },
    { title: '生效状态', dataIndex: 'perm', render: (v) => <EffectTag perm={v} /> },
    { title: '有效期', dataIndex: 'perm', key: 'valid', render: (v) => <ValidText perm={v} /> },
    {
      title: '操作',
      key: 'op',
      width: 150,
      render: (v, r) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); setDetailId(r.tagId) }}>
            详情
          </Button>
          {!isActive(r.perm) && (
            <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); reapply(r.tagId) }}>
              再次申请
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const kpi = (key, title, value, trend, color) => (
    <div className={`kpi domain-kpi${st === key ? ' kpi-on' : ''}`} onClick={() => setSt(key)}>
      <Statistic title={title} value={value} valueStyle={color ? { color } : undefined} />
      <div className="kpi-trend">{trend}</div>
    </div>
  )

  return (
    <>
      <div className="page-head"><div className="page-title">我的申请 / 权限</div></div>
      <div className="kpi-row kpi-row-3">
        {kpi('', '📝 申请单数', stats.tickets, '经门户提交的申请次数')}
        {kpi('active', '✅ 已生效', stats.active, '当前有权限的标签', 'var(--ok)')}
        {kpi('expired', '⌛ 已过期', stats.expired, '权限已过期的标签，可再次申请续期', stats.expired ? 'var(--err)' : undefined)}
      </div>
      {stats.soon.length > 0 && (
        <>
          <Alert
            type="warning"
            showIcon
            message={`${stats.soon.map((r) => `「${r.tag}」剩 ${r.perm.days} 天`).join('、')}到期。门户暂不支持续期，需前往来源系统（风神平台 / DMP）重新发起申请。`}
          />
          <div style={{ height: 12 }} />
        </>
      )}
      <Card
        title="用户标签权限列表"
        extra={st && (
          <Tag color="primary" style={{ cursor: 'pointer' }}>
            <span onClick={() => setSt('')}>{FILTER_LABEL[st]} ✕</span>
          </Tag>
        )}
      >
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          每行是你对一个标签的权限；同一标签申请过多次时，展示最新一次申请。生效状态每次进入页面实时查询。
        </Typography.Text>
        <Table
          dataSource={list}
          columns={columns}
          rowKey="tagId"
          pagination={false}
          onRow={(r) => setDetailId(r.tagId)}
        />
      </Card>
      {detail && (
        <PermDetail r={detail} onClose={() => setDetailId(null)} onReapply={() => reapply(detail.tagId)} />
      )}
      {applyFlow.modal}
    </>
  )
}

function PermDetail({ r, onClose, onReapply }) {
  const lv = LEVELS[r.level]
  const active = isActive(r.perm)
  return (
    <Modal
      open
      width={600}
      title={<span>{r.tag} <LevelChip level={r.level} /></span>}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            续期 / 回收 / 冻结请前往来源系统操作
          </Typography.Text>
          <Space>
            <Button onClick={onClose}>关闭</Button>
            <Button onClick={() => { message.info('已在新页面打开风神平台申请记录'); onClose() }}>
              去风神平台查看 →
            </Button>
            {!active && <Button type="primary" onClick={onReapply}>再次申请 →</Button>}
          </Space>
        </div>
      }
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>tag_id {r.tagId} · {r.src}</Typography.Text>
      <div style={{ height: 12 }} />
      <Descriptions
        title="我的标签权限"
        bordered
        column={1}
        items={[
          { label: '申请状态', children: <ApplyTag /> },
          { label: '申请时间', children: `${r.last.at}${r.apps.length > 1 ? `（最新一次，共申请 ${r.apps.length} 次）` : ''}` },
          { label: '消费场景', children: r.last.scene },
          { label: '生效状态', children: <EffectTag perm={r.perm} /> },
          ...(r.perm ? [{ label: '有效期', children: <ValidText perm={r.perm} /> }] : []),
          { label: '审批方式', children: lv.approve },
        ]}
      />
      {!active && (
        <>
          <div style={{ height: 12 }} />
          <Alert type="warning" showIcon message={`当前无权限：${INACTIVE_TIP}`} />
        </>
      )}
    </Modal>
  )
}
