import { useState, useMemo } from 'react'
import {
  Button, Card, Input, Select, Checkbox, Modal, Descriptions, Alert, Steps,
  Form, Tag, Empty, Space, Typography, message,
} from '@ecom/aurora'
import {
  TAGS, CATALOG, LEVELS, LEVEL_ORDER, SCENES, levelLabel, visibility, applyPath,
  complianceOf, livePerm, isActive, upgrade, nowStamp,
} from '../data.js'
import { LevelChip, CrossBadge, ApplyTag, EffectTag, ValidText } from '../mvp-ui.jsx'

export default function Market({ V, myapply, addApply, pushAudit, goMyPerm }) {
  const [filters, setFilters] = useState({ q: '', src: '', lvl: '', st: '' })
  const [detailId, setDetailId] = useState(null)
  const [sel, setSel] = useState([]) // 批量申请选中的标签 id
  const applyFlow = useApplyFlow({ V, addApply, pushAudit, goMyPerm, onDone: () => setSel([]) })

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

  /* 批量申请：只有可申请、且当前无权限的标签能被选中 */
  const selectable = (tag) => visibility(V, tag).canApply && !isActive(livePerm(tag.id))
  function toggleSel(id) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  const detailTag = detailId ? TAGS.find((t) => t.id === detailId) : null

  return (
    <>
      <div className="page-head"><div className="page-title">标签广场</div></div>
      <div className="kpi-row">
        {CATALOG.map((c) => (
          <div
            key={c.d}
            className={`kpi domain-kpi src-kpi${filters.src === c.d ? ' kpi-on' : ''}`}
            onClick={() => setFilters((d) => ({ ...d, src: d.src === c.d ? '' : c.d }))}
          >
            <div className="src-name">{c.d}</div>
            <div className="src-sub">{c.n.toLocaleString()} 个标签 · 点击筛选</div>
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
              const applied = applyStatus(c) === 'applied'
              const perm = livePerm(c.id)
              const canSel = selectable(c)
              const checked = sel.includes(c.id)
              return (
                <div
                  key={c.id}
                  className={`tag-card${applied ? ' is-applied' : ''}${checked ? ' is-checked' : ''}`}
                  onClick={() => openTag(c.id)}
                >
                  {/* 已申请用角标表达，不再占用一个 tag 位；可申请为默认态，不额外标记 */}
                  {applied && <span className="tc-ribbon">已申请</span>}
                  <div className="tc-top">
                    {canSel && (
                      <span className="tc-check" onClick={(e) => { e.stopPropagation(); toggleSel(c.id) }}>
                        <Checkbox checked={checked} onChange={() => toggleSel(c.id)} />
                      </span>
                    )}
                    <div className="tc-name" title={c.name}>{c.name}</div>
                    {c.official && <Tag color="warning">官方</Tag>}
                  </div>
                  {/* 字段顺序：名称 → 分级 → 业务含义 → 来源与更新频率 */}
                  <div className="tc-tags">
                    <LevelChip level={c.level} />
                    {vis.cross && <CrossBadge />}
                  </div>
                  <div className="tc-desc">{c.desc}</div>
                  <div className="tc-foot">
                    <span>{c.src} · 更新 {c.freq}</span>
                    {isActive(perm) && (
                      <Button
                        type="link"
                        size="small"
                        onClick={(e) => { e.stopPropagation(); message.info('已在新页面打开风神平台') }}
                      >
                        去使用 →
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
      {sel.length > 0 && (
        <div className="batch-bar">
          <span>已选 <b>{sel.length}</b> 个标签</span>
          <Space>
            <Button size="small" onClick={() => setSel([])}>清空</Button>
            <Button type="primary" size="small" onClick={() => applyFlow.start(sel)}>批量申请 →</Button>
          </Space>
        </div>
      )}
      {detailTag && (
        <TagDetailModal
          V={V}
          tag={detailTag}
          applies={myapply.filter((a) => a.tagId === detailTag.id)}
          onClose={() => setDetailId(null)}
          onApply={() => { setDetailId(null); applyFlow.start([detailTag.id]) }}
        />
      )}
      {applyFlow.modal}
    </>
  )
}

/* 申请流程（智能助手预填 → 跳 Triton 建单）：标签广场与「我的申请 / 权限」共用
 * 支持单个与批量：门户为每个标签各记一条申请记录，不追踪 Triton 单据状态 */
export function useApplyFlow({ V, addApply, pushAudit, goMyPerm, onDone }) {
  const [apply, setApply] = useState(null)
  const [done, setDone] = useState(null)

  function start(ids) {
    const list = (Array.isArray(ids) ? ids : [ids]).map((id) => TAGS.find((t) => t.id === id)).filter(Boolean)
    if (!list.length) return
    setApply({
      tags: list,
      fields: list.map((t) => t.name).join('、'),
      applicant: `user（${V.name} · ${V.domain}）`,
      scene: '',
      err: '',
      parsedFile: null,
      parsing: false,
    })
  }

  function onParse() {
    if (!apply || apply.parsing) return
    setApply((d) => ({ ...d, parsing: true }))
    const first = apply.tags[0]
    setTimeout(() => {
      const scene = SCENES[first.id % SCENES.length]
      setApply((p) => ({
        ...p,
        parsing: false,
        scene,
        err: '',
        parsedFile: `PRD_${first.name}.docx`,
      }))
      pushAudit(`智能小助手解析文档并预填申请字段：${apply.tags.map((t) => t.name).join('、')}`, visibility(V, first).eff)
      message.success(`已解析文档并预填申请字段、申请人、使用场景（${scene}），请核对后提交`)
    }, 500)
  }

  function onSubmit() {
    if (!apply) return
    if (!apply.scene) {
      setApply((d) => ({ ...d, err: '请选择使用场景' }))
      message.warning('请先选择使用场景，或上传文档自动预填')
      return
    }
    const at = nowStamp().slice(0, 16)
    apply.tags.forEach((tag, i) => {
      const vis = visibility(V, tag)
      const path = applyPath(tag)
      addApply({ ticket: `APP-${24400 + Math.floor(Math.random() * 500) + i}`, tagId: tag.id, at, scene: apply.scene })
      pushAudit(`去 ${path.target} 申请（智能小助手预填）：${tag.name}${vis.cross ? '（跨域升档）' : ''}`, vis.eff)
      pushAudit(`申请提交成功：${tag.name}（场景=${apply.scene}）`, vis.eff)
    })
    const names = apply.tags.map((t) => t.name)
    setApply(null)
    setDone({ names, scene: apply.scene })
    onDone?.()
  }

  const modal = (
    <>
      {apply && (
        <ApplyGuideModal
          V={V}
          apply={apply}
          setApply={setApply}
          onClose={() => setApply(null)}
          onParse={onParse}
          onSubmit={onSubmit}
        />
      )}
      {done && (
        <Modal
          open
          width={460}
          title="✅ 申请已提交"
          onCancel={() => setDone(null)}
          footer={
            <Space>
              <Button onClick={() => setDone(null)}>知道了</Button>
              {goMyPerm && (
                <Button type="primary" onClick={() => { setDone(null); goMyPerm() }}>
                  去我的申请查看 →
                </Button>
              )}
            </Space>
          }
        >
          <Typography.Text>
            已提交 {done.names.length} 个标签的申请，使用场景「{done.scene}」。
          </Typography.Text>
          <div style={{ height: 8 }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {done.names.join('、')}
          </Typography.Text>
          <div style={{ height: 12 }} />
          <Alert
            type="info"
            showIcon
            message="审批需要一定时间，可在「我的申请 / 权限」查看生效状态；生效后即可去风神平台使用。"
          />
        </Modal>
      )}
    </>
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
          { label: '更新频率', children: tag.freq },
          { label: '来源域 / 表', children: <span>{tag.src} · <code>{tag.table}</code></span> },
          { label: 'Owner / 团队', children: tag.owner },
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
  const tags = apply.tags
  const multi = tags.length > 1
  /* 批量时按最高分级预判审批链路：一单里只要有高敏，整体就走高敏流程 */
  const eff = tags
    .map((t) => visibility(V, t).eff)
    .reduce((m, l) => (LEVEL_ORDER.indexOf(l) > LEVEL_ORDER.indexOf(m) ? l : m), '开放')
  const cross = tags.some((t) => visibility(V, t).cross)
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
  const comp = complianceOf(tags[0])
  return (
    <Modal
      open
      width={720}
      title={
        <span>
          {multi ? `批量申请 · ${tags.length} 个标签` : '申请智能助手'}
          <Tag color="warning" style={{ marginLeft: 8 }}>规划中</Tag>
        </span>
      }
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
      {multi && (
        <Alert
          style={{ marginTop: 10 }}
          type="info"
          showIcon
          message={`本次申请包含 ${tags.length} 个标签，按其中最高分级「${levelLabel(eff)}」走审批流程，门户为每个标签各记一条申请记录。`}
        />
      )}
      {cross && (
        <Alert
          style={{ marginTop: 10 }}
          type="warning"
          showIcon
          message={`跨域申请：密级将升档为 ${levelLabel(eff)}，审批方式为「${LEVELS[eff].approve}」，审批更严格。`}
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
        <Form.Item label={<span><span className="req-star">*</span>使用场景</span>}>
          <Select
            value={apply.scene || undefined}
            placeholder="请选择，或上传文档自动预填"
            onChange={(v) => setApply((d) => ({ ...d, scene: v || '', err: '' }))}
            options={SCENES.map((s) => ({ label: s, value: s }))}
          />
          {apply.err && <div className="field-err">{apply.err}</div>}
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
