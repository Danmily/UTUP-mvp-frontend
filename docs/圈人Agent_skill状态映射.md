# 圈人 Agent · 吴极侧 skill 与前端状态映射

> 依据：`user_interest_tag_skill` 仓库（6 个 skill ＋ 2 份 auto-research 流程定义）
> 适用：路径 A（业务目标 ＋ 种子用户）。路径 B 不调用这些 skill。
> 状态：待与吴极侧确认后固化进 PRD 4.4。

## 一、先说结论：6 个 skill 不是 6 个前端状态

6 个 skill 里只有 **1 个**是路径 A 主链路的生成能力，其余分别是执行引擎、记忆、真值生成、事后反思，以及另一条「标签检索」链路的生成能力。前端状态要按 **`user-cohort-auto-research.md` 的 Step 0–9** 来划，而不是按 skill 名字平铺。

| skill | 角色 | 在路径 A 的位置 |
|---|---|---|
| `user-cohort-sql-prompt-generator` | **人群圈选 SQL 生成**（主链路核心） | 全程，Step 1 / 2 / 3 / 6 |
| `bytedance-aeolus` | 数据执行引擎（Hive / ClickHouse） | 每次跑 SQL，Step 2 / 4 |
| `mem0-cli` | 运行记忆与经验沉淀 | Step 9 |
| `whitelist-user-gt-generation_v1` | 真值（GT）生成 | **不在路径 A**：人群场景的 GT 就是用户给的正负样本 |
| `user-tag-search` | 用户兴趣标签检索 SQL 生成 | **不在路径 A**：属于「查某用户的兴趣标签」另一条链路 |
| `user-tag-badcase-reflection` | badcase 复盘与经验沉淀 | **不在主链路**：由用户事后反馈触发 |

## 二、路径 A 的状态映射表

前端状态按「层」展示，每个状态对应 auto-research 的一个或一组 Step。

| # | 前端状态（业务可见） | 层 | `stage` 枚举 | 对应 Step | 实际调用 | 完成信号 |
|---|---|---|---|---|---|---|
| 1 | 校验输入 | 生成层 | `prepare` | Step 0 / 0.5 | 圈人侧，不调 skill | run_id 生成、正负样本固化、队列选定 |
| 2 | 读取口径与字段指南 | 数据对齐与执行层 | `load_refs` | Step 1 | `user-cohort-sql-prompt-generator`（references） | field_guide / profile_guide / 类目表读取完成 |
| 3 | 学习种子特征 | 生成层 | `sample_evidence` | Step 2 | `user-cohort-sql-prompt-generator` ＋ `bytedance-aeolus` | 样本证据 SQL 执行成功，产出正负样本共性 / 差异 / 噪声 |
| 4 | 生成候选 SQL（第 N/3 轮） | 生成层 | `sql_candidate` | Step 3（首轮）/ Step 6（后续轮） | `user-cohort-sql-prompt-generator` | 产出候选 `target_user_sql`（**只生成不执行**） |
| 5 | 样本回测与校正（第 N/3 轮） | 数据对齐与执行层 | `backtest` → `reflect` | Step 4 / 5 | `bytedance-aeolus` | 产出本轮三项指标与 badcase，并给出下一轮修改方向 |
| 6 | 选定最终 SQL 与报告 | 数据对齐与执行层 | `select_best` → `report` | Step 7 / 8 ＋ 产物 | `user-cohort-sql-prompt-generator` | selected round 确定，轮次详情 md ＋ 最终报告 md 落盘 |
| 7 | 沉淀运行记忆 | 数据对齐与执行层 | `memory` | Step 9 | `mem0-cli` | `cohort_auto_research_run` 写入成功 |

交接点之后由圈人侧承接，不再属于 skill 范围：

| # | 前端状态 | 层 | 说明 |
|---|---|---|---|
| 8 | 大盘执行 SQL | 执行层 | 圈人侧拿 selected `target_user_sql` 在大盘执行 |
| 9 | 生成人群包并交付 | 执行层 | Hive 表交付生服 LDMP 建包 |

### 状态 4、5 是一个循环

`sql_candidate → backtest → reflect` 最多循环 **3 轮**（硬上限）。样本证据 SQL（状态 3）**不计入**轮次。

前端要点：
- 进度条**总步数不固定**，不要写死「5/5」。建议显示 `第 N/3 轮`，轮次结束再推进到状态 6。
- 可以提前停止（指标已达标 / 继续只能靠样本偶然特征），此时轮次少于 3 轮属正常。
- 某轮 SQL 执行失败**也计入 3 轮**，前端要展示失败原因，不要表现成"卡住重试"。

## 三、事件契约（建议）

吴极侧每个状态变化推一条事件，前端按 `stage` 查表渲染，不解析 skill 内部细节：

```json
{
  "run_id": "cohort_auto_research_20261022T103000",
  "stage": "backtest",
  "status": "running",
  "round": 2,
  "max_round": 3,
  "skill": "bytedance-aeolus",
  "started_at": "2026-10-22T10:42:11+08:00",
  "finished_at": null,
  "metrics": {
    "positive_recall": 0.78,
    "false_positive_cnt": 3,
    "sample_accuracy": 0.86
  },
  "error": null
}
```

约定：
- `stage` 取值固定为上表七个；前端收到未知值时降级为所属层的通用文案，不报错。
- `status`: `running | done | failed`。
- `round` 仅在 `sql_candidate` / `backtest` / `reflect` 有意义，其余为 null。
- `metrics` 仅在 `backtest` 之后有值。
- 终态事件额外带：`selected_round`、`target_user_sql`、`report_path`、`round_details_path`、`badcase_user_ids`、`memory_status`。

## 四、四个必须在前端说清楚的口径

