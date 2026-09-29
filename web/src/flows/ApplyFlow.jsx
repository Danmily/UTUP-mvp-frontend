import { useRef, useState } from 'react'
import { Alert, Button, Modal, Space, Tag } from '@ecom/aurora'
import { TAGS, SCENES, nowStamp } from '../data.js'
import { LevelChip, CrossBadge } from '../mvp-ui.jsx'
import { assetState, makeDraft, resolvedPurpose, validateDraft, applicationRow, submissionPlan, sceneNote, submittedPurpose } from './application-model.mjs'

export function useApplyFlow({ V, myapply = [], addApply, pushAudit, goMyPerm, backToAgent, onDone, onTagsChange, onRemoveTag }) {
  const [draft,setDraft]=useState(null), [open,setOpen]=useState(false), [done,setDone]=useState(null)
  const [busy,setBusy]=useState(false), lock=useRef(false)
  function start(ids) {
    const tags=[...new Set(Array.isArray(ids)?ids:[ids])].map(id=>TAGS.find(t=>t.id===id)).filter(Boolean)
    setDraft(old=>makeDraft(tags,old));setDone(null);setOpen(true)
  }
  function remove(id) { onRemoveTag?.(id);setDraft(d=>({...d,tags:d.tags.filter(t=>t.id!==id),error:''}));onTagsChange?.(draft.tags.filter(t=>t.id!==id).map(t=>t.id)) }
  function next() { const error=validateDraft(V,draft,myapply);setDraft(d=>({...d,error,step:error?'edit':'review'})) }
  function submit() {
    if(lock.current)return
    const error=validateDraft(V,draft,myapply)
    if(error){setDraft(d=>({...d,error,step:'edit'}));return}
    lock.current=true;setBusy(true)
    try {
      const batchId='DEMO-'+crypto.randomUUID().slice(0,8), at=nowStamp().slice(0,16)
      const results=submissionPlan(draft).map((r,i)=>({...r,ticket:r.success?`${batchId}-${i+1}`:null}))
      for(const r of results)if(r.success){addApply({ticket:r.ticket,tagId:r.tag.id,at,...submittedPurpose(r.purpose),evidence:draft.evidence,submissionStatus:'submitted',demo:true});pushAudit(`演示提交申请：${r.tag.name}，${r.ticket}（未向真实审批系统建单）`,applicationRow(V,r.tag).effectiveLevel)}
      setDone({results,batchId});setOpen(false)
      onDone?.(results.filter(r=>r.success).map(r=>r.tag.id))
    }finally{lock.current=false;setBusy(false)}
  }
  function retry() { const tags=done.results.filter(r=>!r.success).map(r=>r.tag);setDraft(d=>({...makeDraft(tags,d),step:'review'}));setDone(null);setOpen(true) }
  const successes=done?.results.filter(r=>r.success)||[], failures=done?.results.filter(r=>!r.success)||[]
  const modal=<>
    {open&&draft&&<Modal open width={820} title={`申请标签权限 · ${draft.tags.length} 个标签`} onCancel={()=>!busy&&setOpen(false)} footer={<div className="apply-footer"><span>交互演示 · 不向真实审批系统建单</span><Space><Button disabled={busy} onClick={()=>setOpen(false)}>返回，保留填写</Button>{draft.step==='review'&&<Button disabled={busy} onClick={()=>setDraft(d=>({...d,step:'edit'}))}>返回编辑</Button>}<Button type="primary" disabled={!draft.tags.length} loading={busy} onClick={draft.step==='edit'?next:submit}>{draft.step==='edit'?'下一步：确认申请':`模拟提交申请（${draft.tags.length}）`}</Button></Space></div>}>
      <div className="apply-progress"><span className={draft.step==='edit'?'current':''}>1 填写申请</span><span>→</span><span className={draft.step==='review'?'current':''}>2 确认申请</span><span>→</span><span>3 提交结果</span></div>
      {draft.error&&<div role="alert" className="apply-error">{draft.error}</div>}
      <Alert type="info" message={draft.step==='edit'?'单个和批量使用同一表单。公共用途默认应用到全部标签，也可逐项调整。':'请核对每个标签的最终用途。各标签独立建单和审批，提交成功不代表权限已生效。'} />
      {draft.step==='edit'?<section className="apply-section"><h3>公共申请信息 <small>可编辑 · 默认用于全部标签</small></h3><p className="apply-muted">申请人：user（{V.name} · {V.domain}），由登录身份确定，不能代填他人。</p><PurposeFields prefix="common" scene={draft.scene} description={draft.description} onChange={patch=>setDraft(d=>({...d,...patch,error:''}))}/><label className="apply-label" htmlFor="apply-evidence">需求文档 / 补充材料链接（选填）</label><input className="au-input" id="apply-evidence" value={draft.evidence} placeholder="填写已有材料链接，供审批方核对" onChange={e=>setDraft(d=>({...d,evidence:e.target.value}))}/><p className="apply-muted">分级、来源表、Owner、审批规则和有效期规则均为只读。受控、高敏标签的额外材料要求，以来源方表单为准。</p></section>:<section className="apply-section"><h3>提交信息</h3><p>申请人：user（{V.name} · {V.domain}）</p><p>补充材料：{draft.evidence||'未填写'}</p><p className="apply-muted">将携带标签 ID、来源表、使用场景及其标准使用说明、补充说明和材料链接，交由审批系统建单。当前仅演示回执。</p></section>}
      <section className="apply-section"><h3>申请清单 <small>{draft.tags.length} 个，按选择顺序</small></h3>
        {!draft.tags.length&&<p>清单已清空。返回广场后继续选择，已填写的公共用途会保留。</p>}
        {draft.tags.map((tag,i)=>{const row=applicationRow(V,tag),state=assetState(V,tag,myapply),purpose=resolvedPurpose(draft,tag),override=draft.overrides[tag.id]||{};return <article className="apply-tag-row" key={tag.id}>
          <div className="apply-tag-heading"><span className="apply-row-index">{i+1}</span><strong>{tag.name}</strong><LevelChip level={row.effectiveLevel}/>{row.cross&&<CrossBadge/>}{draft.step==='edit'&&<Button type="link" size="small" onClick={()=>remove(tag.id)}>移除</Button>}</div>
          <dl className="apply-tag-meta"><div><dt>来源表</dt><dd>{tag.table}</dd></div><div><dt>审批</dt><dd>{row.approval} · {row.owner}</dd></div><div><dt>有效期规则</dt><dd>{row.validity} · 最终以来源系统为准</dd></div></dl>
          {!state.selectable?<p className="apply-error">{state.reason}</p>:state.code==='applied'?<p className="apply-caution">已有申请记录；本次为再次申请，请先核对来源系统进度。</p>:null}
          {draft.step==='review'?<div className="apply-purpose-preview"><b>{purpose.scene}</b><details className="apply-scene-note"><summary>场景使用说明（随申请提交）</summary><p>{sceneNote(purpose.scene)}</p></details>{purpose.description?.trim()&&<p>补充说明：{purpose.description}</p>}</div>:<details><summary>{override.custom?'已单独设置用途 · 可继续编辑':'单独设置此标签的用途（选填）'}</summary><label className="apply-check"><input type="checkbox" checked={!!override.custom} onChange={e=>setDraft(d=>({...d,overrides:{...d.overrides,[tag.id]:{scene:d.scene,description:d.description,...d.overrides[tag.id],custom:e.target.checked}}}))}/>此标签使用独立用途</label>{override.custom&&<PurposeFields prefix={`tag-${tag.id}`} scene={override.scene||''} description={override.description||''} onChange={patch=>setDraft(d=>({...d,overrides:{...d.overrides,[tag.id]:{...d.overrides[tag.id],...patch}},error:''}))}/>}</details>}
        </article>})}
      </section>
      <details className="apply-demo-control"><summary>评审演示设置</summary><label htmlFor="apply-outcome">模拟提交结果</label><select id="apply-outcome" value={draft.outcome} onChange={e=>setDraft(d=>({...d,outcome:e.target.value}))}><option value="success">全部成功</option><option value="partial">最后一项提交失败</option></select><p>失败项不会生成申请记录；重试仅处理失败项。</p></details>
    </Modal>}
    {done&&<Modal open width={760} title={failures.length?'演示提交完成 · 部分失败':'演示申请已提交'} onCancel={()=>setDone(null)} footer={<Space><Button onClick={()=>setDone(null)}>完成</Button>{failures.length>0&&<Button type="primary" onClick={retry}>仅重试失败项（{failures.length}）</Button>}{goMyPerm&&successes.length>0&&<Button type={failures.length||backToAgent?'default':'primary'} onClick={()=>{setDone(null);goMyPerm()}}>查看我的申请</Button>}{backToAgent&&successes.length>0&&<Button type={failures.length?'default':'primary'} onClick={()=>{setDone(null);backToAgent()}}>返回圈人 Agent 继续</Button>}</Space>}>
      <Alert type={failures.length?'warning':'success'} message={`${successes.length} 项提交成功，${failures.length} 项失败。成功项已记录，不会在重试时重复提交。`}/><div className="apply-results">{done.results.map(r=><div key={r.tag.id}><strong>{r.tag.name}</strong><Tag color={r.success?'primary':'danger'}>{r.success?'已提交 · 待同步':'提交失败'}</Tag><p>{r.success?`演示回执 ${r.ticket} · 尚未获得权限`:'模拟来源系统暂不可用，请重试该项'}</p></div>)}</div><p className="apply-muted">真实接入后，仅在收到来源系统成功回执后记录“已申请”。已有有效权限时，列表优先显示“可使用”。</p>
    </Modal>}
  </>
  return {start,modal}
}
function PurposeFields({prefix,scene,description,onChange}){
 return <div className="apply-purpose-fields">
  <label className="apply-label" htmlFor={`${prefix}-scene`}>使用场景 *</label>
  <select className="au-input" id={`${prefix}-scene`} value={scene} onChange={e=>onChange({scene:e.target.value})}><option value="">请选择使用场景</option>{SCENES.map(s=><option key={s}>{s}</option>)}</select>
  {scene&&<details className="apply-scene-note"><summary>已带出「{scene}」的标准使用说明，随申请提交</summary><p>{sceneNote(scene)}</p></details>}
  <label className="apply-label" htmlFor={`${prefix}-description`}>补充说明（选填）</label>
  <textarea className="au-textarea" id={`${prefix}-description`} rows={2} value={description} placeholder="标准说明之外还有特殊用途时再补充，例如：用于 10 月服饰新品推广" onChange={e=>onChange({description:e.target.value})}/>
 </div>
}
