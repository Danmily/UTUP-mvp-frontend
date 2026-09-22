import { useState, useMemo } from 'react'
import {
  Button, Card, Input, Select, Modal, Descriptions, Alert, Steps,
  Form, Tag, Statistic, Empty, Space, Typography, message,
} from '@ecom/aurora'
import {
  TAGS, CATALOG, LEVELS, LEVEL_ORDER, levelLabel, visibility, applyPath, complianceOf, livePerm, isActive, nowStamp,
} from '../data.js'
import { LevelChip, CrossBadge, ApplyTag, EffectTag, ValidText } from '../mvp-ui.jsx'

const SCENES = ['人群圈选', '用户360', '模型特征', '营销投放', '数据分析']

export default function Market({ V, myapply, addApply, pushAudit }) {
  const [filters, setFilters] = useState({ q: '', src: '', lvl: '', st: '' })
  const [detailId, setDetailId] = useState(null)
  const applyFlow = useApplyFlow({ V, addApply, pushAudit })

  /* 列表只看门户自记录的申请状态，不逐卡实时查权限；是否生效进详情再查 */
  const applyStatus = (tag) =>
    myapply.some((a) => a.tagId === tag.id)
      ? 'applied'
      : visibility(V, tag).canApply ? 'apply' : 'visible'

  const list = useMemo(() => TAGS.filter((c) => {
    const vis = visibility(V, c)
    if (!vis.visible) return false
    if (filters.q && !(c.name.includes(filters.q) || c.desc.includes(filters.q))) return false
    if (filters.src && c.src !== filters.src) return false
    if (filters.lvl && c.level !== filters.lvl) return false
    if (filters.st && applyStatus(c) !== filters.st) return false
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [V, filters, myapply])

  function openTag(id) {
    const tag = TAGS.find((t) => t.id === id)
    if (tag) {
      pushAudit('查看标签详情：' + tag.name, tag.level)
      setDetailId(id)
    }
  }

  const detailTag = detailId ? TAGS.find((t) => t.id === detailId) : null

  return (
    <>
      <div className="page-head"><div className="page-title">标签广场</div></div>
      <div className="kpi-row">
        {CATALOG.map((c) => (
          <div
            key={c.d}
            className="kpi domain-kpi"
            onClick={() => setFilters((d) => ({ ...d, src: d.src === c.d ? '' : c.d }))}
          >
            <Statistic title={`📦 ${c.d} · 标签总数`} value={c.n.toLocaleString()} suffix="个" />
            <div className="kpi-trend">点击按来源域筛选</div>
          </div>
        ))}
      </div>
      <Card>
        <div className="search-bar">
          <Input
            prefix="🔍"
            placeholder="搜索标签名 / 口径…"
            value={filters.q}
            onChange={(v) => setFilters((d) => ({ ...d, q: v }))}
          />
          <Select
            value={filters.src}
            onChange={(v) => setFilters((d) => ({ ...d, src: v || '' }))}
            options={[{ label: '全部来源域', value: '' }, ...CATALOG.map((c) => ({ label: c.d, value: c.d }))]}
          />
          <Select
            value={filters.lvl}
            onChange={(v) => setFilters((d) => ({ ...d, lvl: v || '' }))}
            options={[{ label: '全部分级', value: '' }, ...LEVEL_ORDER.map((x) => ({ label: levelLabel(x), value: x }))]}
          />
          <Select
            value={filters.st}
            onChange={(v) => setFilters((d) => ({ ...d, st: v || '' }))}
            options={[
              { label: '全部申请状态', value: '' },
              { label: '已申请', value: 'applied' },
              { label: '可申请', value: 'apply' },
            ]}
          />
        </div>
        {list.length === 0 ? (
          <Empty
            description={
              <>
                当前筛选条件下没有可见的标签
                <br />
                <span style={{ fontSize: 12 }}>受控级或跨域的用数需求，请走本域 POC 入口申请</span>
              </>
            }
          />
        ) : (
          <div className="tag-cards">
            {list.map((c) => {
              const vis = visibility(V, c)
              const st = applyStatus(c)
              const cov = c.cov ? `覆盖率 ${c.cov}%` : ''
              return (
                <div key={c.id} className="tag-card" onClick={() => openTag(c.id)}>
                  <div className="tc-top">
                    <div className="tc-name">{c.name}</div>
                    {c.official && <Tag color="warning">官方</Tag>}
                  </div>
                  <div className="tc-desc">{c.desc}</div>
                  <div className="tc-tags">
                    <LevelChip level={c.level} />
                    {vis.cross && <CrossBadge />}
                  </div>
                  <div className="tc-foot">
                    <span>{c.src} · {c.owner.split(' · ')[0]}{cov ? ' · ' + cov : ''}</span>
                    {st === 'applied' && <ApplyTag />}
                    {st === 'apply' && <Tag color="primary">可申请</Tag>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
      {detailTag && (
        <TagDetailModal
          V={V}
          tag={detailTag}
          applies={myapply.filter((a) => a.tagId === detailTag.id)}
          onClose={() => setDetailId(null)}
          onApply={() => { setDetailId(null); applyFlow.start(detailTag.id) }}
        />
      )}
      {applyFlow.modal}
    </>
  )
}

/* 申请流程（智能助手预填 → 跳 Triton 建单）：标签广场与「我的申请 / 权限」共用
 * 门户只记一条申请记录（申请状态 = 已申请），不追踪 Triton 单据状态 */
export function useApplyFlow({ V, addApply, pushAudit }) {
  const [apply, setApply] = useState(null)

  function start(id) {
    const tag = TAGS.find((t) => t.id === id)
    if (!tag) return
    setApply({
      tag,
      fields: tag.name,
      applicant: `user（${V.name} · ${V.domain}）`,
      scene: '',
      parsedFile: null,
      parsing: false,
    })
  }

  function onParse() {
    if (!apply || apply.parsing) return
    setApply((d) => ({ ...d, parsing: true }))
    const tag = apply.tag
    setTimeout(() => {
      const scene = SCENES[tag.id % SCENES.length]
      setApply((p) => ({
        ...p,
        parsing: false,
        fields: `${tag.name}（含枚举：${(tag.enums || []).slice(0, 2).join(' / ') || '—'}）`,
        scene,
        parsedFile: `PRD_${tag.name}.docx`,
      }))
      pushAudit(`智能小助手解析文档并预填申请字段：${tag.name}`, visibility(V, tag).eff)
      message.success(`已解析文档并预填申请字段、申请人、使用场景（${scene}），请核对后提交`)
    }, 500)
  }

  function onSubmit() {
    if (!apply) return
    const tag = apply.tag
    if (!apply.scene) {
      message.warning('请先选择使用场景，或上传文档自动预填')
      return
    }
    const path = applyPath(tag)
    const vis = visibility(V, tag)
    const ticket = 'APP-' + (24400 + Math.floor(Math.random() * 500))
    const at = nowStamp().slice(0, 16)
    addApply({ ticket, tagId: tag.id, at, scene: apply.scene })
    pushAudit(`去 ${path.target} 申请（智能小助手预填）：${tag.name}${vis.cross ? '（跨域升档）' : ''}`, vis.eff)
    pushAudit(`申请提交成功：${tag.name}（场景=${apply.scene}）`, vis.eff)
    setApply(null)
    message.success(`已带预填内容跳转 ${path.target} 建单，申请状态记为「已申请」；审批通过后生效状态会自动变为「生效中」`)
  }

  const modal = apply && (
    <ApplyGuideModal
      V={V}
      apply={apply}
      setApply={setApply}
      onClose={() => setApply(null)}
      onParse={onParse}
      onSubmit={onSubmit}
    />
  )
  return { start, modal }
}

function TagDetailModal({ V, tag, applies, onClose, onApply }) {
  const vis = visibility(V, tag)
  const comp = complianceOf(tag)
  // 进详情时实时查「本人 × 标签」权限；申请状态取门户自记录
  const perm = livePerm(tag.id)
  const active = isActive(perm)
  const lastApply = [...applies].sort((a, b) => b.at.localeCompare(a.at))[0]
  const masked = (tag.level === '高敏' || tag.level === '受控') && !vis.real && !active
  const title = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {tag.name}
      {vis.cross ? (
        <>
          <LevelChip level={tag.level} />
          <span style={{ color: 'var(--mute)' }}>→</span>
          <LevelChip level={vis.eff} />
          <CrossBadge>跨域升档</CrossBadge>
        </>
      ) : (
        <LevelChip level={tag.level} />
      )}
    </span>
  )
  return (
    <Modal
      open
      width={760}
      title={title}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            本次查看已记入审计日志
          </Typography.Text>
          <Space>
            <Button onClick={onClose}>关闭</Button>
            {active ? (
              <Button disabled>✓ 已有权限</Button>
            ) : vis.canApply ? (
              <Button type="primary" onClick={onApply}>{applies.length ? '再次申请 →' : '申请权限 →'}</Button>
            ) : (
              <Button disabled>{V.wl ? '暂不可申请' : '需走本域 POC 申请'}</Button>
            )}
          </Space>
        </div>
      }
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        tag_id: {tag.id} · {tag.src} · {tag.callType === 'psm' ? '系统间调用' : '人消费标签'}
      </Typography.Text>
      <div style={{ height: 12 }} />
      <Descriptions
        title="📋 元信息"
        bordered
        column={1}
        items={[
          { label: '口径描述', children: tag.desc },
          { label: '来源域 / 表', children: <span>{tag.src} · <code>{tag.table}</code></span> },
          { label: 'Owner / 团队', children: tag.owner },
          { label: '更新频率', children: tag.freq },
          { label: '覆盖率', children: tag.cov ? `${tag.cov}%` : '—' },
          {
            label: '统一分级',
            children: (
              <span>
                <LevelChip level={tag.level} />{' '}
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  由供给方判定
                </Typography.Text>
              </span>
            ),
          },
        ]}
      />
      <div style={{ height: 14 }} />
      <Descriptions
        title="🔑 我的权限（实时查询）"
        bordered
        column={1}
        items={[
          {
            label: '申请状态',
            children: lastApply ? (
              <span>
                <ApplyTag />{' '}
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  最近 {lastApply.at}{applies.length > 1 ? ` · 共 ${applies.length} 次` : ''}
                </Typography.Text>
              </span>
            ) : <Typography.Text type="secondary">未申请</Typography.Text>,
          },
          { label: '生效状态', children: <EffectTag perm={perm} applied={applies.length > 0} /> },
          ...(perm ? [{ label: '有效期', children: <ValidText perm={perm} /> }] : []),
        ]}
      />
      <div style={{ height: 14 }} />
      <Descriptions
        title="🔢 枚举值 / 示例值（动态查询）"
        bordered
        column={1}
        items={[
          {
            label: '枚举值',
            children: masked ? (
              <Alert
                type="warning"
                showIcon
                message="*** （授权后可见真实值）"
                description="未获授权时只展示元信息，数据值以 *** 脱敏；授权通过后自动显示真实值。"
              />
            ) : (
              <span>{tag.enums.map((a) => <Tag key={a} style={{ margin: 2 }}>{a}</Tag>)}</span>
            ),
          },
        ]}
      />
      <div style={{ height: 14 }} />
      <Descriptions
        title="📄 数据使用合规说明"
        bordered
        column={1}
        items={[
          {
            label: '合规说明',
            children: (
              <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.8 }}>
                {comp.note}
              </Typography.Text>
            ),
          },
          {
            label: '合规文档',
            children: <Typography.Link href={comp.url} target="_blank">📄 {comp.title}</Typography.Link>,
          },
        ]}
      />
      {(tag.level === '高敏' || vis.cross) && (
        <Alert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          message={`${vis.cross ? '跨域' : '高敏'}场景：需按来源方的合规流程审批，请提前准备合规材料。`}
        />
      )}
    </Modal>
  )
}

function ApplyGuideModal({ V, apply, setApply, onClose, onParse, onSubmit }) {
  const tag = apply.tag
  const vis = visibility(V, tag)
  const eff = vis.eff
  const strict = eff === '受控' || eff === '高敏'
  const steps = eff === '开放'
    ? [{ title: '发起（消费方）' }, { title: '免审批 · 留痕' }]
    : eff === '通用'
      ? [{ title: '发起（消费方）' }, { title: '平台自动通过' }]
      : eff === '受控'
        ? [{ title: '发起（消费方）' }, { title: '申请方 +1' }, { title: 'Owner 审批' }]
        : [
            { title: '发起（消费方）' },
            { title: '申请方 +2' },
            { title: 'Owner（UG 收口）' },
            { title: '法务 + 合规加签' },
          ]
  const comp = complianceOf(tag)
  return (
    <Modal
      open
      width={720}
      title={<span>申请智能助手 <Tag color="warning" style={{ marginLeft: 8 }}>规划中</Tag></span>}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            门户不生成工单，最终建单在 Triton 完成
          </Typography.Text>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" onClick={onSubmit}>去 Triton 申请 →</Button>
          </Space>
        </div>
      }
    >
      <Alert
        type="info"
        showIcon
        message="🤖 智能小助手：表单智能预填"
        description="自动带出申请字段、申请人和使用场景；上传 PRD / 需求单 / 收益测算文档后会自动解析并回填，确认无误后一键跳转 Triton 建单。"
      />
      {vis.cross && (
        <Alert
          style={{ marginTop: 10 }}
          type="warning"
          showIcon
          message={`跨域申请：密级将升档为 ${eff}，审批方式为「${LEVELS[eff].approve}」，审批更严格。`}
        />
      )}
      <div
        className="route-box"
        onClick={onParse}
        style={{ cursor: 'pointer', textAlign: 'center', padding: 18, marginTop: 14 }}
      >
        <div style={{ fontSize: 22 }}>📄⬆️</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>
          <b>{apply.parsing ? '解析中…' : apply.parsedFile ? '解析完成，可重新上传替换' : '点击上传 PRD / 需求单 / 收益测算文档'}</b>
        </div>
        <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 4 }}>
          将自动解析并预填申请字段、申请人和使用场景
        </div>
      </div>
      {apply.parsedFile && (
        <div style={{ fontSize: 12, color: 'var(--ok)', marginTop: 8 }}>
          已解析 {apply.parsedFile}，字段已预填，请核对后提交。
        </div>
      )}
      <Form layout="vertical" style={{ marginTop: 14 }}>
        <Form.Item label="申请字段">
          <Input value={apply.fields} onChange={(v) => setApply((d) => ({ ...d, fields: v }))} />
        </Form.Item>
        <Form.Item label="申请人">
          <Input value={apply.applicant} onChange={(v) => setApply((d) => ({ ...d, applicant: v }))} />
        </Form.Item>
        <Form.Item label="使用场景">
          <Select
            value={apply.scene || undefined}
            placeholder="请选择，或上传文档自动预填"
            onChange={(v) => setApply((d) => ({ ...d, scene: v || '' }))}
            options={SCENES.map((s) => ({ label: s, value: s }))}
          />
        </Form.Item>
      </Form>
      {strict && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="受控 / 高敏标签还需提供 PRD 链接、Meego 需求单和收益测算，可由上传的文档一并解析。"
        />
      )}
      <div className="flow-title">预计审批链路</div>
      <Steps items={steps} current={steps.length - 1} />
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
        有效期：{LEVELS[eff].valid} · 审批人：{LEVELS[eff].approver} · 预填内容仅供参考，实际必填项与校验以 Triton 表单为准
      </Typography.Text>
      <div style={{ marginTop: 14 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>合规依据：</Typography.Text>{' '}
        <Typography.Link href={comp.url} target="_blank">📄 {comp.title}</Typography.Link>
      </div>
    </Modal>
  )
}