1. **指标是样本回测指标，不是最终圈人准确率。** `positive_recall` / `false_positive_cnt` / `sample_accuracy` 都是对用户给的 labeled samples 算的，人群规模要等大盘执行后才有。
2. **最终 SQL 只生成、不执行。** skill 明确规定全量 `target_user_sql` 不在 Agent 侧执行，每轮只跑样本限制版回测。这正好对上「Agent 产 SQL ／ 圈人侧在大盘生包」的分工，前端不要把"SQL 已就绪"显示成"人群包已生成"。
3. **报告不透传「圈选逻辑＝某几个标签」。** 按实跑报告（2026-10-15 早八人快速美妆）的结构，Agent 产出的是 Task / Sample Summary / Iteration Summary / Selected Result / Best SQL / Error Analysis / Generalization Check / Final Conclusion，没有「用了哪几个标签」这种条件清单——那是路径 B 的条件卡。前端不要自造这一行。
4. **耗时来自每轮的 Aeolus 查询。** 样本证据 1 次 ＋ 每轮回测 1 次，最多 4 次 Hive 查询，这是 2–3 小时预期的来源，也是必须走飞书 bot 异步通知的原因。

## 五、前端怎么把「Agent 正在想什么」透传出来

真实报告（`user-tag-auto-research` 跑通的那份）给了一个重要信号：**Agent 的过程信息是「轮次 ＋ 指标 ＋ 决策理由」，不是一串思考文本**。所以前端不要做"打字机式思考流"，要做**可追溯的轮次卡**。

### 三层信息，三种展示密度

| 层 | 给谁看 | 展示形态 | 内容 |
|---|---|---|---|
| L1 一句话状态 | 所有人，常驻 | 对话里一行 ＋ 进度 | 「正在第 2/3 轮回测样本」 |
| L2 轮次卡 | 想知道为什么的业务 | 折叠面板，每轮一张卡 | 本轮指标、相比上一轮的变化、decision 一句话 |
| L3 完整报告 | 研发 / 要复查的人 | 结果面板的 Markdown 原文 | Agent 返回的全文，不二次加工 |

默认展开 L1＋L2，L3 折叠。

### L1：状态行怎么写

按前面的 `stage` 表取文案，**动词 ＋ 对象 ＋ 轮次**，不写内部 skill 名（skill 名放在二级小字里，给研发排查用）：

```
校验输入 → 读取口径与字段指南 → 学习种子特征
→ 生成候选 SQL（第 1/3 轮）→ 样本回测与校正（第 1/3 轮）
→ 生成候选 SQL（第 2/3 轮）→ 样本回测与校正（第 2/3 轮）
→ 选定最终 SQL 与报告 → 沉淀运行记忆
```

要点：
- **总步数不固定**，进度用「第 N/3 轮」而不是「5/7」。
- 每步完成后把耗时留在行尾（真实链路里每轮都要跑 Hive，耗时是有意义的信息）。
- 失败不隐藏：某轮 Aeolus 执行失败也算一轮，状态行要显示「第 1 轮执行失败，已进入第 2 轮」。真实报告里 Round 1 就是 Aeolus 失败后离线复现的。

### L2：轮次卡放什么

每完成一轮追加一张卡，字段直接取事件里的 `metrics`：

```
第 2 轮 · 执行成功                                    0.6s
召回 83.0%（↑7.0pp）  误召 6 个（↓2）  样本准确率 79.6%
decision：选为最佳轮次
变化：收紧了属性阈值，未损失正样本召回
```

三条规则：
1. **只展示指标和 decision，不展示 SQL 正文**（skill 明确规定样本回测 SQL 不外露）。
2. **必须标注"这是样本回测指标"**，否则业务会当成最终圈人准确率。
3. 轮次之间展示 delta（↑↓），这是业务唯一能看懂"它在变好"的信号。

### L3：完整报告

Agent 返回 Markdown，前端直接渲染，章节顺序保持原样（Task / Sample Summary / Iteration Summary / Selected Result / Best SQL / Error Analysis / Generalization Check / Final Conclusion）。**不要把报告拆成自定义卡片再拼回去**——真实报告里有 Error Analysis 的具体 user_id 和 Generalization Check 的自查问答，这些结构重排后就失真了。

门户只在报告上方加一条口径提示条（指标是样本回测指标、报告 ≠ 人群包）。

### 还要考虑的两件事

- **异步**：2–3 小时的任务，用户大概率已经离开页面。所以 L1/L2 必须能**从任务中心回放**，而不只是对话里的实时动画；飞书 bot 通知里带 `run_id` 和回到该任务的链接。
- **降级**：拿不到中间事件时（只在结束时返回一次），L1 退化为「Agent 运行中」＋ 预计时间，L2 在结束后一次性补齐全部轮次卡。这个降级路径要先问清楚，决定前端是做流式还是做轮询。

## 六、待确认（给吴极侧）

1. ~~**负样本**~~：**已定为二期**。一期只收一批种子（正样本），报告中须带 precision 风险提示；二期再把输入拆成「目标样本 / 排除样本」。
2. **事件推送方式**：上面的事件契约是推送（webhook / 消息）还是前端轮询 run 状态？`run_id` 是否可作为查询键。
3. **报告取回**：最终报告是 Markdown 文件路径，门户侧如何取回（接口返回正文，还是给可访问的文件地址）。
4. **badcase 反思入口**：`user-tag-badcase-reflection` 面向的是 `user-tag-search` / `user-tag-auto-research`，人群链路是否有对应的 cohort badcase 复盘能力？一期不做，但要知道后续挂在哪。
5. **标签检索链路**：`user-tag-search` ＋ `whitelist-user-gt-generation_v1` 对应的是「查某用户的兴趣标签」，门户是否要开第二个入口？若要，需要另一张映射表。
