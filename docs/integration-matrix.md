# VeryMath → dsh-verymath 接入矩阵

> 本文件记录接入决策与**已实证**的事实，每条事实标注证据来源（命令/文件路径）。
> 逆向分析阶段的多模型并行评审结论已合并进本文；原始评审材料存于开发机的 research/reports/（不随包分发）。

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

## 方向 × 覆盖现状（issue #152 六方向，含教材；issue 表格本身五行不含教材）

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

### 评审结论：研究工作流方向

- **Evolving = 最佳首个试点**：1 包 4 脚本零声明依赖、合成测试覆盖进程生命周期（假 CLI 全链路）、
  validate_project/summarize_run 与 verymath_paper_validate 工具模式同构、run/tail/stop ↔ DSH Jobs 一一映射。
- **Auto-Research 三技能跟进**（discover-math-problems / proof-blueprint-review / open-problem-research-pipeline）：
  纯方法论零 API，与 math-paper-reading 形成 reading→discovery→proof-review 链；角色分离天然映射 DSH 子代理。
- **不整合**：danus-helper-dsh（绑 DSH 0.1.0-rc.x 版本断层）、graph-theory-researcher（与 math-paper-reading 重叠+300行shell校验难维护）、
  co-mathematician 本体（=单机迷你 DSH，重复造轮子；仅提炼 workspace 闸门 schema 与 suggest-skills CJK 评分两个概念）。
- co-math 有价值可移植资产：GOALS.yaml 目标状态机 + workstream 完成闸门（gating.py:60-71，纯文件契约）、
  CJK 数学别名评分表（skills.py:30-41）、PDF 材料提取的进程隔离+限额纪律（materials.py:170-186）。
- Evolving SKILL.md 自带跨技能路由出口："演化结果产生定理主张 → 路由到 proof-blueprint-review 或 lean-formalization"。

### 评审结论：写作与优化方向

**Writing（MIT, commit 418eb2e）**：
- `paper-writing`（8步写作流 + 6子技能 + 5模板）→ **skill，优先级高**：零依赖零脚本；需扁平化重构
  （6子技能→模块md，因插件捆绑技能发现器只readdir一层）；与 math-paper-reading（结构产物→source packet）
  和 verymath_glossary_query（双语查术语）天然闭环。
- `math-beamer`（8阶段4闸门 + 23模板×46预览）→ **skill，中**：需新增 verymath_beamer_check 探测 latexmk；
  严禁 vendor template-source-index 里的 ECNU 第三方模板；体积可接受。
- 小缺陷：paper-writing README 引用的 validate_skill_repo.py 断链（属于 organizer 仓库）。

**Optimization（MIT, commit a054d39a）**：
- `osqp-solver` → **both（skill + verymath_osqp_check/solve 工具），高**：全仓工程质量最高
  （700行确定性 JSON→JSON runner + 11态状态门 + 3种独立KKT/证书验证器 + 500行合成测试）；
  solve_qp.py 与现有 Python spawn 桥完美匹配（exit 0/2/3、原子写、schema版本号）。
  注意：frontmatter `>-` 块标量必须改单行（插件解析器只认单行）；上游自述"候选状态未合并"，钉 commit。
- `optskills`（103张LP原型卡）→ skill 中：删掉"每次 git ls-remote"外呼步骤。
- `or-solver` → skill 中（环境配置配套件，对接 verymath_python_check）。
- `cdopt-optimization` → skill + verymath_cdopt_check，低（torch/jax 重栈只探测不装）。
- `second-order-cone-programming` → skill 低（frontmatter 修复后；CBLIB 版权头保留）。
- **`mixed-integer-programming` 暂缓**：examples.md 是 SOCP 错版拷贝（实质内容缺陷），等上游修复。
- **benchmark 数字不可信**（宣称 100 问题 100% 通过率但无复现脚本，AI 生成痕迹）——接入文案不引用。
- 黄金联动线：osqp 的 outputs/<run_id>/verification.json 作为 paper-writing "experiment 型断言"标准证据。

### 评审结论：论文阅读深挖 + 独立工具

