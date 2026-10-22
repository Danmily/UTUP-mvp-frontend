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

## 四、三个必须在前端说清楚的口径

1. **指标是样本回测指标，不是最终圈人准确率。** `positive_recall` / `false_positive_cnt` / `sample_accuracy` 都是对用户给的 labeled samples 算的，人群规模要等大盘执行后才有。
2. **最终 SQL 只生成、不执行。** skill 明确规定全量 `target_user_sql` 不在 Agent 侧执行，每轮只跑样本限制版回测。这正好对上「Agent 产 SQL ／ 圈人侧在大盘生包」的分工，前端不要把"SQL 已就绪"显示成"人群包已生成"。
3. **耗时来自每轮的 Aeolus 查询。** 样本证据 1 次 ＋ 每轮回测 1 次，最多 4 次 Hive 查询，这是 2–3 小时预期的来源，也是必须走飞书 bot 异步通知的原因。

## 五、待确认（给吴极侧）

1. **负样本**：`user-cohort-sql-prompt-generator` 要求正负样本，负样本缺失时 precision 风险高。当前 demo 只收了一批种子（正样本），是否要在输入上拆成「目标样本 / 排除样本」？不拆的话，报告里必须带 precision 风险提示。
2. **事件推送方式**：上面的事件契约是推送（webhook / 消息）还是前端轮询 run 状态？`run_id` 是否可作为查询键。
3. **报告取回**：最终报告是 Markdown 文件路径，门户侧如何取回（接口返回正文，还是给可访问的文件地址）。
4. **badcase 反思入口**：`user-tag-badcase-reflection` 面向的是 `user-tag-search` / `user-tag-auto-research`，人群链路是否有对应的 cohort badcase 复盘能力？一期不做，但要知道后续挂在哪。
5. **标签检索链路**：`user-tag-search` ＋ `whitelist-user-gt-generation_v1` 对应的是「查某用户的兴趣标签」，门户是否要开第二个入口？若要，需要另一张映射表。
