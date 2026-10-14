# VeryMath → dsh-verymath 接入矩阵（工作草稿 v1）

> 状态：Phase2 逆向分析进行中（4×council-glm 并行）。本文件记录**已实证**的事实，
> 评审结论回来后合并成 v2 终稿。每条事实标注证据来源（命令/文件路径）。

## 已实证事实（2026-10-15 主线验证）

### 环境与依赖探测（全部真实执行过）

| 事实 | 证据 |
| --- | --- |
| Lean doctor CLI 自包含、优雅降级 | `AI4Math-Lean-Agents/skills/lean-runtime/scripts/ai4m_lean.py doctor` → 结构化 JSON，`elan.available=false` 时 ok:true status:reported |
| Lean smoke-test 无环境时 ok:false + missing_lean_workspace | `ai4m_lean.py smoke-test` → `{"ok":false,"status":"missing_lean_workspace",...}` |
| Lean 子命令丰富 | `ai4m_lean.py --help`：env/doctor/check/smoke-test/configure/prove/formalize/repair/complete-sorries/batch/review/detect-sorry/minimize-failure/verify-delivery（14 个子命令） |
| Sage runner 优雅降级 | `sagemath_runner.py --json` 无 sage 时输出 "No Python command with SageMath import support was found..." 退出码 0 |
| Sage 体积：53MB API 文本 + 4.6MB manifest | `du -sh AI4Math-Sagemath-skill/sagemath-skill/references/*`（api 53M, reference_manifest.jsonl 4.6M, domain_index.json 504K） |
| Sage 许可证 GPLv3 | `AI4Math-Sagemath-skill/LICENSE`（另 note: runner 脚本与 references 的许可需逐文件核实） |
| math-glossary 上游 19 测试全绿 | `python3 -m unittest discover -s skills/math-glossary/tests` → Ran 19 tests, OK；且我们捆绑的 scripts 与上游**逐字节一致**（diff 证实） |
| 我们捆绑的 5 个 glossary 脚本全部可执行 | 每个 `--help` rc=0；backup 真实回环 ✓；export 真实产出 xlsx ✓（openpyxl 已装） |
| Optimization 仓库结构 | 6 个子技能：cdopt-optimization（有 scripts+references+agents）、osqp-solver（有 scripts）、mixed-integer-programming、second-order-cone-programming、or-solver、optskills（有 skill_library 子目录） |
| Writing 仓库结构 | 2 个子技能：paper-writing、math-beamer（Beamer 演示文稿工作流） |
| Lean 仓库结构 | 3 个子技能：lean-formalization、lean-runtime（scripts/config/prompts/schemas/examples 全套）、lean-setup |
| Evolving 体积 25MB，其中 examples 12MB | `du -sh`；技能只有一个 openevolve-experiment-workflow |
| co-mathematician 是独立 app | harness（Python CLI co_math 20 模块）+ server（Node ESM 6 文件）+ web + workspace 约定（GOALS.yaml/PROJECT.md/skill_handoffs.jsonl/messages.jsonl） |
| co-math workspace 依赖极轻 | pyproject: PyYAML + pypdf + tomli（>=3.10） |

### 体积红线（打包约束）

- Sagemath references 53MB —— **不能整体塞进 npm 包**（npm 单包不建议 > 几 MB）。方案：
  a) 只带 scripts + domain_index（~600KB），references 让用户按需获取/或单独发布；
  b) 或者 references 走 `sage_ref_search.py` 按需查询但文件留在外部路径（DSH_HOME 配置指向）。
- Evolving examples 12MB —— 同样按需，不随包。

## 方向 × 覆盖现状（issue #152 六方向）

| 方向 | 上游仓库 | 现状 | 本轮目标 |
| --- | --- | --- | --- |
| 论文阅读 | AI4Math-Paper-Reading | math-paper-reading 5 模块已接入；paper-to-skill/after-ocr/graph-theory 未接 | 评审后决定：graph-theory 优先（独立场景）；after-ocr 待定；paper-to-skill 重（含 auto-research harness） |
| 独立工具 | AI4Math-MathTool | math-glossary 已接（查询+upsert+build）；matlab-runner 未接 | matlab-runner 评估（无 MATLAB 环境时价值有限，倾向 skill-only + 环境检查） |
| 写作与优化 | AI4Math-Writing / Optimization | **零** | V1 接 paper-writing + math-beamer（纯提示词）；Optimization 接 osqp（有 scripts 可测）+ 其余按依赖分批 |
| 计算与形式化 | Lean-Agents / Sagemath / Computational-Mathematics | **零** | V1 接 Lean（doctor/烟测/降级完美）；Sage 需许可证决策 + 体积策略；Computational-Mathematics 待评审 |
| 研究工作流 | co-mathematician / Auto-Research / Evolving | **零** | 倾向"浅整合"：workspace 目录约定 + skill_handoff 概念映射到 DSH 工作区；不移植整个 app |
| 教材 | VeryMath-textbook-copilot | 零 | 独立 TS app，评估后倾向不整合（issue 未点名） |

### 上游测试套件离线跑分（python3 -m unittest，2026-10-15 实测）

