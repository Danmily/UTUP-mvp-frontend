/* 圈人助手 · 交互演示
 * 交互参考 SQLess 选品助手：左侧对话 + 右侧结果面板。
 * 所有人群、SQL、规模与收益均为模拟数据，不连接真实数据服务。 */
(function (root) {
'use strict';

/* ---------------- 模型（纯函数，供测试） ---------------- */
const TAGS = {
  14520: { name: '品类偏好序列 Top10', level: '受控', table: 'dws_ecom_cate_pref_df' },
  14501: { name: '电商消费力分层', level: '受控', table: 'dws_ecom_consume_level_df' },
  14572: { name: '加购收藏活跃度', level: '通用', table: 'dws_ecom_cart_active_df' },
  14610: { name: '品类兴趣（LLM 侧写）', level: '通用', table: 'dwd_llm_cate_interest_di' },
  14560: { name: '退货退款率分层', level: '受控', table: 'dws_ecom_refund_rate_df' },
  14533: { name: '活跃天数分层（近 30 天）', level: '通用', table: 'dws_ecom_active_days_df' },
  14578: { name: '大促敏感度分层', level: '受控', table: 'dws_ecom_promo_sens_df' },
  14618: { name: '到店品类偏好', level: '通用', table: 'dws_life_cate_pref_df' },
  14624: { name: '常驻商圈分层', level: '高敏', table: 'dwd_life_geo_zone_di' },
  14612: { name: '团购券核销率', level: '通用', table: 'dws_life_coupon_redeem_df' },
  14580: { name: '生服到店消费频次', level: '受控', table: 'dws_life_visit_freq_df' },
  14660: { name: '跨域消费力融合分', level: '高敏', table: 'dwd_xd_consume_fusion_di' },
  14606: { name: '到店客单价分层', level: '受控', table: 'dws_life_aov_level_df' },
  14555: { name: '聚合类目分布（脱敏）', level: '开放', table: 'ads_ecom_cate_dist_df' },
  14566: { name: '客单价分层', level: '通用', table: 'dws_ecom_aov_level_df' },
  14630: { name: '到店时段偏好（脱敏）', level: '开放', table: 'ads_life_time_dist_df' },
};
/* 无权限时「使用其他标签」的替代关系；null 表示直接去掉该条件 */
const ALT = { 14520: 14555, 14501: 14566, 14578: 14572, 14580: 14612, 14660: 14566, 14606: 14612, 14560: null, 14624: 14630 };
const GROUPS = [['must', '必须满足'], ['any', '任一满足'], ['exclude', '排除']];
/* 执行方式按域判定（PRD 4.3）：单域直接由生服 DMP 按条件生包，跨域才需要生成 SQL 再到大盘执行 */
const tagDomain = (id) => (/_xd_/.test(TAGS[id].table) ? '跨域' : /life/.test(TAGS[id].table) ? '生服' : '电商');
function taskDomains(task) {
  return [...new Set(buildConditions(task).filter((c) => c.tag).map((c) => tagDomain(c.tag)))];
}
function execMode(task) {
  const ds = taskDomains(task);
  const cross = ds.includes('跨域') || ds.length > 1;
  return {
    cross,
    domains: ds,
    label: cross ? `跨域（${ds.filter((x) => x !== '跨域').join(' × ') || '多域'}）` : `单域（${ds[0] || '电商'}）`,
    note: cross
      ? '跨域场景：需要先生成 SQL，再到大盘执行生包'
      : '单域场景：由生服 DMP 直接按条件生包，不生成 SQL',
  };
}

const SCENES = {
  recall: {
    match: /召回|流失|沉默|没有下单|没下单|未购/, title: '美妆沉默老客召回', base: 412000,
    questions: [
      { id: 'history', title: '"老客"按多长的购买历史算？', why: '历史窗口越长，老客范围越大', options: ['近 180 天买过美妆', '近 365 天买过美妆'] },
      { id: 'dormant', title: '多久没下单算"沉默"？', why: '沉默窗口决定召回范围，原话没有给出天数', options: ['近 30 天未下单', '近 60 天未下单'], pick: 1 },
    ],
    conditions: (a) => [
      { group: 'must', tag: 14520, value: a.history },
      { group: 'must', tag: 14533, value: a.dormant },
      { group: 'any', tag: 14578, value: '大促敏感度 高 / 中' },
      { group: 'exclude', tag: 14560, value: '退货退款率 高' },
    ],
  },
  local: {
    match: /到店|门店|火锅|商圈/, title: '火锅门店周边获客', base: 96000,
    questions: [
      { id: 'area', title: '门店能服务到哪个范围？', why: '范围决定人群能否真的到店', options: ['上海市（城市级）', '门店周边 3 公里'] },
      { id: 'window', title: '兴趣按多长时间看？', why: '时间窗口会改变入选范围', options: ['近 30 天', '近 90 天'] },
    ],
    conditions: (a) => [
      { group: 'must', tag: 14618, value: `${a.window}偏好：火锅 / 川渝菜` },
      { group: 'must', tag: 14624, value: a.area },
      { group: 'any', tag: 14612, value: '团购券核销率 ≥ 中' },
      { group: 'exclude', tag: 14580, value: '近 30 天已到店本门店' },
    ],
  },
  cross: {
    match: /跨域|高价值|双域/, title: '跨域潜在高价值用户', base: 153000,
    questions: [
      { id: 'level', title: '"生服消费较高"怎么定义？', why: '两个口径的人群规模相差约一倍', options: ['到店客单价 L4 及以上', '到店客单价 L3 及以上'] },
    ],
    conditions: (a) => [
      { group: 'must', tag: 14660, value: '融合分 ≥ 0.7' },
      { group: 'must', tag: 14501, value: '电商消费分层 L1–L2' },
      { group: 'any', tag: 14606, value: a.level },
    ],
  },
  brand: {
    match: /./, title: '羽绒服新品推广人群', base: 268000,
    questions: [
      { id: 'window', title: '行为观察窗口用多久？', why: '时间窗口会直接改变入选范围', options: ['近 30 天', '近 90 天'], pick: 1 },
      { id: 'spend', title: '"中高消费"按哪个口径？', why: '类目内购买力和全平台购买力可能不同', options: ['服饰类目消费分层 L3 及以上', '全平台消费分层 L3 及以上'] },
    ],
    conditions: (a) => [
      { group: 'must', tag: 14520, value: `${a.window}购买：服饰 > 羽绒服 / 外套` },
      { group: 'must', tag: 14501, value: a.spend },
      { group: 'any', tag: 14572, value: `${a.window}加购或收藏羽绒服` },
      { group: 'any', tag: 14610, value: '羽绒服兴趣 ≥ 中' },
      { group: 'exclude', tag: 14560, value: '退货退款率 高' },
    ],
  },
};
/* 两条链路的输入形态不同：A 以业务目标为主、条件由 Agent 从种子里学；B 需要把口径说清楚 */
const EXAMPLES_B = [
  ['新品推广', '给波司登找对羽绒服感兴趣、近 90 天有服饰消费、中高消费能力的用户，用于新品推广', '单域 · 电商'],
  ['老客召回', '召回买过美妆、但最近一段时间没有下单的老用户，排除高退货人群', '单域 · 电商'],
  ['门店获客', '为上海一家火锅门店找有火锅偏好、可能到店的潜在新客', '单域 · 生服'],
  ['跨域高价值', '圈出电商消费较低、但生服消费较高的潜在高价值用户', '跨域'],
];
const EXAMPLES_A = [
  ['种子扩散', '这批种子是上一轮复购最好的老客，帮我找一批相似的人，用于双十一新品推广'],
  ['高价值拉新', '参照这批高客单价用户，扩散出规模 10 万左右的潜在新客'],
  ['门店到店', '这批是门店到店核销过的用户，找出附近还没来过、可能到店的人'],
  ['跨域扩散', '这批是生服高频用户，帮我在电商侧找出同画像的人群'],
];

/* 种子用户：路径 A 的必填输入，与业务目标一起交给吴极侧 Agent。
 * 只保留数量与脱敏样例，不保存完整 ID 列表；本期不建独立种子库（PRD 6.1）。 */
const SEED_MIN = 10, SEED_MAX = 100; // 评审结论：一期种子数量限制在 10–100 个
/* 两条链路（PRD 第六节）
 * A：业务目标 ＋ 种子 UID → 吴极侧 Agent 产出 SQL 与报告 → 圈人侧在大盘执行 → 人群包
 * B：自然语言 → 必要追问 → 可视化筛选条件 → 用户确认 → 执行条件与 SQL → 大盘执行 → 人群包 */
/* 路径 A 的过程透出：按 user-cohort-auto-research 的 Step 0–9 划分状态，
 * 不按 skill 名平铺（6 个 skill 里只有 1 个是主链路的生成能力）。
 * 映射关系见 docs/圈人Agent_skill状态映射.md；stage 为与吴极侧约定的事件枚举。 */
const MAX_ROUND = 3; // 硬上限：最多 3 轮 SQL 迭代，样本证据查询不计轮次
const AGENT_LAYERS = [
  { stage: 'prepare', layer: '生成层', title: '校验输入', detail: '固化业务目标与正负样本，准备执行队列', skill: '' },
  { stage: 'load_refs', layer: '数据对齐与执行层', title: '读取口径与字段指南', detail: '读取标签表与画像表的字段含义与取值口径', skill: 'user-cohort-sql-prompt-generator' },
  { stage: 'sample_evidence', layer: '生成层', title: '学习种子特征', detail: '执行样本证据查询，归纳共性、差异与噪声信号', skill: 'bytedance-aeolus' },
  { stage: 'sql_candidate', layer: '生成层', title: '生成候选 SQL', detail: '按字段语义产出候选圈选 SQL，只生成不执行', skill: 'user-cohort-sql-prompt-generator', round: true },
  { stage: 'backtest', layer: '数据对齐与执行层', title: '样本回测与校正', detail: '只对样本回测，产出召回 / 误召指标与 badcase，决定是否再迭代', skill: 'bytedance-aeolus', round: true },
  { stage: 'select_best', layer: '数据对齐与执行层', title: '选定最终 SQL 与报告', detail: '按召回优先选出最佳一轮，产出圈选报告', skill: 'user-cohort-sql-prompt-generator' },
  { stage: 'memory', layer: '数据对齐与执行层', title: '沉淀运行记忆', detail: '写入本次运行现场，供后续复盘与复用', skill: 'mem0-cli' },
];
/* 两个入口对用户只呈现为「要不要带种子用户」，不出现链路 / 路径这类内部概念 */
const PATHS = {
  A: { key: 'A', name: '业务目标 ＋ 种子用户', brief: '带一批已确认的目标用户，Agent 学习共性后扩散，不再逐条确认条件' },
  B: { key: 'B', name: '自然语言圈人', brief: '只说诉求，按需追问关键口径，可视化确认条件后执行' },
};
function parseSeeds(text) {
  const parts = String(text || '').split(/[\s,，;；]+/).map((x) => x.trim()).filter(Boolean);
  const header = /^(uid|user_?id|id|用户id)$/i;
  const valid = new Set(); let dup = 0, invalid = 0;
  for (const x of parts) {
    if (header.test(x)) continue;
    if (!/^[A-Za-z0-9_-]{4,64}$/.test(x)) { invalid++; continue; }
    if (valid.has(x)) dup++; else valid.add(x);
  }
  const ids = [...valid];
  const mask = (x) => x.slice(0, 2) + '****' + x.slice(-2);
  return { count: Math.min(ids.length, SEED_MAX), over: Math.max(0, ids.length - SEED_MAX), dup, invalid, sample: ids.slice(0, 3).map(mask) };
}
function seedWarning(seed) {
  if (!seed || !seed.count) return '没有识别到有效的用户 ID';
  if (seed.count < SEED_MIN) return `至少需要 ${SEED_MIN} 个种子用户，当前 ${seed.count} 个`;
  return '';
}
const seedOk = (p) => !!p && p.count >= SEED_MIN;

function detect(query) { return Object.keys(SCENES).find((k) => SCENES[k].match.test(query)); }
function defaultAnswers(scene) {
  return Object.fromEntries(SCENES[scene].questions.map((q) => [q.id, q.options[q.pick || 0]]));
}
function buildConditions(task) {
  const list = SCENES[task.scene].conditions(task.answers).map((c) => ({ ...c }));
  return list
    .filter((c) => !task.removed.includes(c.tag))
    .map((c) => {
      const swap = c.tag ? task.swapped[c.tag] : undefined;
      if (swap === null) return null;
      const moved = c.tag && task.moved ? task.moved[c.tag] : undefined;
      const base = swap ? { ...c, tag: swap, value: c.value + '（替代口径）', replaced: c.tag } : c;
      return moved ? { ...base, group: moved } : base;
    })
    .filter(Boolean);
}
function hash(s) { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h; }
function estimate(task) {
  let n = SCENES[task.scene].base * (1 + (hash(task.id) % 13) / 100);
  if (Object.values(task.answers).some((v) => /30 天|3 公里|L4|180 天/.test(v))) n *= 0.6;
  n *= Math.pow(0.9, Object.keys(task.swapped).length);
  n *= Math.pow(0.93, Object.keys(task.moved || {}).length); // 组合关系被调整过，规模随之变化
  n = Math.round(n / 10) * 10;
  return task.target && task.target < n ? task.target : n;
}
function tagName(c) { return c.tag ? TAGS[c.tag].name : c.name; }
function buildSql(task, conds) {
  const rows = conds.filter((c) => c.tag).map((c) => ({ ...c, value: c.value.replace('（替代口径）', '') }));
  const alias = (i) => 't' + (i + 1);
  const lines = ['SELECT u.user_id', 'FROM   dim_user_base u'];
  rows.forEach((c, i) => {
    if (c.group !== 'exclude') lines.push(`${c.group === 'any' ? 'LEFT JOIN' : 'JOIN'} ${TAGS[c.tag].table} ${alias(i)} ON ${alias(i)}.user_id = u.user_id`);
  });
  lines.push("WHERE  u.date = '2026-09-28'");
  const any = [];
  rows.forEach((c, i) => {
    if (c.group === 'must') lines.push(`  AND ${alias(i)}.label IN ('${c.value}')`);
    if (c.group === 'any') any.push(`${alias(i)}.label IN ('${c.value}')`);
    if (c.group === 'exclude') lines.push(`  AND NOT EXISTS (SELECT 1 FROM ${TAGS[c.tag].table} x WHERE x.user_id = u.user_id AND x.label = '${c.value}')`);
  });
  if (any.length) lines.push(`  AND (${any.join('\n       OR ')})`);
  lines.push(`LIMIT  ${estimate(task)};`);
  return lines.join('\n');
}
function newTask(query) {
  const scene = detect(query);
  const id = 'AUD-' + Date.now().toString(36).toUpperCase();
  return {
    id, scene, query, title: SCENES[scene].title, created: new Date().toISOString(), updated: new Date().toISOString(),
    version: 1, answers: defaultAnswers(scene), target: null, seed: null, path: 'B', timing: null,
    removed: [], swapped: {}, moved: {}, granted: [], result: null, reportReady: false,
    effects: [], saved: false, messages: [],
  };
}
const Model = { TAGS, ALT, SCENES, detect, defaultAnswers, buildConditions, estimate, buildSql, newTask, parseSeeds, seedWarning, SEED_MAX };
if (typeof module !== 'undefined' && module.exports) { module.exports = Model; return; }

/* ---------------- 界面 ---------------- */
const KEY = 'utup.audience.agent.v2';
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n).toLocaleString('zh-CN');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/* 人群包默认 90 天有效，到期需重新执行 */
const expireAt = () => new Date(Date.now() + 90 * 864e5).toLocaleDateString('zh-CN');
const ICON = {
  spark: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.5l2 5.6 5.6 2-5.6 2L10 16.7l-2-5.6-5.6-2 5.6-2z"/></svg>',
  plus: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 4v12M4 10h12"/></svg>',
  task: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5h12M4 10h12M4 15h8"/></svg>',
  tag: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 10.5V4h6.5l7 7-6.5 6.5z"/><circle cx="6.5" cy="7.5" r="1"/></svg>',
  book: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h5a2 2 0 012 2v10a2 2 0 00-2-2H4zM16 4h-5a2 2 0 00-2 2v10a2 2 0 012-2h5z"/></svg>',
  lock: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 016 0V9"/></svg>',
  check: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="7.5"/><path d="M6.8 10.2l2.2 2.2 4.2-4.4"/></svg>',
  info: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="7.5"/><path d="M10 6v5M10 13.5v.5"/></svg>',
  clock: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="7.5"/><path d="M10 6v4l3 2"/></svg>',
  cycle: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M15.5 8A6 6 0 004.6 6.5M4.5 12a6 6 0 0010.9 1.5M4 3v3.5h3.5M16 17v-3.5h-3.5"/></svg>',
  filter: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 4h14l-5.5 6.5V16l-3-1.5v-4z"/></svg>',
  people: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7.5" cy="7" r="2.8"/><path d="M2.5 16c.6-2.8 2.6-4.3 5-4.3s4.4 1.5 5 4.3M13 4.6a2.6 2.6 0 010 4.8M14.5 11.9c1.6.5 2.7 1.8 3 4.1"/></svg>',
  chev: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 5l5 5-5 5"/></svg>',
  send: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 10l14-6-5 14-2.5-5.5z"/></svg>',
  side: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="14" height="12" rx="2"/><path d="M8 4v12"/></svg>',
};

let host = null, options = {}, tasks = [], activeId = null, view = 'home', busy = false;
let draft = '', sidebarOpen = true, panel = { open: false, tab: 'detail', full: false }, toast = '';
let page = 1, reportTimer = null, lastCount = 0, ticker = null;
let draftSeed = null, seedModal = null; // 首页待提交的种子；种子添加弹窗状态
let histQ = '', centerQ = ''; // 历史对话 / 任务中心关键词

function load() { try { tasks = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { tasks = []; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch { /* 存储不可用时只保留在本次页面 */ } }
const current = () => tasks.find((t) => t.id === activeId);
function notify(text) { toast = text; render(); setTimeout(() => { if (toast === text) { toast = ''; render(); } }, 2600); }

function tagState(id) {
  if (options.portal?.tagState) return options.portal.tagState(id) || { code: 'apply', label: '可申请' };
  return ['受控', '高敏'].includes(TAGS[id].level) ? { code: 'apply', label: '可申请' } : { code: 'active', label: '可使用' };
}
/* 开放 / 通用级标签自助申请、平台自动通过；只有受控 / 高敏标签需要走审批 */
const needsApproval = (id) => ['受控', '高敏'].includes(TAGS[id].level);
function shownState(task, id) {
  if (task.granted.includes(id)) return { code: 'active', label: '已开通' };
  const st = tagState(id);
  return st.code !== 'active' && !needsApproval(id) ? { code: 'active', label: '自助开通' } : st;
}
function missingTags(task) {
  const ids = [...new Set(buildConditions(task).map((c) => c.tag).filter(Boolean))];
  return ids.filter((id) => shownState(task, id).code !== 'active');
}

/* ---- 消息与步骤 ---- */
function push(task, msg) { msg.id = msg.id || Math.random().toString(36).slice(2, 9); msg.at = msg.at || Date.now(); task.messages.push(msg); task.updated = new Date().toISOString(); save(); render(); return msg; }
async function runSteps(task, msg, key) {
  for (const step of msg[key]) {
    if (step.status === 'done') continue;
    const t0 = Date.now();
    step.t0 = t0; step.status = 'running'; save(); render();
    await wait(420 + (hash(step.title) % 5) * 90);
    step.ms = Date.now() - t0; delete step.t0;
    step.status = 'done'; save(); render();
  }
}

async function start(query) {
  const q = query.trim();
  if (!q || busy) return;
  const task = newTask(q);
  task.seed = draftSeed; draftSeed = null;
  task.path = task.seed ? 'A' : 'B';
  tasks.unshift(task); activeId = task.id; view = 'task'; draft = ''; panel = { open: false, tab: 'detail', full: false };
  busy = true;
  push(task, { type: 'user', text: q + (task.seed ? `\n附带种子用户：${fmt(task.seed.count)} 个（${task.seed.name}）` : '') });
  if (task.path === 'A') { await runPathA(task); return; }
  const ack = push(task, { type: 'ack', open: true, steps: [
    { title: '理解需求', detail: `识别为「${task.title}」，保留业务原话`, status: 'wait' },
  ] });
  await runSteps(task, ack, 'steps');
  ack.open = false;
  push(task, { type: 'clarify', answered: false });
  busy = false; render();
}

/* 路径 A：目标与种子交给吴极侧 Agent，拿到 SQL 与报告后再由圈人侧在大盘执行。
 * 不经过追问与条件确认；SQL／报告生成完成不等于人群包已生成（PRD 4.3）。 */
async function runPathA(task) {
  busy = true;
  const t0 = Date.now();
  const gen = push(task, { type: 'ack', open: true, longRun: true,
    title: '已收到业务目标与种子用户，开始学习种子特征', steps: [
      ...AGENT_LAYERS.map((x) => ({
        title: x.round ? `${x.title}（第 1/${MAX_ROUND} 轮）` : x.title,
        detail: `${x.layer} · ${x.stage === 'prepare' ? `业务目标与 ${fmt(task.seed.count)} 个种子用户齐备，` : ''}${x.detail}`,
        skill: x.skill, status: 'wait',
      })),
    ] });
  await runSteps(task, gen, 'steps');
  gen.open = false;
  const agentMs = Date.now() - t0;
  push(task, { type: 'agent-out', version: task.version });
  const t1 = Date.now();
  const run = push(task, { type: 'ack', open: true, title: 'SQL 与报告已就绪，开始在大盘执行生包', steps: [
    { title: '大盘执行 SQL', detail: '由圈人侧在大盘执行 Agent 产出的 SQL', status: 'wait' },
    { title: '生成人群包', detail: '执行完成后产出人群包并关联报告', status: 'wait' },
  ] });
  await runSteps(task, run, 'steps');
  run.open = false;
  const conds = buildConditions(task);
  task.result = { size: estimate(task), version: task.version, at: new Date().toLocaleString('zh-CN', { hour12: false }), taskCode: String(6958700000 + hash(task.id + task.version)).slice(0, 10), packId: 'PKG-' + (hash(task.id) + task.version * 7), expire: expireAt(), conds, sql: buildSql(task, conds), seed: { ...task.seed } };
  task.timing = { agent: agentMs, run: Date.now() - t1 };
  task.reportReady = true;
  push(task, { type: 'result', version: task.version });
  busy = false;
  panel = { open: true, tab: 'sql', full: false }; page = 1;
  save(); render();
  notify('人群包已生成，已通过飞书消息通知你');
}

async function confirmClarify(task, msg) {
  if (busy) return;
  msg.answered = true;
  push(task, { type: 'user', text: SCENES[task.scene].questions.map((q) => `${q.title.replace(/？$/, '')}：${task.answers[q.id]}`).join('\n') });
  busy = true;
  const ack = push(task, { type: 'ack', open: true, steps: [{ title: '生成圈选条件', detail: '把业务口径映射为标签条件，保留必须 / 任一 / 排除关系', status: 'wait' }] });
  await runSteps(task, ack, 'steps');
  ack.open = false;
  push(task, { type: 'conditions', version: task.version, confirmed: false });
  busy = false; render();
}

async function confirmConditions(task, msg) {
  if (busy) return;
  msg.confirmed = true;
  const lack = missingTags(task);
  if (lack.length) { push(task, { type: 'permission', ids: lack, status: 'pending' }); return; }
  await execute(task);
}

async function execute(task) {
  busy = true;
  const t0 = Date.now();
  const tables = [...new Set(buildConditions(task).filter((c) => c.tag).map((c) => c.tag))];
  const mode = execMode(task);
  /* 单域不出现「生成 SQL」这一状态；跨域才多这一步（PRD 4.3） */
  const steps = mode.cross
    ? [
      { title: '生成圈选 SQL', detail: '跨域场景：把确认的条件转成可执行 SQL', tab: 'sql', status: 'wait' },
      { title: '大盘执行生包', detail: '执行 SQL 并产出人群包', tab: 'detail', status: 'wait' },
      { title: '同步人群报告生产数据', tab: 'report', status: 'wait' },
    ]
    : [
      { title: '下发生服 DMP 生包', detail: `单域场景（${mode.domains[0] || '电商'}）：直接按确认的条件生包，不生成 SQL`, tab: 'detail', status: 'wait' },
      { title: '同步人群报告生产数据', tab: 'report', status: 'wait' },
    ];
  const msg = push(task, { type: 'exec', version: task.version, open: true, openAnalysis: true, steps,
    analysis: [
      { title: '获取数据', detail: '按确认的条件读取标签表；通用级标签已自助开通', tables, tab: 'conditions', status: 'wait' },
      { title: '脚本分析', detail: '统计人群规模、消费分层、城市线级与年龄分布', tab: 'overview', status: 'wait' },
      { title: '报告生成', detail: '生成人群画像报告', tab: 'report', status: 'wait' },
    ] });
  await runSteps(task, msg, 'steps');
  task.result = { size: estimate(task), version: task.version, at: new Date().toLocaleString('zh-CN', { hour12: false }), taskCode: String(6958700000 + hash(task.id + task.version)).slice(0, 10), packId: 'PKG-' + (hash(task.id) + task.version * 7), expire: expireAt(), conds: buildConditions(task), sql: buildSql(task, buildConditions(task)), seed: null };
  task.timing = { sql: Date.now() - t0, cross: mode.cross };
  task.reportReady = false;
  await runSteps(task, msg, 'analysis');
  msg.open = false; msg.openAnalysis = false;
  push(task, { type: 'result', version: task.version });
  busy = false;
  panel = { open: true, tab: 'detail', full: false }; page = 1;
  render();
  clearTimeout(reportTimer);
  reportTimer = setTimeout(() => { const t = tasks.find((x) => x.id === task.id); if (t && t.result?.version === task.version) { t.reportReady = true; save(); render(); } }, 8000);
}

async function applyPermission(task, msg) {
  msg.status = 'applied'; save();
  if (options.portal?.applyTags) { options.portal.applyTags(msg.ids); return; }
  if (options.onMarket) { options.onMarket(); return; }
  notify('已加入标签广场的待选择清单');
}
async function useOtherTags(task, msg) {
  if (busy) return;
  msg.status = 'fallback';
  for (const id of msg.ids) { const alt = ALT[id]; task.swapped[id] = alt && shownState(task, alt).code === 'active' ? alt : null; }
  task.version += 1;
  push(task, { type: 'user', text: '由于部分标签暂无权限，改用可直接使用的标签替代，继续圈选。' });
  push(task, { type: 'conditions', version: task.version, confirmed: false, note: '已用可直接使用的标签替代无权限标签，人群规模会有变化，请确认后执行。' });
}
async function grantAndRun(task, msg) {
  if (busy) return;
  msg.status = 'granted';
  task.granted.push(...msg.ids);
  push(task, { type: 'user', text: '标签权限已开通，继续执行。' });
  await execute(task);
}

function modify(task, text) {
  if (busy) return;
  task.version += 1;
  let note = '已保留上一版条件，调整后请确认执行。';
  if (text) {
    push(task, { type: 'user', text });
    const m = text.match(/(\d+(?:\.\d+)?)\s*(万)?\s*人/);
    if (m) { task.target = Math.round(parseFloat(m[1]) * (m[2] ? 10000 : 1)); note = `目标规模调整为 ${fmt(task.target)} 人。`; }
  }
  push(task, { type: 'conditions', version: task.version, confirmed: false, note });
}

/* ---------------- 渲染 ---------------- */
function render() {
  if (!host || !host.isConnected) return;
  const stream = host.querySelector('.qa-stream');
  const task = current();
  // 有新消息时总是滚到底部；其余重绘保持用户当前的滚动位置
  const count = task ? task.messages.length : 0;
  const stick = !stream || count !== lastCount || stream.scrollHeight - stream.scrollTop - stream.clientHeight < 80;
  lastCount = count;
  const prevTop = stream ? stream.scrollTop : 0;
  const focusId = document.activeElement && host.contains(document.activeElement) ? document.activeElement.id : null;
  const showPanel = view === 'task' && task && panel.open && task.result;
  host.innerHTML = `<div class="qa ${sidebarOpen ? '' : 'qa-side-closed'} ${showPanel ? 'qa-with-panel' : ''} ${showPanel && panel.full ? 'qa-panel-full' : ''}">
    ${sidebar()}
    <section class="qa-chat">${view === 'center' ? taskCenter() : view === 'task' && task ? chat(task) : home()}</section>
    ${showPanel ? resultPanel(task) : ''}
    ${toast ? `<div class="qa-toast" role="status">${esc(toast)}</div>` : ''}
    ${seedModal ? seedModalView() : ''}
  </div>`;
  const s = host.querySelector('.qa-stream');
  if (s) s.scrollTop = stick ? s.scrollHeight : prevTop;
  if (focusId) { const n = host.querySelector('#' + focusId); if (n) { n.focus(); if (n.setSelectionRange && n.value) n.setSelectionRange(n.value.length, n.value.length); } }
  if (busy) startTicker(); else stopTicker();
}

function seedChip(seed, target) {
  const warn = seedWarning(seed);
  return `<div class="qa-seed-chip"><span class="qa-seed-ico">${ICON.people}</span><div><b>${fmt(seed.count)} 个种子用户</b><small>${esc(seed.source)} · ${esc(seed.name)}${seed.sample?.length ? ' · 样例 ' + seed.sample.map(esc).join('、') : ''}</small>${warn ? `<small class="qa-warn">${esc(warn)}</small>` : ''}</div>${target ? `<button type="button" class="qa-link" data-act="seed-open" data-target="${target}">更换</button><button type="button" class="qa-link" data-act="seed-remove" data-target="${target}">移除</button>` : ''}</div>`;
}
/* 种子只支持上传与粘贴：一期上限 100 个，而已产出的人群包动辄几十万人，
 * 直接当种子既超限也没有意义；真要从人群包里抽样做种子属于另一个需求。 */
function seedModalView() {
  const m = seedModal;
  const p = m.parsed;
  const body = m.tab === 'file'
    ? `<label class="qa-seed-drop"><input type="file" id="qa-seed-file" accept=".csv,.txt">${ICON.task}<b>${m.fileName ? esc(m.fileName) : '选择 CSV / TXT 文件'}</b><small>每行一个用户 ID；首行可以是 uid / user_id 表头；本期支持 ${SEED_MIN}–${SEED_MAX} 个</small></label>`
    : `<textarea id="qa-seed-text" rows="6" placeholder="粘贴用户 ID，支持换行、逗号或空格分隔">${esc(m.text)}</textarea>`;
  const summary = p ? `<div class="qa-seed-sum"><span>有效 <b>${fmt(p.count)}</b></span><span>重复 ${fmt(p.dup)}</span><span>格式不正确 ${fmt(p.invalid)}</span>${p.over ? `<span class="qa-warn">超出上限 ${fmt(p.over)}，已截断</span>` : ''}</div>` : '';
  const warn = p ? seedWarning(p) : '';
  return `<div class="qa-modal-mask"><div class="qa-modal" role="dialog" aria-label="添加种子用户">
    <header><b>添加种子用户</b><button type="button" class="qa-icon-btn" data-act="seed-cancel" aria-label="关闭">×</button></header>
    <p class="qa-muted">种子用户是你已经确认的一批目标用户（例如上一轮转化最好的那批人），会和业务目标一起用于本次圈选，我会学习他们的共性特征再向外扩散。系统只保留数量和脱敏样例，不落完整 ID 列表，本期不建种子库。</p>
    <div class="qa-tip">本期支持 <b>${SEED_MIN}–${SEED_MAX}</b> 个种子用户；超出部分会被截断。提交后 Agent 需要较长时间运行（约 2–3 小时），完成后会通过飞书 IM bot 通知你。</div>
    <nav class="qa-tabs">${[['file', '上传文件'], ['paste', '粘贴 ID']].map(([k, l]) => `<button type="button" class="${m.tab === k ? 'on' : ''}" data-act="seed-tab" data-tab="${k}">${l}</button>`).join('')}</nav>
    <div class="qa-modal-body">${body}${summary}</div>
    ${warn ? `<p class="qa-warn">${esc(warn)}</p>` : ''}
    <footer><button type="button" class="qa-outline sm" data-act="seed-cancel">取消</button><button type="button" class="qa-primary" data-act="seed-confirm" ${seedOk(p) ? '' : 'disabled'}>确认添加</button></footer>
  </div></div>`;
}
function sidebar() {
  /* 历史对话会一直累积：带关键词搜索并在列表内滚动，匹配标题与原始诉求 */
  const q = histQ.trim().toLowerCase();
  const hit = q ? tasks.filter((t) => `${t.title} ${t.query}`.toLowerCase().includes(q)) : tasks;
  const list = hit.map((t) => `<button type="button" class="qa-hist ${t.id === activeId && view === 'task' ? 'on' : ''}" data-act="open" data-id="${t.id}" title="${esc(t.query)}"><span>${esc(t.title)}</span>${t.seed ? `<em>种子 ${fmt(t.seed.count)}</em>` : ''}</button>`).join('');
  return `<aside class="qa-side">
    <div class="qa-side-head"><span class="qa-brand"><i>${ICON.spark}</i>圈人助手</span><button type="button" class="qa-icon-btn" data-act="toggle-side" aria-label="${sidebarOpen ? '收起' : '展开'}侧栏">${ICON.side}</button></div>
    <nav class="qa-side-nav">
      <button type="button" data-act="new" class="${view === 'home' ? 'on' : ''}">${ICON.plus}<span>新建对话</span></button>
      <button type="button" data-act="center" class="${view === 'center' ? 'on' : ''}">${ICON.task}<span>圈人任务中心</span></button>
      <button type="button" data-act="kb" class="is-soon">${ICON.book}<span>策略知识库</span><em>规划中</em></button>
    </nav>
    <div class="qa-side-title">历史对话<span>${fmt(tasks.length)}</span></div>
    ${tasks.length > 5 ? `<div class="qa-hist-search"><input id="qa-hist-q" placeholder="搜索历史对话" value="${esc(histQ)}">${histQ ? '<button type="button" class="qa-icon-btn" data-act="hist-clear" aria-label="清空搜索">×</button>' : ''}</div>` : ''}
    <div class="qa-hist-list">${list || `<p class="qa-muted">${q ? '没有匹配的历史对话' : '暂无历史对话'}</p>`}</div>
  </aside>`;
}

/* 只有一个入口：说诉求 ＋（可选）带一批种子用户。
 * 带了种子就走种子扩散，没带就走追问确认，用户不需要先选形态。 */
function home() {
  const hasSeed = !!draftSeed;
  const hint = hasSeed
    ? '已带上种子用户，我会先学习他们的共性，再向外扩散出相似人群；完成后以飞书消息通知你。'
    : '说清你想圈的人就行。缺关键口径时我会追问，再把筛选条件可视化给你确认，确认后才执行生包。';
  return `<div class="qa-home">
    <div class="qa-home-hero"><span class="qa-logo-lg">${ICON.spark}</span><h2>今天想圈哪些人？</h2><p>${esc(hint)}</p></div>
    ${composer(hasSeed ? '描述业务目标，例如：给这批种子用户找相似的高价值人群，用于双十一新品推广' : '描述你的圈人需求，建议包含：业务目标、目标人群特征、时间范围、消费口径、排除人群、目标规模', '开始圈人')}
    <div class="qa-seed-bar">${hasSeed ? seedChip(draftSeed, 'draft') : `<button type="button" class="qa-seed-add" data-act="seed-open" data-target="draft">${ICON.plus}种子用户<em>选填</em></button><span class="qa-muted">手上已有一批确认过的目标用户，就加上来让我照着找相似的人；没有也可以直接描述诉求</span>`}</div>
    <div class="qa-examples">${(hasSeed ? EXAMPLES_A : EXAMPLES_B).map(([k, v, tag]) => `<button type="button" data-act="example" data-q="${esc(v)}"><b>${k}${tag ? `<em class="qa-ex-tag${tag === '跨域' ? ' is-cross' : ''}">${esc(tag)}</em>` : ''}</b><span>${esc(v)}</span></button>`).join('')}</div>
  </div>`;
}

function composer(placeholder, label) {
  return `<div class="qa-composer"><textarea id="qa-input" rows="3" placeholder="${esc(placeholder)}" ${busy ? 'disabled' : ''}>${esc(draft)}</textarea>
    <div class="qa-composer-foot"><span class="qa-muted">Enter 发送 · Shift + Enter 换行</span><button type="button" class="qa-send" data-act="send" ${busy || !draft.trim() ? 'disabled' : ''}>${ICON.send}${label}</button></div></div>`;
}

function chat(task) {
  const last = task.messages[task.messages.length - 1];
  const chips = task.result && !busy && last?.type === 'result'
    ? `<div class="qa-chips">${task.path === 'A' ? '' : `<button type="button" data-act="modify">${ICON.filter}修改圈选条件 ${ICON.chev}</button>`}<button type="button" data-act="save-template">${task.saved ? '已存为模板' : '保存为模板'}</button></div>` : '';
  return `<header class="qa-chat-head"><h1 title="${esc(task.query)}">${esc(task.title)}</h1>${task.result && !panel.open ? `<button type="button" class="qa-link" data-act="panel" data-tab="detail">查看人群结果</button>` : ''}</header>
    <div class="qa-stream"><div class="qa-date">${esc(new Date(task.created).toLocaleString('zh-CN', { hour12: false }).slice(0, 16))}</div>
      ${task.messages.map((m, i) => message(task, m, i)).join('')}
      ${busy ? '<div class="qa-typing"><i></i><i></i><i></i></div>' : ''}
    </div>
    <div class="qa-bottom">${chips}${composer(task.path === 'A'
      ? '圈选逻辑由 Agent 从种子用户学习，不逐条改条件；可以补充业务目标，例如：这一版只要华东地区'
      : '您也可以用自然语言调整，例如：目标规模 5 万人、观察窗口改成近 30 天', '发送')}</div>`;
}

/* 连续的助手消息合并为一段，只在第一条显示头像与名字；最后一条在运行中带生成动效 */
const hhmmss = (t) => new Date(t).toLocaleTimeString('zh-CN', { hour12: false });
/* 执行中要让用户看见秒在走：不足 1 分钟给到 0.1s，超过 1 分钟按「M 分 SS 秒」 */
function secs(ms) {
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)} 分 ${String(total % 60).padStart(2, '0')} 秒`;
}
/* 已完成步骤的耗时 ＋ 正在跑的那一步到此刻为止的耗时 */
const sumSteps = (m) => ['steps', 'analysis'].reduce((n, key) => n + (m[key] || []).reduce(
  (k, x) => k + (x.ms || (x.status === 'running' && x.t0 ? Date.now() - x.t0 : 0)), 0), 0);
/* 本轮耗时：从这条助手消息起，到下一条用户消息为止 */
function roundMs(task, i) {
  let total = 0;
  for (let k = i; k < task.messages.length; k++) {
    const m = task.messages[k];
    if (m.type === 'user') break;
    total += sumSteps(m);
  }
  return total;
}
/* 任务累计耗时 */
function taskMs(task) { return task.messages.reduce((n, m) => n + sumSteps(m), 0); }
/* 只刷新时钟文本，不整页重绘：重绘会打断输入焦点和折叠状态 */
function tickClocks() {
  if (!host || !host.isConnected) return;
  const task = current();
  if (!task) return;
  host.querySelectorAll('[data-live="round"]').forEach((el) => {
    const i = +el.dataset.i;
    el.textContent = `本轮 ${secs(roundMs(task, i))} · 累计 ${secs(taskMs(task))}`;
  });
  host.querySelectorAll('[data-live="step"]').forEach((el) => {
    const t0 = +el.dataset.t0;
    if (t0) el.textContent = secs(Date.now() - t0);
  });
}
function startTicker() { if (!ticker) ticker = setInterval(tickClocks, 200); }
function stopTicker() { clearInterval(ticker); ticker = null; }
function bot(inner, o = {}) {
  const head = o.first === false ? '' : `<div class="qa-bot-name"><span class="qa-logo">${ICON.spark}</span>圈人助手${o.at ? `<time>${hhmmss(o.at)}</time>` : ''}${o.ms || o.live ? `<em class="qa-round-ms"${o.live ? ` data-live="round" data-i="${o.index}"` : ''}>本轮 ${secs(o.ms)}${o.totalMs && o.totalMs !== o.ms ? ` · 累计 ${secs(o.totalMs)}` : ''}</em>` : ''}</div>`;
  return `<div class="qa-bot${o.first === false ? ' qa-bot-cont' : ''}${o.live ? ' is-live' : ''}">${head}${inner}</div>`;
}
function stepIcon(s) { return s === 'done' ? `<i class="qa-si done">${ICON.check}</i>` : s === 'running' ? '<i class="qa-si run"></i>' : `<i class="qa-si wait">${ICON.clock}</i>`; }
function steps(msg, key, label, openKey) {
  const list = msg[key], done = list.filter((s) => s.status === 'done').length;
  const total = list.reduce((n, s) => n + (s.ms || 0), 0);
  const ms = (n) => (n / 1000).toFixed(1) + 's';
  return `<details class="qa-proc" data-msg="${msg.id}" data-open="${openKey}" ${msg[openKey] ? 'open' : ''}><summary>${done === list.length ? ICON.check : ICON.info}<span>${label} ${done}/${list.length}</span>${total ? `<em class="qa-ms">${ms(total)}</em>` : ''}</summary>
    <ol>${list.map((s) => `<li>${s.tab && s.status === 'done' ? `<button type="button" data-act="panel" data-tab="${s.tab}">` : '<div>'}${stepIcon(s.status)}<span><b>${esc(s.title)}</b>${s.detail ? '：' + esc(s.detail) : ''}${s.tables ? s.tables.map((id) => `<small class="qa-table-ref">选表：<code>${TAGS[id].table}</code><em class="${shownState(current(), id).code === 'active' ? 'ok' : ''}">${esc(shownState(current(), id).label)}</em></small>`).join('') : ''}${s.skill ? `<small class="qa-skill">skill <code>${esc(s.skill)}</code></small>` : ''}</span>${s.status === 'done' && s.ms ? `<em class="qa-ms">${ms(s.ms)}</em>` : s.status === 'running' ? `<em class="qa-ms qa-ms-run" data-live="step" data-t0="${s.t0 || 0}">${s.t0 ? ms(Date.now() - s.t0) : '执行中'}</em>` : ''}${s.tab && s.status === 'done' ? ICON.chev + '</button>' : '</div>'}</li>`).join('')}</ol></details>`;
}

function message(task, m, i) {
  if (m.type === 'user') return `<div class="qa-user"><div class="qa-user-name">你<span class="qa-avatar">U</span><time>${hhmmss(m.at)}</time></div><div class="qa-bubble">${esc(m.text).replace(/\n/g, '<br>')}</div></div>`;
  const prev = task.messages[i - 1];
  const o = { first: !prev || prev.type === 'user', at: m.at, live: busy && i === task.messages.length - 1 };
  if (o.first) { o.ms = roundMs(task, i); o.totalMs = taskMs(task); o.index = i; o.live = busy; }
  if (m.type === 'ack') return bot(`<p>${esc(m.title || '已收到你的消息，我将立即开始处理')}</p>${m.longRun ? '<div class="qa-tip qa-tip-run">当前种子人群包运行中，完成后会以飞书消息方式通知，请关注。可以先离开本页。</div>' : ''}${steps(m, 'steps', '查看分析过程', 'open')}`, o);
  if (m.type === 'clarify') return bot(clarifyCard(task, m), o);
  if (m.type === 'conditions') return bot(conditionsCard(task, m), o);
  if (m.type === 'permission') return bot(permissionCard(task, m), o);
  if (m.type === 'exec') return bot(`<p>已提交确认，开始圈选</p>${steps(m, 'steps', '执行完成', 'open')}${steps(m, 'analysis', '查看分析过程', 'openAnalysis')}`, o);
  if (m.type === 'agent-out') return bot(agentOutCard(task, m), o);
  if (m.type === 'result') return bot(resultCard(task, m), o);
  return '';
}

function clarifyCard(task, m) {
  const qs = SCENES[task.scene].questions;
  return `<p>有 ${qs.length} 个口径会改变入选范围，需要你确认，其他信息直接按原话处理：</p>
  <div class="qa-card"><div class="qa-card-title">${ICON.info}关键口径确认</div>
    ${qs.map((q) => `<div class="qa-q"><b>${esc(q.title)}</b><small>${esc(q.why)}</small><div class="qa-opts">${q.options.map((o) => `<button type="button" class="${task.answers[q.id] === o ? 'on' : ''}" data-act="answer" data-q="${q.id}" data-v="${esc(o)}" ${m.answered ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div></div>`).join('')}
    <div class="qa-card-foot">${m.answered ? `<span class="qa-done">${ICON.check}已确认</span>` : `<button type="button" class="qa-primary" data-act="clarify-ok" data-msg="${m.id}" ${busy ? 'disabled' : ''}>确认口径，生成条件</button>`}</div></div>`;
}

/* 路径 A：吴极侧 Agent 返回的 SQL 与报告；圈选逻辑由报告说明，用户不逐条确认条件 */
function agentOutCard(task, m) {
  /* 只展示 Agent 报告里真实存在的信息：run_id、样本、轮次与产物。
   * 不展示「圈选逻辑＝某几个标签」——那是路径 B 的条件卡，Agent 报告不透传这种结构。 */
  const h2 = hash(task.id + 'rep'), rounds = 2 + (h2 % 2);
  return `<p>已根据业务目标与 ${fmt(task.seed.count)} 个种子用户产出可执行 SQL 与圈选报告。</p>
  <div class="qa-card">
    <div class="qa-card-title">${ICON.check}Agent 产出<small>种子扩散</small></div>
    <div class="qa-cond"><span class="k">run_id</span><span class="v"><code>${esc(runIdOf(task))}</code></span></div>
    <div class="qa-cond"><span class="k">样本</span><span class="v">正样本 ${fmt(task.seed.count)} 个 · ${esc(task.seed.source)}；样本在首轮冻结，不随结果调整</span></div>
    <div class="qa-cond"><span class="k">迭代轮次</span><span class="v">${rounds} / 3 轮，已选出最佳一轮</span></div>
    <div class="qa-cond"><span class="k">产出物</span><span class="v">可执行 SQL ＋ 圈选报告（含迭代指标、错误分析与泛化检查）</span></div>
    <div class="qa-card-foot"><span class="qa-muted">SQL 与报告已生成，尚未在大盘执行；人群包以执行结果为准</span></div>
  </div>`;
}

function conditionsCard(task, m) {
  const live = !m.confirmed && m.version === task.version;
  const conds = buildConditions(task), lack = missingTags(task);
  const row = (c) => `<div class="qa-cond" title="${c.tag ? esc(TAGS[c.tag].table) : '平台规则'}"><span class="k">${esc(tagName(c))}</span><span class="v">${esc(c.value)}</span>${c.tag && lack.includes(c.tag) ? `<span class="qa-lock" title="暂无权限">${ICON.lock}</span>` : ''}${live && c.tag ? `<select class="qa-grp" data-tag="${c.tag}" aria-label="调整 ${esc(tagName(c))} 的组合关系">${GROUPS.map(([g, label]) => `<option value="${g}"${c.group === g ? ' selected' : ''}>${label}</option>`).join('')}</select><button type="button" class="qa-x" data-act="remove" data-tag="${c.tag}" aria-label="移除 ${esc(tagName(c))}">×</button>` : ''}</div>`;
  return `${m.note ? `<p>${esc(m.note)}</p>` : '<p>根据你的需求，整理出以下圈选条件：</p>'}
  <div class="qa-card qa-cond-card ${live ? '' : 'is-frozen'}">
    ${GROUPS.map(([g, label], i) => { const rows = conds.filter((c) => c.group === g); return rows.length ? `<div class="qa-card-title">${[ICON.cycle, ICON.filter, ICON.filter][i]}${label}<small>${g === 'must' ? 'AND' : g === 'any' ? 'OR' : 'NOT'}</small></div>${rows.map(row).join('')}` : ''; }).join('')}
    <div class="qa-cond"><span class="k">执行方式</span><span class="v"><span class="qa-pill">${esc(execMode(task).label)}</span> ${esc(execMode(task).note)}</span></div>
    <div class="qa-cond"><span class="k">预估人数</span><span class="v"><b id="qa-est">约 ${fmt(estimate(task))} 人</b><span class="qa-muted"> · 按当前条件估算，以执行结果为准</span></span></div>
    <div class="qa-cond"><span class="k">目标规模</span>${live ? `<input id="qa-target" type="number" min="100" step="100" placeholder="不限" value="${task.target || ''}"><span class="v qa-muted">人，超出时按偏好分截取</span>` : `<span class="v">${task.target ? fmt(task.target) + ' 人' : '不限'}</span>`}</div>
    <p class="qa-cond-tip">可以删除条件、调整组合关系（必须满足 / 任一满足 / 排除）或改目标规模；要换口径、改时间窗口直接在下面用自然语言说，我会给出新版本。</p>
    <div class="qa-card-foot">${live ? `${execMode(task).cross ? '<button type="button" class="qa-link" data-act="sql-preview">查看相关 SQL</button>' : ''}<button type="button" class="qa-primary" data-act="conditions-ok" data-msg="${m.id}" ${busy ? 'disabled' : ''}>确认并执行</button>` : `<span class="qa-done">${ICON.check}已提交确认 · V${m.version}</span>`}</div>
  </div>
  ${m.sql && live ? `<div class="qa-sql-inline"><div class="qa-card-title">${ICON.check}相关 SQL</div>${sqlBlock(buildSql(task, buildConditions(task)))}</div>` : ''}`;
}

function permissionCard(task, m) {
  const done = m.status !== 'pending' && m.status !== 'applied';
  const conds = buildConditions({ ...task, swapped: {}, removed: [] });
  return `<details class="qa-perm" open><summary>${ICON.lock}<span>${m.ids.length} 个标签权限待申请，快速审批无负担~</span></summary>
    ${m.ids.map((id) => { const c = conds.find((x) => x.tag === id); const st = tagState(id); return `<div class="qa-perm-row"><span class="qa-perm-icon">${ICON.lock}</span><div><div class="qa-perm-name"><b>${esc(TAGS[id].name)}</b><span class="qa-pill">${esc(TAGS[id].level)}</span><button type="button" class="qa-mini" data-act="market">标签详情 ${ICON.chev}</button></div><code>${TAGS[id].table}</code><p>用于 ${esc(c ? c.value : '圈选条件')} · <em>${esc(st.label)}</em></p></div></div>`; }).join('')}
    ${done ? `<p class="qa-done">${ICON.check}${m.status === 'fallback' ? '已改用其他标签' : '权限已开通，已继续执行'}</p>` : `<div class="qa-perm-actions">
      <button type="button" class="qa-primary" data-act="perm-apply" data-msg="${m.id}">一键申请权限</button>
      <button type="button" class="qa-outline" data-act="perm-other" data-msg="${m.id}">使用其他标签</button></div>
      ${m.status === 'applied' ? `<p class="qa-muted qa-center">已放进标签广场的待选择清单。审批通过后回到这里继续。<button type="button" class="qa-link" data-act="perm-granted" data-msg="${m.id}">权限已开通，继续执行</button></p>` : `<p class="qa-center"><button type="button" class="qa-link" data-act="perm-granted" data-msg="${m.id}">权限已开通，继续执行</button></p>`}`}
  </details>`;
}

function resultCard(task, m) {
  const stale = m.version !== task.result?.version;
  /* 路径 A 的报告与 SQL 由吴极侧 Agent 一起产出，到这一步已就绪；路径 B 的报告在生包后异步生产 */
  const lead = task.path === 'A'
    ? `人群包已生成，共 ${fmt(task.result && !stale ? task.result.size : 0)} 人，报告随 Agent 产出一并就绪，已通过飞书消息通知你。`
    : `我已按要求圈出 ${fmt(task.result && !stale ? task.result.size : 0)} 人。下方是人群结果和人群报告（报告异步产出，约 20 分钟）。`;
  return `<p>${lead}也可以前往<button type="button" class="qa-link" data-act="center">任务中心</button>管理任务。</p>
  <button type="button" class="qa-result" data-act="panel" data-tab="detail" ${stale ? 'disabled' : ''}>
    <span class="qa-chip">${ICON.people}人群包</span><b>${esc(task.title)}</b><small>人群规模 ${stale ? '（已被新版本替代）' : fmt(task.result.size) + ' 人'} · V${m.version}</small>
    <span class="qa-result-art"><i></i><i></i><i></i></span></button>
  <div class="qa-report-line">${ICON.clock}<span>人群报告 · ${task.reportReady && !stale ? '<b class="ok">已生成</b>' : '生成中'}</span>${!stale ? `<button type="button" class="qa-link" data-act="panel" data-tab="report">查看</button>` : ''}</div>
  ${stale ? '' : `<p class="qa-muted qa-deliver-line">人群包以 Hive 表交付生服 LDMP 建包，${esc(task.result.packId)} · 到 LDMP 使用。<button type="button" class="qa-link" data-act="to-ldmp">去 LDMP →</button></p>`}`;
}

/* ---- Markdown 渲染 ----
 * 吴极侧 Agent 的报告以 Markdown 原文返回，门户不二次加工，只做渲染。
 * 这里是一个够用的子集：标题、列表、表格、代码块、引用、加粗与行内代码。 */
function mdInline(t) {
  return esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}
function renderMd(src) {
  const lines = String(src).replace(/\r/g, '').split('\n');
  const out = []; let i = 0;
  const flushTable = () => {
    const rows = [];
    while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
    const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim());
    const head = cells(rows[0]);
    const body = rows.slice(/^\s*\|[\s:|-]+\|\s*$/.test(rows[1] || '') ? 2 : 1).map(cells);
    out.push(`<table class="qa-table"><thead><tr>${head.map((c) => `<th>${mdInline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${mdInline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
  };
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) {
      const lang = l.slice(3).trim(); const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre class="qa-sql"${lang ? ` data-lang="${esc(lang)}"` : ''}>${buf.map((x, n) => `<span><i>${n + 1}</i>${esc(x)}</span>`).join('')}</pre>`);
      continue;
    }
    if (/^\s*\|/.test(l)) { flushTable(); continue; }
    const hd = l.match(/^(#{1,6})\s+(.*)$/);
    if (hd) { out.push(`<h${Math.min(hd[1].length + 2, 6)}>${mdInline(hd[2])}</h${Math.min(hd[1].length + 2, 6)}>`); i++; continue; }
    if (/^\s*>\s?/.test(l)) { out.push(`<blockquote>${mdInline(l.replace(/^\s*>\s?/, ''))}</blockquote>`); i++; continue; }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l); const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''));
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((x) => `<li>${mdInline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (/^\s*---+\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (!l.trim()) { i++; continue; }
    out.push(`<p>${mdInline(l)}</p>`); i++;
  }
  return out.join('');
}

/* 吴极侧 Agent 报告（演示样例，字段以接口方最终返回为准）。
 * 注意：报告中的准确率 / 召回率是「标签提取相对参考集」的评估指标，不是最终圈人准确率。 */
/* run_id 与 Agent 报告里的一致：cohort_auto_research_<日期>T<序号> */
function runIdOf(task) {
  const r = task.result, h2 = hash(task.id + 'rep');
  const partition = String(r && r.at ? r.at.slice(0, 10) : '').replace(/\//g, '');
  return `cohort_auto_research_${partition}T${String(1000 + (h2 % 8999))}`;
}
function agentReportMd(task) {
  const r = task.result, seed = task.seed || { count: 0, source: '—' };
  const h2 = hash(task.id + 'rep');
  const rounds = 2 + (h2 % 2); // 实际执行轮次 ≤ 3
  const best = rounds;
  const gtPos = seed.count, gtNeg = Math.max(0, Math.round(seed.count * 0.8));
  const pred = [], recall = [], fp = [], acc = [];
  for (let i = 1; i <= rounds; i++) {
    recall.push(Math.min(0.99, (0.74 + ((h2 >> i) % 9) / 100 + (i - 1) * 0.08)));
    fp.push(Math.max(0, Math.round(gtNeg * (0.34 - (i - 1) * 0.09))));
    pred.push(Math.round(gtPos * recall[i - 1]) + fp[i - 1]);
    acc.push((Math.round(gtPos * recall[i - 1]) + (gtNeg - fp[i - 1])) / Math.max(1, gtPos + gtNeg));
  }
  const pct = (x) => (x * 100).toFixed(2) + '%';
  const partition = String(r && r.at ? r.at.slice(0, 10) : '').replace(/\//g, '');
  return [
    '# 人群圈选 Auto Research 最终报告',
    '',
    '## Task',
    '',
    `- run_id：${runIdOf(task)}`,
    `- 原始需求：${task.query}`,
    '- iteration limit：3 rounds hard max',
    `- 实际执行轮次：${rounds} 轮`,
    `- 数据分区：${partition}`,
    `- 正样本：${fmt(gtPos)} 个（${seed.source}）｜ 负样本：${fmt(gtNeg)} 个`,
    '- 候选全集：life_kg_user_profile_base_daily 最新分区 distinct 用户',
    '',
    '## Sample Summary',
    '',
    '正负样本在 Step 0 冻结，后续各轮评估均使用同一份样本，不因 SQL 结果调整 label。',
    '',
    '| 样本类型 | 数量 | profile 缺失 | tag 缺失 |',
    '| --- | --- | --- | --- |',
    `| 正样本 | ${fmt(gtPos)} | ${Math.round(gtPos * 0.04)} | ${Math.round(gtPos * 0.07)} |`,
    `| 负样本 | ${fmt(gtNeg)} | ${Math.round(gtNeg * 0.05)} | ${Math.round(gtNeg * 0.06)} |`,
    '',
    '## Iteration Summary',
    '',
    '每轮只执行样本限制版回测 SQL，全量 target_user_sql 只生成不执行。',
    '',
    '| round | status | pred_count | true_positive | false_negative | false_positive | positive_recall | sample_accuracy | decision |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...Array.from({ length: rounds }, (_, i) => {
      const tp = Math.round(gtPos * recall[i]);
      return `| ${i + 1} | 执行成功 | ${fmt(pred[i])} | ${tp} | ${gtPos - tp} | ${fp[i]} | ${pct(recall[i])} | ${pct(acc[i])} | ${i + 1 === best ? '选为最佳轮次' : '保留高召回，继续降低误召'} |`;
    }),
    '',
    `## Round ${best} 相对 Round ${best - 1}`,
    '',
    `- false_positive 减少 ${fp[best - 2] - fp[best - 1]} 个，positive_recall 提升 ${((recall[best - 1] - recall[best - 2]) * 100).toFixed(2)} 个百分点。`,
    '- 修改来自字段语义调整（放宽 profile 预过滤、收紧属性阈值），未针对单个样本做特判。',
    '',
    '## Selected Result',
    '',
    `- Selected round：Round ${best}`,
    '- 选择理由：positive_recall 更高，且误召数量同时下降；SQL 规则可用字段语义解释。',
    '- Precision / Recall tradeoff：当前偏向召回，适合作为候选召回层；若业务要高精度，需在人群包上再做一层语义精排。',
    '- 最终 target_user_sql 已生成，**未执行**；人群规模以圈人侧大盘执行结果为准。',
    '',
    '## Best SQL',
    '',
    '```sql',
    (r && r.sql) || buildSql(task, buildConditions(task)),
    '```',
    '',
    '## Error Analysis',
    '',
    '### False negative（正样本未被召回）',
    '',
    '| user_id | 原因 |',
    '| --- | --- |',
    `| U****${String(1000 + (h2 % 8999)).slice(-4)} | 画像预过滤阶段被排除，profile 关键字段缺失 |`,
    `| U****${String(2000 + (h2 % 7999)).slice(-4)} | 行为集中在单一类目，聚合特征未达阈值 |`,
    '',
    '### False positive（负样本被误召）',
    '',
    '| user_id | 疑似原因 |',
    '| --- | --- |',
    `| U****${String(3000 + (h2 % 6999)).slice(-4)} | 与目标人群共享同一类目前缀，但消费场景不同 |`,
    `| U****${String(4000 + (h2 % 5999)).slice(-4)} | 兴趣簇相邻，属于相关但非目标的需求 |`,
    '',
    '误召的结构特征：集中在相邻类目与证据等级偏弱的样本上，结构化字段难以单独区分。',
    '',
    '## Generalization Check',
    '',
    '- 是否避免硬编码样本 user_id？是。样本仅用于回测，不进入生产 SQL。',
    '- 规则是否能用字段语义解释？是。使用画像字段与标签聚合特征，未依赖样本偶然特征。',
    '- 是否避免为边界样本过拟合？是。未为单个 badcase 增加特判条件。',
    '- 可能失败的相邻人群：与目标共享类目或兴趣簇、但消费场景不同的人群，结构化字段难以单独区分。',
    '',
    '## Final Conclusion',
    '',
    '结构化字段适合构建高召回候选集；要进一步提高精度，需要在候选人群上增加语义精排，并用固定样本持续评估。',
    `本轮 SQL 可作为「${task.title}」的候选召回层基线。`,
  ].join('\n');
}

function sqlBlock(sql) {
  return `<pre class="qa-sql">${sql.split('\n').map((l, i) => `<span><i>${i + 1}</i>${esc(l)}</span>`).join('')}</pre>`;
}

/* ---- 右侧结果面板 ---- */
/* 评审结论：本期只保留人群明细、圈选条件、相关 SQL、人群报告；人群概览与效果回收后置 */
const TABS = [['detail', '人群明细'], ['conditions', '圈选条件'], ['sql', '相关 SQL'], ['report', '人群报告']];
/* 路径 A 的圈选逻辑由 Agent 报告承载，不单独展示可编辑的条件页（PRD 6.5）；
 * 路径 B 的单域场景不生成 SQL，也就没有「相关 SQL」页签 */
const tabsOf = (task) => (task.path === 'A'
  ? TABS.filter(([k]) => k !== 'conditions')
  : execMode(task).cross ? TABS : TABS.filter(([k]) => k !== 'sql'));

function resultPanel(task) {
  const r = task.result;
  return `<aside class="qa-panel" aria-label="人群结果">
    <header class="qa-panel-head"><div><h2>${esc(task.title)} · 人群结果</h2></div>
      <div><button type="button" class="qa-mini" data-act="full">${panel.full ? '退出全屏' : '全屏'}</button><button type="button" class="qa-icon-btn" data-act="close-panel" aria-label="关闭结果面板">×</button></div></header>
    <div class="qa-panel-bar qa-deliver">
      <div class="qa-deliver-head"><b>人群包 ${esc(r.packId)}</b><span class="qa-pill qa-pill-ok">可用</span><span class="qa-muted">${fmt(r.size)} 人 · V${r.version}</span></div>
      <dl class="qa-deliver-meta">
        <div><dt>生成时间</dt><dd>${esc(r.at)}</dd></div>
        <div><dt>数据分区</dt><dd>${esc(String(r.at).slice(0, 10))}</dd></div>
        <div><dt>有效期</dt><dd>${esc(r.expire)}（到期后需重新执行）</dd></div>
        <div><dt>执行方式</dt><dd>${esc(task.path === 'A' ? '大盘执行 Agent 产出的 SQL' : `${execMode(task).label}，${execMode(task).cross ? '大盘执行 SQL' : '生服 DMP 按条件生包'}`)}</dd></div>
      </dl>
      <p class="qa-muted">人群包以 Hive 表交付生服 LDMP 建包，可直接接入实验、投放等下游。</p>
      <button type="button" class="qa-outline sm" data-act="to-ldmp">去 LDMP 查看 / 使用</button>
    </div>
    <nav class="qa-tabs">${tabsOf(task).map(([k, n]) => `<button type="button" class="${panel.tab === k ? 'on' : ''}" data-act="panel" data-tab="${k}">${n}</button>`).join('')}</nav>
    ${task.version !== r.version ? `<div class="qa-panel-note">${ICON.info}条件已调整为 V${task.version}，当前展示的是 V${r.version} 的结果；确认执行后更新。</div>` : ''}
    <div class="qa-panel-body">${panelBody(task)}</div>
  </aside>`;
}

function panelBody(task) {
  const r = task.result, conds = r.conds || buildConditions(task), h = hash(task.id + r.version);
  if (panel.tab === 'detail') {
    /* 明细只透出「这个人为什么进来」，不展示标签取值本身：
     * 命中条件数与命中标签名用于解释，匹配分用于按目标规模截断，数据日期用于对齐口径。 */
    const names = conds.filter((c) => c.group !== 'exclude' && c.tag).map((c) => TAGS[c.tag].name);
    const domainOf = (k) => (k % 5 === 0 ? '跨域' : k % 2 ? '电商' : '生服');
    const rows = Array.from({ length: 10 }, (_, i) => {
      const k = (h + i * 37 + page * 101) % 997, j = (k * 13) % 97;
      const hitN = Math.min(conds.length, 2 + (j % 3));
      /* 每行命中的标签不同：从标签列表里按偏移取 hitN 个，列表里只展示前两个 */
      const hit = names.length ? Array.from({ length: Math.min(hitN, names.length) }, (_, n) => names[(j + n) % names.length]) : [];
      const hitNames = hit.length ? hit.slice(0, 2).join('、') + (hit.length > 2 ? ` 等 ${hit.length} 项` : '') : '—';
      return [`U****${String(1000 + k * 7).slice(-4)}`, `${hitN} / ${conds.length}`, (0.58 + (j % 41) / 100).toFixed(2), hitNames, domainOf(j), r.at.slice(0, 10)];
    });
    /* 评审结论：本期人群包只读，人群的增删与投放都在生服 LDMP 侧完成，门户不做批量剔除 */
    return `<div class="qa-toolbar"><input placeholder="输入用户 ID，按回车搜索"><span class="qa-spacer"></span><span class="qa-muted">任务 code：${r.taskCode} · 人群包 ID：${r.packId}</span><button type="button" class="qa-outline sm" data-act="download">下载</button><button type="button" class="qa-outline sm" data-act="to-ldmp">去 LDMP 建包</button></div>
      <table class="qa-table"><thead><tr><th class="qa-nowrap">用户 ID（脱敏）</th><th class="qa-nowrap">命中条件</th><th class="qa-nowrap">匹配分</th><th>命中标签</th><th class="qa-nowrap">来源域</th><th class="qa-nowrap">数据日期</th></tr></thead>
      <tbody>${rows.map((x) => `<tr><td><b>${x[0]}</b></td><td>${x[1]}</td><td><b>${x[2]}</b></td><td class="qa-ell" title="${esc(x[3])}">${esc(x[3])}</td><td>${x[4]}</td><td class="qa-nowrap">${esc(x[5])}</td></tr>`).join('')}</tbody></table>
      <p class="qa-muted">匹配分用于按目标规模截断，分值越高越贴近目标人群；明细只说明命中了哪些标签，不展示标签取值。</p>
      <div class="qa-pager"><span class="qa-muted">共 ${fmt(r.size)} 人 · 每页 10 条 · 第 ${page} / ${fmt(Math.ceil(r.size / 10))} 页</span>${[1, 2, 3, 4, 5].map((p) => `<button type="button" class="${p === page ? 'on' : ''}" data-act="page" data-p="${p}">${p}</button>`).join('')}</div>`;
  }
  if (panel.tab === 'conditions') {
    /* 三个条件组分块展示，组内关系写在小标题上，不再挤在同一张表的「条件组」列里 */
    const LOGIC = { must: ['AND', '组内条件全部满足'], any: ['OR', '组内满足任意一条即可'], exclude: ['NOT', '命中任意一条即被排除'] };
    const block = ([g, label]) => {
      const rows = conds.filter((c) => c.group === g);
      if (!rows.length) return '';
      return `<div class="qa-cond-block"><div class="qa-cond-block-head"><b>${label}</b><span class="qa-pill">${LOGIC[g][0]}</span><span class="qa-muted">${LOGIC[g][1]}</span></div>
        <table class="qa-table"><thead><tr><th>标签</th><th>取值</th><th>来源表</th><th>权限</th></tr></thead><tbody>${rows.map((c) => `<tr><td><b>${esc(tagName(c))}</b>${c.replaced ? `<small class="qa-muted"> 替代 ${esc(TAGS[c.replaced].name)}</small>` : ''}</td><td>${esc(c.value)}</td><td>${c.tag ? `<code>${TAGS[c.tag].table}</code>` : '平台规则'}</td><td>${c.tag ? esc(shownState(task, c.tag).label) : '—'}</td></tr>`).join('')}</tbody></table></div>`;
    };
    return `${GROUPS.map(block).join('')}
      <p class="qa-muted">组间关系：必须满足 AND（任一满足）AND NOT 排除。修改条件请在对话中点「修改圈选条件」，会生成新版本。</p>`;
  }
  if (panel.tab === 'sql') return `<div class="qa-toolbar"><span class="qa-muted">按 V${r.version} 条件生成</span><span class="qa-spacer"></span><button type="button" class="qa-outline sm" data-act="copy-sql">复制</button></div>${sqlBlock(r.sql || buildSql(task, conds))}`;
  if (panel.tab === 'report') {
    if (!task.reportReady) return `<div class="qa-empty">${ICON.clock}<b>人群报告生成中</b><p>报告异步产出，约 20 分钟。生成后会在对话中提示。</p><button type="button" class="qa-outline sm" data-act="report-now">刷新查看</button></div>`;
    if (task.path === 'A') return agentReportView(task);
    const feats = conds.filter((c) => c.tag).map((c, i) => [tagName(c), c.value, (1.4 + ((h >> i) % 18) / 10).toFixed(1)]);
    return `<section class="qa-report"><h4>一句话结论</h4><p>这批人中，${feats[0] ? `「${esc(feats[0][0])}」` : ''}是区分度最高的特征，建议分两批触达并保留对照组。</p>
      <h4>特征显著性（TGI）</h4><table class="qa-table"><thead><tr><th>标签</th><th>取值</th><th>TGI</th></tr></thead><tbody>${feats.map((f) => `<tr><td>${esc(f[0])}</td><td>${esc(f[1])}</td><td><b>${f[2]}</b></td></tr>`).join('')}</tbody></table>
      <h4>投放建议</h4><ul><li>先对 20% 人群做小流量实验，核心指标与对照组比较后再放量。</li></ul></section>`;
  }
  return '';
}

/* 路径 A 的报告由吴极侧 Agent 以 Markdown 返回：
 * 先给业务四段摘要（目标 / 依据 / 验证 / 局限），完整原文与 SQL 按需展开。 */
function agentReportView(task) {
  /* 摘要四块对齐 Agent 报告的真实章节：Task / Iteration Summary / Selected Result / Generalization Check。
   * 不自己编「圈选逻辑＝某几个标签」，报告里没有这种结构。 */
  const src = agentReportMd(task);
  const pick = (title) => { const m = src.match(new RegExp('## ' + title + '\\n([\\s\\S]*?)(?=\\n## |$)')); return m ? m[1].trim() : ''; };
  const card = (t, body) => `<div class="qa-rep-card"><h5>${t}</h5>${body}</div>`;
  return `<section class="qa-report">
    <div class="qa-tip">以下为本次圈选的研究报告（Markdown 原文，未经二次加工）。其中的<b>召回率 / 误召数是对你给的样本做回测得到的</b>，不代表最终圈人准确率；<b>报告生成不等于人群包已生成</b>，最终人群数以大盘执行结果为准。</div>
    <div class="qa-rep-grid">
      ${card('目标与样本', renderMd(pick('Task')))}
      ${card('迭代结果', renderMd(pick('Iteration Summary')))}
      ${card('选轮结论', renderMd(pick('Selected Result')))}
      ${card('已知局限', renderMd(pick('Generalization Check')))}
    </div>
    <div class="qa-rep-acts"><span class="qa-muted">报告为原样产出，字段与取回方式以最终接口为准</span></div>
    <details class="qa-proc qa-rep-full"><summary>${ICON.info}<span>展开完整报告（Markdown 原文）</span></summary><div class="qa-md">${renderMd(src)}</div></details>
  </section>`;
}

function taskCenter() {
  const q = centerQ.trim().toLowerCase();
  const rows = q ? tasks.filter((t) => `${t.title} ${t.query} ${t.result ? t.result.packId : ''}`.toLowerCase().includes(q)) : tasks;
  return `<header class="qa-chat-head"><h1>圈人任务中心</h1><input id="qa-center-q" class="qa-search" placeholder="搜索任务名、诉求或人群包 ID" value="${esc(centerQ)}"></header><div class="qa-center-body">
    <table class="qa-table"><thead><tr><th>任务</th><th>输入方式</th><th>状态</th><th>人群包</th><th>人群规模</th><th>更新时间</th><th></th></tr></thead><tbody>
    ${rows.map((t) => `<tr><td><b>${esc(t.title)}</b><br><small class="qa-muted">${esc(t.query.slice(0, 36))}</small></td><td>${t.seed ? `种子 ${fmt(t.seed.count)} 个` : '自然语言'}</td><td>${t.result ? '已完成' : t.messages.some((m) => m.type === 'permission' && m.status !== 'granted' && m.status !== 'fallback') ? '权限待申请' : (t.path === 'A' ? 'Agent 运行中' : '进行中')}</td><td>${t.result ? `<code>${esc(t.result.packId)}</code>` : '—'}</td><td>${t.result ? fmt(t.result.size) : '—'}</td><td>${esc(new Date(t.updated).toLocaleString('zh-CN', { hour12: false }).slice(5, 16))}</td><td><button type="button" class="qa-link" data-act="open" data-id="${t.id}">继续</button>${t.result ? `<button type="button" class="qa-link" data-act="to-ldmp">去 LDMP</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="7" class="qa-muted">${q ? '没有匹配的任务' : '还没有任务'}</td></tr>`}
    </tbody></table>
    <p class="qa-muted">带种子用户的任务需要 Agent 运行约 2–3 小时，完成后会以飞书消息通知；人群包统一以 Hive 表交付生服 LDMP 建包。</p></div>`;
}

/* ---------------- 事件 ---------------- */
async function onClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el || !host.contains(el) || el.disabled) return;
  const act = el.dataset.act, task = current();
  const msg = task && el.dataset.msg ? task.messages.find((m) => m.id === el.dataset.msg) : null;
  switch (act) {
    case 'toggle-side': sidebarOpen = !sidebarOpen; break;
    case 'hist-clear': histQ = ''; break;
    case 'new': view = 'home'; activeId = null; panel.open = false; break;
    case 'center': view = 'center'; panel.open = false; break;
    case 'market': if (options.onMarket) options.onMarket(); else location.href = 'https://utup-mvp-frontend.vercel.app/#market'; return;
    case 'kb': notify('策略知识库规划中：沉淀分析思路与历史策略，支持共建'); return;
    case 'open': activeId = el.dataset.id; view = 'task'; panel.open = !!current()?.result; break;
    case 'example': draft = el.dataset.q; render(); host.querySelector('#qa-input')?.focus(); return;
    case 'send': return send();
    case 'answer': task.answers[el.dataset.q] = el.dataset.v; save(); break;
    case 'clarify-ok': return confirmClarify(task, msg);
    case 'remove': task.removed.push(+el.dataset.tag); save(); break;
    case 'seed-open': seedModal = { target: el.dataset.target, tab: 'file', text: '', fileName: '', parsed: null }; break;
    case 'seed-tab': seedModal.tab = el.dataset.tab; seedModal.parsed = null; seedModal.text = ''; seedModal.fileName = ''; break;
    case 'to-ldmp': notify('正在打开生服 LDMP 的人群包'); return;
    case 'seed-cancel': seedModal = null; break;
    case 'seed-confirm': {
      const m = seedModal, p = m.parsed; if (!p || !p.count) return;
      const seed = { ...p, source: m.tab === 'file' ? '文件上传' : '粘贴', name: m.tab === 'file' ? m.fileName : '手动粘贴' };
      if (m.target === 'task') { task.seed = seed; save(); } else draftSeed = seed;
      seedModal = null; notify(`已添加 ${fmt(seed.count)} 个种子用户`); return;
    }
    case 'seed-remove': if (el.dataset.target === 'task') { task.seed = null; save(); } else draftSeed = null; break;
    case 'sql-preview': { const m = [...task.messages].reverse().find((x) => x.type === 'conditions'); m.sql = !m.sql; break; }
    case 'conditions-ok': return confirmConditions(task, msg);
    case 'perm-apply': return applyPermission(task, msg);
    case 'perm-other': return useOtherTags(task, msg);
    case 'perm-granted': return grantAndRun(task, msg);
    case 'modify': return modify(task);
    case 'panel': panel.open = true; panel.tab = el.dataset.tab; break;
    case 'close-panel': panel.open = false; panel.full = false; break;
    case 'full': panel.full = !panel.full; break;
    case 'page': page = +el.dataset.p; break;
    case 'report-now': task.reportReady = true; save(); break;
    case 'copy-sql': try { await navigator.clipboard.writeText(task.result.sql || buildSql(task, buildConditions(task))); notify('已复制 SQL'); } catch { notify('复制失败，请手动选择'); } return;
    case 'download': notify('人群包导出已开始，完成后以飞书消息通知你'); return;
    case 'save-template': task.saved = true; save(); notify('已保存为圈人模板，可在任务中心复用'); return;
    default: return;
  }
  render();
}
function send() {
  const text = draft.trim();
  if (!text || busy) return;
  const task = current();
  const isNew = !(view === 'task' && task);
  draft = '';
  if (isNew) start(text); else modify(task, text);
}
function onInput(e) {
  if (e.target.id === 'qa-input') { draft = e.target.value; const b = host.querySelector('[data-act="send"]'); if (b) b.disabled = busy || !draft.trim(); }
  if (e.target.id === 'qa-hist-q') { histQ = e.target.value; render(); return; }
  if (e.target.id === 'qa-center-q') { centerQ = e.target.value; render(); return; }
  if (e.target.id === 'qa-seed-text') { seedModal.text = e.target.value; seedModal.parsed = e.target.value.trim() ? parseSeeds(e.target.value) : null; render(); return; }
  if (e.target.id === 'qa-target') { const t = current(); const n = parseInt(e.target.value, 10); t.target = n > 0 ? n : null; save(); const est = host.querySelector('#qa-est'); if (est) est.textContent = '约 ' + fmt(estimate(t)) + ' 人'; }
}
async function onChange(e) {
  /* 条件行的组合关系下拉：改完立即重算预估人数 */
  if (e.target.classList && e.target.classList.contains('qa-grp')) {
    const t = current(); if (!t) return;
    t.moved = { ...(t.moved || {}), [e.target.dataset.tag]: e.target.value };
    save(); render(); return;
  }
  if (e.target.id !== 'qa-seed-file' || !seedModal) return;
  const f = e.target.files?.[0]; if (!f) return;
  if (!/\.(csv|txt)$/i.test(f.name)) { notify('请上传 CSV 或 TXT 文件'); return; }
  seedModal.fileName = f.name; seedModal.parsed = parseSeeds(await f.text()); render();
}
function onKey(e) {
  if (e.target.id === 'qa-input' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
}
function onToggle(e) {
  const d = e.target.closest?.('details[data-msg]');
  if (!d) return;
  const m = current()?.messages.find((x) => x.id === d.dataset.msg);
  if (m) m[d.dataset.open] = d.open;
}

root.AudienceWorkspace = {
  mount(node, opts = {}) {
    host = node; options = opts; load();
    host.classList.add('qa-host');
    host.addEventListener('click', onClick);
    host.addEventListener('input', onInput);
    host.addEventListener('change', onChange);
    host.addEventListener('keydown', onKey);
    host.addEventListener('toggle', onToggle, true);
    if (activeId && current()) view = 'task';
    sidebarOpen = host.clientWidth >= 1100;
    render();
  },
  unmount() {
    if (!host) return;
    host.removeEventListener('click', onClick);
    host.removeEventListener('input', onInput);
    host.removeEventListener('change', onChange);
    host.removeEventListener('keydown', onKey);
    host.removeEventListener('toggle', onToggle, true);
    stopTicker();
    host = null; busy = false;
  },
  openAsset() { view = 'home'; activeId = null; render(); },
};
})(typeof window !== 'undefined' ? window : globalThis);
