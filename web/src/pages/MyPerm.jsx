import { useState, useMemo } from 'react'
import {
  Button, Card, Table, Modal, Descriptions, Alert, Statistic, Space, Typography, message,
} from '@ecom/aurora'
import { LEVELS } from '../data.js'
import { LevelChip, CrossBadge, StatusTag } from '../mvp-ui.jsx'

export default function MyPerm({ myperm }) {
  const [detailId, setDetailId] = useState(null)
  const stats = useMemo(() => ({
    granted: myperm.filter((p) => p.status === '生效中').length,
    pending: myperm.filter((p) => p.status === '审批中').length,
    soon: myperm.filter((p) => p.status === '即将到期').length,
    reject: myperm.filter((p) => p.status === '已拒绝').length,
  }), [myperm])
  const detail = detailId ? myperm.find((p) => p.id === detailId) : null

  const columns = [
    { title: '申请单号', dataIndex: 'id', width: 110, render: (v) => <code style={{ fontSize: 11 }}>{v}</code> },
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
    { title: '消费场景', dataIndex: 'scene' },
    { title: '状态', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    {
      title: '有效期 / 剩余',
      dataIndex: 'valid',
      render: (v, r) => {
        if (r.status === '生效中') {
          return <span style={{ fontSize: 12 }}>{r.valid === '永久' ? '永久' : `${r.valid} · 剩 ${r.days} 天`}</span>
        }
        if (r.status === '即将到期') {
          return <span style={{ fontSize: 12, color: 'var(--warn)' }}>{r.valid} · 剩 {r.days} 天</span>
        }
        return <span style={{ fontSize: 12, color: 'var(--mute)' }}>—</span>
      },
    },
    {
      title: '操作',
      key: 'op',
      width: 80,
      render: (v, r) => (
        <Button
          type="link"
          size="small"
          onClick={(e) => { e.stopPropagation(); setDetailId(r.id) }}
        >
          详情
        </Button>
      ),
    },
  ]

  return (
    <>
      <div className="page-head"><div className="page-title">我的申请 / 权限</div></div>
      <div className="kpi-row">
        <div className="kpi">
          <Statistic title="✅ 生效中" value={stats.granted} valueStyle={{ color: 'var(--ok)' }} />
          <div className="kpi-trend">按人聚合统计</div>
        </div>
        <div className="kpi">
          <Statistic title="⏳ 审批中" value={stats.pending} valueStyle={{ color: 'var(--p)' }} />
          <div className="kpi-trend">状态同步自来源系统</div>
        </div>
        <div className="kpi">
          <Statistic title="⚠️ 即将到期" value={stats.soon} valueStyle={{ color: 'var(--warn)' }} />
          <div className="kpi-trend">到期前提醒</div>
        </div>
        <div className="kpi">
          <Statistic title="✕ 已拒绝" value={stats.reject} valueStyle={{ color: 'var(--err)' }} />
          <div className="kpi-trend">可在来源系统重新提交</div>
        </div>
      </div>
      {stats.soon > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`有 ${stats.soon} 条权限即将到期，请及时处理，避免调用中断。门户暂不支持续期，需前往来源系统（Triton / DMP）重新发起申请。`}
        />
      )}
      <div style={{ height: stats.soon ? 12 : 0 }} />
      <Card title="权限与申请列表">
        <Table
          dataSource={myperm}
          columns={columns}
          rowKey="id"
          pagination={false}
          onRow={(r) => setDetailId(r.id)}
        />
      </Card>
      {detail && <PermDetail p={detail} onClose={() => setDetailId(null)} />}
    </>
  )
}

function PermDetail({ p, onClose }) {
  const lv = LEVELS[p.level]
  const days = p.days && p.days < 9999 && p.status !== '已拒绝' && p.status !== '审批中'
    ? ` · 剩 ${p.days} 天`
    : ''
  return (
    <Modal
      open
      width={620}
      title={<span>{p.tag} <LevelChip level={p.level} /></span>}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            续期 / 回收 / 冻结请前往来源系统操作
          </Typography.Text>
          <Space>
            <Button onClick={onClose}>关闭</Button>
            <Button
              type="primary"
              onClick={() => { message.info('已在新页面打开来源系统的工单详情'); onClose() }}
            >
              去来源系统查看 →
            </Button>
          </Space>
        </div>
      }
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{p.id} · {p.src}</Typography.Text>
      <div style={{ height: 12 }} />
      <Descriptions
        title="状态信息（只读，同步自来源系统）"
        bordered
        column={1}
        items={[
          { label: '当前状态', children: <StatusTag status={p.status} /> },
          { label: '消费场景', children: p.scene },
          { label: '授权时间', children: p.grantAt },
          { label: '有效期', children: `${p.valid}${days}` },
          { label: '审批方式', children: lv.approve },
          ...(p.reject
            ? [{ label: '拒绝原因', children: <span style={{ color: 'var(--err)' }}>{p.reject}</span> }]
            : []),
        ]}
      />
      <div style={{ height: 12 }} />
      <Alert
        type="info"
        showIcon
        message={`本期暂不展示审批节点与审批人；${
          p.status === '即将到期'
            ? '续期需前往来源系统重新发起。'
            : p.status === '已拒绝'
              ? '补充材料与重新提交请在来源系统完成。'
              : '审批中的状态以来源系统的工单为准。'
        }`}
      />
    </Modal>
  )
}
