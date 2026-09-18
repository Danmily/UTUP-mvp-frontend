import { useState, useMemo } from 'react'
import {
  Button, Card, Table, Modal, Descriptions, Alert, Statistic, Space, Tag, Typography, message,
} from '@ecom/aurora'
import { LEVELS, SOON_DAYS, INACTIVE_TIP, myPermRows } from '../data.js'
import { LevelChip, CrossBadge, ApplyTag, EffectTag, ValidText } from '../mvp-ui.jsx'
import { useApplyFlow } from './Market.jsx'

/* 我的申请 / 权限（0917 改版）
 * 一行 = 当前用户 × 一个标签。申请状态取门户记录（只有「已申请」）；
 * 生效状态每次进入页面实时查询权限接口，与 Triton 申请单状态无关。 */
export default function MyPerm({ V, myapply, addApply, pushAudit }) {
  const [detailId, setDetailId] = useState(null)
  const [st, setSt] = useState('') // '' 全部已申请 | active 生效中 | inactive 已申请未生效
  const applyFlow = useApplyFlow({ V, addApply, pushAudit })

  const rows = useMemo(() => myPermRows(V, myapply), [V, myapply])
  const stats = useMemo(() => {
    const active = rows.filter((r) => r.perm).length
    return {
      applied: rows.length,
      active,
      inactive: rows.length - active,
      soon: rows.filter((r) => r.perm && r.perm.valid !== '永久' && r.perm.days <= SOON_DAYS),
    }
  }, [rows])
  const list = rows.filter((r) => !st || (st === 'active' ? !!r.perm : !r.perm))
  const detail = detailId ? rows.find((r) => r.tagId === detailId) : null

  function reapply(tagId) {
    setDetailId(null)
    applyFlow.start(tagId)
  }

  const columns = [
    {
      title: '申请时间',
      dataIndex: 'last',
      width: 150,
      render: (v, r) => (
        <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {v.at}
          <span className="row-sub">
            <code style={{ fontSize: 11 }}>{v.ticket}</code>
            {r.apps.length > 1 && ` · 共 ${r.apps.length} 次`}
          </span>
        </span>
      ),
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
    { title: '有效期 / 剩余', dataIndex: 'perm', key: 'valid', render: (v) => <ValidText perm={v} /> },
    {
      title: '操作',
      key: 'op',
      width: 150,
      render: (v, r) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); setDetailId(r.tagId) }}>
            详情
          </Button>
          {!r.perm && (
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
        {kpi('', '📝 已申请', stats.applied, '按标签去重统计')}
        {kpi('active', '✅ 生效中', stats.active, '实时查询本人 × 标签权限', 'var(--ok)')}
        {kpi('inactive', '⏸ 已申请未生效', stats.inactive, '审批未通过或权限已过期，可筛出续期', stats.inactive ? 'var(--err)' : undefined)}
      </div>
      {stats.soon.length > 0 && (
        <>
          <Alert
            type="warning"
            showIcon
            message={`${stats.soon.map((r) => `「${r.tag}」剩 ${r.perm.days} 天`).join('、')}到期。门户暂不支持续期，需前往来源系统（Triton / DMP）重新发起申请。`}
          />
          <div style={{ height: 12 }} />
        </>
      )}
      <Card
        title="我的申请记录"
        extra={st && (
          <Tag color="primary" style={{ cursor: 'pointer' }}>
            <span onClick={() => setSt('')}>{st === 'active' ? '生效中' : '已申请未生效'} ✕</span>
          </Tag>
        )}
      >
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          一行对应你的一个标签；同一标签多次申请会合并。生效状态每次进入页面实时查询，和 Triton 申请单的审批状态无关。
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
  return (
    <Modal
      open
      width={640}
      title={<span>{r.tag} <LevelChip level={r.level} /></span>}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            续期 / 回收 / 冻结请前往来源系统操作
          </Typography.Text>
          <Space>
            <Button onClick={onClose}>关闭</Button>
            <Button onClick={() => { message.info('已在新页面打开 Triton 申请单'); onClose() }}>
              去 Triton 查看 →
            </Button>
            {!r.perm && <Button type="primary" onClick={onReapply}>再次申请 →</Button>}
          </Space>
        </div>
      }
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>tag_id {r.tagId} · {r.src}</Typography.Text>
      <div style={{ height: 12 }} />
      <Descriptions
        title="权限状态（本人 × 标签，实时查询）"
        bordered
        column={1}
        items={[
          {
            label: '申请状态',
            children: (
              <span>
                <ApplyTag />{' '}
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  最近 {r.last.at}{r.apps.length > 1 ? ` · 共 ${r.apps.length} 次` : ''}
                </Typography.Text>
              </span>
            ),
          },
          { label: '生效状态', children: <EffectTag perm={r.perm} /> },
          ...(r.perm
            ? [
                { label: '授权时间', children: r.perm.grantAt },
                { label: '有效期', children: <ValidText perm={r.perm} /> },
              ]
            : []),
          { label: '审批方式', children: lv.approve },
        ]}
      />
      {!r.perm && (
        <>
          <div style={{ height: 12 }} />
          <Alert type="warning" showIcon message={`已申请但当前无权限：${INACTIVE_TIP}`} />
        </>
      )}
      <div style={{ height: 14 }} />
      <div className="flow-title">历次申请记录</div>
      <Table
        size="small"
        dataSource={r.apps}
        rowKey="ticket"
        pagination={false}
        columns={[
          { title: '申请时间', dataIndex: 'at' },
          { title: '申请单号', dataIndex: 'ticket', render: (v) => <code style={{ fontSize: 11 }}>{v}</code> },
          { title: '消费场景', dataIndex: 'scene' },
        ]}
      />
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
        申请单号仅作记录；审批进度和审批人请在 Triton 查看。
      </Typography.Text>
    </Modal>
  )
}