**接入（P1）**：
- `graph-theory-paper-reading` → 第 3 个捆绑技能目录（零代码接入，VeryMathSkillProvider 自动扫描；
  注意是第 3 个不是第 4 个——现捆绑 2 个技能）；改 probe-runtime 断言 + README 表。
- `after-ocr` → 技能随包 + `verymath_ocr_scan` 工具（scan_markdown_ocr.py 纯标准库 ~650 行，
  JSON 输出，上游自带 unittest）；EduWork 扫描件场景直接受益。
- **上游 glossary 测试补齐（补丁级）**：vendor tests/ 进插件包；`verymath_glossary_build` 把 exit 3
  （JSON 完成 Excel 待完成）映射为结构化部分成功而非 throw；补 requirements-ai.txt；
  SKILL.md 工具表补 upsert 行（修复与手改 JSON 的自相矛盾）；触发词补"翻译 agent 查询/更新"。
- 包卫生 lint 移植（frontmatter 键最小化 + 无本地路径/密钥正则）；实测能抓到 `.ruff_cache` 会被打进 npm 包。

**不接**：
- paper-to-skill 9 技能链（conda+MinerU 云 API 隐私+下载审批超 MVP）；仅摘 proof_pattern_taxonomy.md +
  quality_rubric.md 做深读附录。
- matlab-runner（无 MATLAB 学生触发即 MCP_UNAVAILABLE，死重+误导；借鉴其错误九分类/调用预算到工具层文档）。
- textbook-copilot（独立 app，Apache-2.0 许可差异；read-pages.mjs 零 Python PDF 读取器可后摘）。

**已接入部分的行为缺口（E 专项，7 项）**：requirements-ai.txt 缺失、upsert 未进 SKILL 工具表、
exit 3 契约断层、触发词弱化、tests/agents 元数据损失、.ruff_cache 污染、math-paper-reading 引用不存在的 examples/。

### 评审结论：计算与形式化方向

**Computational-Mathematics（MIT）→ 高优先第一批**：
- `least-squares` 整技能随包（零脚本零运行时，12 级降级链，环境检测指引与 verymath_python_check 无缝衔接）。
- `invariant-computation` 整技能随包 + `verymath_invariant_validate` 工具（现成 JSON Schema + 示例 + 负例测试，
  与 verymath_paper_validate 同型）。建议再加 `verymath_scipy_check`（numpy/scipy/sklearn 分层探测）。
- `scientific-computing-reproduction` 暂缓整包（Codex 生态耦合），仅按需摘零依赖脚本。

**Lean-Agents（MIT）→ 中优先第二批**：
- lean-setup + lean-formalization 两个公开技能 + lean-runtime 支撑层原样随包（不可拆）。
- 工具：`verymath_lean_detect_sorry`（无 Lean 环境也有真实价值——纯文本分析）；
  环境探测与 patch 审查走随包脚本 `ai4m_lean.py doctor / review`（bash 调用，未包成模型工具）。
  不移植 Numina/Archon 后端。
- **elan shim 陷阱（必须照抄）**：`.elan/bin` 下的 lean/lake 绝不能跑 `--version`（触发 GB 级隐式工具链下载）；
  版本从 lean-toolchain 文件读（上游 tool_status.py:33-41）。
- GB 级工具链不随包——上游本就是"检测+引导+批准后安装"设计；共享工作区 ~/.ai4math/lean-workspace 概念带入。

**Sagemath-skill（GPLv3 ⚠）→ 完全不集成（当前证据下最优解）**：
- GPLv3 传染 + 语料 47.5MB 膨胀 npm 包 + Windows 强制 WSL + 上游零测试 + 技能契约依赖全量语料。
- 附条件升级路径：目录隔离+子进程调用组合（需法务确认 mere-aggregation）；或独立 GPL 发行渠道。
- `verymath_sage_check` 探针可 TS 独立重写（不携带 GPL 文件），但属法务确认项，MVP 不碰。

## 评审输入（多模型并行评审已回答）

1. Writing/Optimization 各子技能的依赖与测试可行性（B/D/E）
2. Lean 接入形态：包 doctor 为 verymath_lean_check 工具 vs 技能内嵌
3. Sage GPLv3 隔离策略裁决 + references 分发策略
4. co-mathematician 的 workspace 约定哪些值得抽进 DSH
5. paper-to-skill/after-ocr/graph-theory 的优先级与体积
6. matlab-runner 对无 MATLAB 学生的真实价值