| 仓库 | 测试数 | 结果 | 备注 |
| --- | --- | --- | --- |
| AI4Math-MathTool (math-glossary) | 19 | OK | 已接为 test:upstream |
| AI4Math-Lean-Agents (lean-runtime) | 50 | OK | 全离线 |
| AI4Math-Evolving | 32 | OK | 全离线 |
| AI4Math-Optimization | 30 | OK (skipped=2) | 全离线 |
| AI4Math-Auto-Research | 25 | OK | 全离线 |
| AI4Math-Computational-Mathematics | 18 | OK | 全离线 |
| AI4Math-Writing | 7 | OK | 全离线 |
| AI4Math-MathTool (根) | 17 | OK (skipped=1) | |
| AI4Math-Paper-Reading | 3 | OK | |
| AI4Math-Sagemath-skill | 无测试 | — | GPLv3 |
| co-mathematician | node 测试 (runs-history.test.mjs) | 未跑 | 需 npm |

**结论：所有 MIT 仓库都有离线测试套件，全部通过 —— 分批接入时每批可带上游测试做回归门。**

### 额外实证（Optimization 真实求解，2026-10-15）

- 本机安装 osqp 1.1.3 后，`skills/osqp-solver/scripts/solve_qp.py` 真实求解了 2 变量 QP：
  x≈[0.25, 0.75]，status.classification=solved，且脚本自带**独立 KKT 验证**（verification 块含
  complementarity/dual 阈值检查）→ `verymath_opt_solve` 工具化路径完全可行，执行+验证是确定性的。
- 无依赖时结构化降级：`error.kind=dependency` + pip 安装提示，退出码 0。
- `check_osqp_environment.py` / `check_cdopt_environment.py` 输出 ready:false + install_hint（环境探测工具直接可用）。
- 注意：本机 pip 装 osqp 把 numpy 升到 2.5.4（pptagent 要求 <2.0）——接入 OSQP 时 README 需写明 numpy 版本权衡。

### 额外实证（Lean 工具粒度）

- `ai4m_lean.py detect-sorry --file x.lean` **无需 Lean 环境**（纯文本分析）：检测 sorry/admit/axiom，
  结构化 JSON 输出（ok:false + findings[line/text]）→ 可直接包成 verymath_lean_detect_sorry 工具。
- Lean doctor/smoke-test/env 均优雅降级（详见上表证据）。

### Evolving 试点预验证（主线实测，2026-10-15）

- `validate_project.py --json <示例项目>` → ok:true，唯一 warning 是缺失 LLM_API_KEY（设计内）。rc=0。
- `summarize_run.py --json <空目录>` → 结构化 `hasBest:false`，优雅降级。rc=0。
- `interactive_session.py --workspace <tmp> status` → 正常。rc=0。
- 结论：三个脚本可直接包成 verymath_evolve_validate / verymath_evolve_summarize 工具，
  interactive_session 的 run/tail/stop 留给 DSH Jobs（或先 skill 内 shell 引导）。

### council task-3 已回（研究工作流方向）—— 核心结论

- **Evolving = 最佳首个试点**：1 包 4 脚本零声明依赖、合成测试覆盖进程生命周期（假 CLI 全链路）、
  validate_project/summarize_run 与 verymath_paper_validate 工具模式同构、run/tail/stop ↔ DSH Jobs 一一映射。
- **Auto-Research 三技能跟进**（discover-math-problems / proof-blueprint-review / open-problem-research-pipeline）：
  纯方法论零 API，与 math-paper-reading 形成 reading→discovery→proof-review 链；角色分离天然映射 DSH 子代理。
- **不整合**：danus-helper-dsh（绑 DSH 0.1.0-rc.x 版本断层）、graph-theory-researcher（与 math-paper-reading 重叠+300行shell校验难维护）、
  co-mathematician 本体（=单机迷你 DSH，重复造轮子；仅提炼 workspace 闸门 schema 与 suggest-skills CJK 评分两个概念）。
- co-math 有价值可移植资产：GOALS.yaml 目标状态机 + workstream 完成闸门（gating.py:60-71，纯文件契约）、
  CJK 数学别名评分表（skills.py:30-41）、PDF 材料提取的进程隔离+限额纪律（materials.py:170-186）。
- Evolving SKILL.md 自带跨技能路由出口："演化结果产生定理主张 → 路由到 proof-blueprint-review 或 lean-formalization"。

## 待评审输入（4 个 council-glm 报告将回答）

1. Writing/Optimization 各子技能的依赖与测试可行性（B/D/E）
2. Lean 接入形态：包 doctor 为 verymath_lean_check 工具 vs 技能内嵌
3. Sage GPLv3 隔离策略裁决 + references 分发策略
4. co-mathematician 的 workspace 约定哪些值得抽进 DSH
5. paper-to-skill/after-ocr/graph-theory 的优先级与体积
6. matlab-runner 对无 MATLAB 学生的真实价值

## 决策待定项（Phase3 需收敛）

- [ ] SageMath：集成（隔离方式）/ 只留安装指引 / 完全不集成
- [ ] 大体积 references 的分发模型（随包 / 按需下载 / 外部路径）
- [ ] Optimization 六技能的批次划分（osqp 先行？）
- [ ] Auto-Research 与我们已接入 paper-to-skill 的关系（issue #152 表格里 paper-to-skill 属论文阅读方向）

---
*评审报告回来后本文件升级为 v2 终稿；council 输出存于 research/reports/*