## 决策待定项（已收敛）

- [ ] SageMath：集成（隔离方式）/ 只留安装指引 / 完全不集成
- [ ] 大体积 references 的分发模型（随包 / 按需下载 / 外部路径）
- [ ] Optimization 六技能的批次划分（osqp 先行？）
- [ ] Auto-Research 与我们已接入 paper-to-skill 的关系（issue #152 表格里 paper-to-skill 属论文阅读方向）

---
> 决策均已收敛并落地；原始评审材料存于开发机 research/reports/（不随包）


---

## 最终状态（2026-10-15 完成轮）

## 各项决策的最终处置

### 1. Sagemath（选定的路线：TS 干净重写）✅ 完成
- `src/core/sage.ts`：干净房间实现评分契约（无 GPL 代码），语料独立于包（~/.verymath/sagemath-corpus，CC BY-SA）
- `verymath_sage_check`（corpus+binary 双探测）+ `verymath_sage_search`（反幻觉查询）
- 实测：3196 行 manifest 30ms 加载、搜索 25ms、真语料摘录；E2E 通过（corpus 可用、binary 缺失如实降级）
- sage 二进制：miniforge 装至 ~/.verymath/miniforge，`conda create -n sage sage=10.9` 下载中（2-3GB）
- E2E 证据：/tmp/e2e-sage.log（SAGE_TOOLS_VERIFIED）

### 2. MATLAB（用户装 R2025b）✅ 完成
- MathWorks 官方 matlab-mcp-server v0.14.0 → ~/matlab-mcp/，`--setup-matlab` 完成
- dsh-mcp-client 配置：5 工具 `mcp__matlab__*` 全部注册
- E2E#1（真实计算）：rank=2/det=-2/cond=14.93 来自真 MATLAB（MATLAB_EXEC_VERIFIED）
- E2E#2（验收场景）：check_matlab_code 干净 + run_matlab_test_file 2 passed + detect_matlab_toolboxes
  确认 Optimization/Symbolic R2025b（MATLABRUNNER_ACCEPTANCE_VERIFIED）
- matlab-runner 技能已捆绑（MCP 配置说明内嵌）

### 3. MIP 修复 ✅ 完成
- git 考古确认上游 examples.md 自创建即 SOCP 错版（3018b23）
- 恢复 191a4e3^ 的 linear-programming/examples.md（6 LP 示例）→ lp-examples.md
- 新写 mip-examples-verified.md：背包（最优 220，枚举交叉核对）+ 3×3 指派（最优 9，
  匈牙利算法核对），PuLP 2.8+CBC 实测；PuLP 4.x API 不兼容已记录
- E2E 证据：解算过程与最优值在本机真跑

### 4. 其余仓库最终状态
- math-beamer：TeX Live 2025 本机已装，seminar-minimal-zh 现场编译出 PDF（exit 0）→
  **已接入**（0.3.1：bundle + `verymath_beamer_check` 探测工具，探测 latexmk/xelatex/forest/ctex）
- paper-to-skill：MinerU 云 API 是唯一转换路径（隐私考量维持暂缓）；mineru 4.0.12 本地模式存在（重）
- agent-laboratory-workflow：维持暂缓（conda 重部署+patch 脆弱）
- co-mathematician / textbook-copilot：维持概念提炼结论

## 技能/工具最终清单
- 16 bundled skills（math-glossary, math-paper-reading, graph-theory-paper-reading, after-ocr,
  paper-writing, discover-math-problems, proof-blueprint-review, open-problem-research-pipeline,
  least-squares, invariant-computation, mixed-integer-programming, osqp-solver, math-beamer,
  lean-formalization, lean-setup, matlab-runner）
- 14 model tools（glossary ×3, python_check, osqp ×2, ocr_scan, lean_detect_sorry,
  sage ×2, paper_validate, paper_graph, research_gate, beamer_check）
- 外部集成：MATLAB MCP server（5 tools）、Sage corpus（3196 docs）
