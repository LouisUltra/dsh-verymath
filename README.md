# dsh-verymath

**简体中文** | [English](README_EN.md)

<p align="center"><strong>VeryMath 数学科研能力接入 DSH / EduWork 的社区插件。</strong><br><sub>双语数学术语库 · 数学论文结构化阅读 · 技能与工具一体</sub></p>

`@louisultra/dsh-verymath` 把 [VeryMath](https://github.com/orgs/VeryMath/repositories) 的 AI4Math 技能与工具封装为 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness)插件，适用于 [EduWork](https://github.com/ECNU/EduWork) 及其他 DSH 0.2.x 宿主。对应 [ECNU/EduWork#152](https://github.com/ECNU/EduWork/issues/152) 的首批场景。

## 快速上手

装好插件后，在 EduWork 或任意 DSH 0.2.x 宿主里直接说这两句，就能看到能力本身：

**① 把一份 CSV 变成可查询的双语术语库**（需要本机 `python3` + `PyYAML`。`verymath_python_check` 只确认 `python3` 可用；缺 `PyYAML` 时脚本会报 `No module named 'yaml'`，用 `pip install PyYAML` 补上）

```text
从 source.csv 构建一份中英数学术语表，输出 glossary/glossary.json；
然后查「同调」对应的英文。
```

得到符合 math-glossary 合同的 `glossary/glossary.json`（条目有序、`term_id` 唯一、`idx` 连续）和 `同调 → homology` 的查询结果。
输入样例：[`docs/examples/source.csv`](docs/examples/source.csv)。

**② 读一篇数学预印本，看主定理依赖哪些引理**（纯文件操作，不需要 Python、不需要联网）

```text
帮我读 papers/maynard/fulltext.txt（arXiv 1311.4600）的第 1 节，
把里面的定义提取成结构 JSON 并用工具校验。
```

再追问「画出 Theorem 1.2 的依赖关系，标明每个节点对应的原文位置」，就得到定理依赖图。
论文全文仓库不分发（第三方许可），按 [`docs/examples/README.md`](docs/examples/README.md) 里的命令自行下载并转成文本。

其余 12 项能力（OCR 后校对、二次规划、混合整数规划、Lean、Sage 文档查询、MATLAB、Beamer 等）的「谁在什么情况下用、用户怎么说、需要什么输入、最后得到什么、运行条件与实测记录」逐项写在 [`docs/capability-examples.md`](docs/capability-examples.md)。

## 界面

插件带一个浏览器半侧：**左侧栏「数学科研」入口**，点开是能力面板（14 个工具清单与用法指引）。
注册走宿主的 `sidebar.panellist`（左栏列表槽）与布局的 `main`（keyed 槽，键与入口 id 一致），
所以 DSH web 与 EduWork 桌面端都能显示；宿主没装客户端插件机制时这部分自动不生效，
工具与技能不受影响。

## 提供的能力

**模型工具**（安装即用，Agent 自动调用）：

| 工具 | 用途 |
| --- | --- |
| `verymath_glossary_query` | 查询双语（英中）数学术语库 JSON：精确、前缀、子串、term_id、子领域匹配；返回例句，支持按子领域过滤消歧。 |
| `verymath_glossary_build` | 运行上游 `math-glossary` Python 脚本，从 CSV/TSV/JSON/YAML 构建或扩充术语库。 |
| `verymath_glossary_upsert` | 读论文/翻译时顺手存词：自动维护 term_id、排序与连续 idx 等合同不变量，无需手改 JSON。同一英文的另一种译法存为 `en__N` 别名行（不覆盖已有译名）；带 `term_id` 则纠正指定那一行。 |
| `verymath_python_check` | 检查本机 Python 3 可用性并给出安装提示。 |
| `verymath_paper_validate` | 校验 `math-paper-reading` 产出的 `<slug>_structure.json`（实体类型、依赖完整性）。 |
| `verymath_paper_graph` | 论文依赖图引擎：批次合并、`cited_by` 重建、`shared_node` 枢纽、环检测、双向阅读路径、`focus` 传递闭包、Mermaid 渲染（>40 实体自动降级）。 |
| `verymath_ocr_scan` | OCR Markdown 错误候选定位（胶连算符/字体误识/美元失衡/环境失配等 22 类规则；候选仅供 after-ocr 逐段审校，需 Python）。 |
| `verymath_osqp_check` / `verymath_osqp_solve` | OSQP 求解栈探测（主版本门 >=1,<2）/ JSON 契约 QP 求解：11 态状态门 + 独立 KKT 与不可行证书验证（需 osqp Python 栈）。 |
| `verymath_lean_detect_sorry` | Lean 文件的 sorry/admit/axiom 禁用词扫描——**无需 Lean 工具链**（需要本机 Python 3，脚本随包），patch 验收安全门。 |
| `verymath_research_gate` | 研究工作区三道闸门校验（目标批准/工作流完成/最终渲染）：report.md 强制三节、独立审阅人、阻断性评审解决状态——纯文件契约校验。 |
| `verymath_sage_check` / `verymath_sage_search` | SageMath 文档语料 + 二进制探测 / 3196 篇官方文档的**反幻觉 API 查询**。语料取自 SageMath 官方 Sphinx 参考手册（10.9.beta9，CC BY-SA 3.0），默认放 `~/.verymath/sagemath-corpus`，可用 `VERYMATH_SAGE_CORPUS` 覆盖；只查文档、**不提供 Sage 代码执行**。Sagemath-skill 本体（GPLv3）未收录，查询与打分逻辑是干净房间 TS 重实现。 |
| `verymath_beamer_check` | math-beamer 编译前的 TeX 工具链探测：latexmk、xelatex（中文模板需要）、forest/ctex 宏包（kpsewhich 定位）；不安装不编译，缺件时给安装提示并要求只交付 .tex 源码。 |

每一项能力的**场景示例**（谁在什么情况下用、可复制的提示词、输入样例、预期产物、运行条件与验证情况）见 [`docs/capability-examples.md`](docs/capability-examples.md)。

**随包技能**（注册进 DSH 技能目录，模型与用户均可触发）：

| 技能 | 用途 | 上游 |
| --- | --- | --- |
| `math-glossary` | 从 PDF/词典/表格构建、维护、查询双语术语库的完整工作流。 | [AI4Math-MathTool](https://github.com/VeryMath/AI4Math-MathTool) `math-glossary` v0.1.0 |
| `math-paper-reading` | 论文结构化提取、定理依赖分析、深读、文献检索、引用管理。 | [AI4Math-Paper-Reading](https://github.com/VeryMath/AI4Math-Paper-Reading) v4.2 |
| `graph-theory-paper-reading` | 图论论文六维深读与证明树 LaTeX 报告。 | [AI4Math-Paper-Reading](https://github.com/VeryMath/AI4Math-Paper-Reading) |
| `after-ocr` | 公式密集 OCR Markdown 的通篇审校与修复纪律。 | [AI4Math-Paper-Reading](https://github.com/VeryMath/AI4Math-Paper-Reading) |
| `paper-writing` | 有源可溯的数学论文写作：骨架、断言-证据台账、义务审计、符号一致性。 | [AI4Math-Writing](https://github.com/VeryMath/AI4Math-Writing) |
| `discover-math-problems` | 从模糊背景到问题菜单、猜想格与工作订单的数学问题发现。 | [AI4Math-Auto-Research](https://github.com/VeryMath/AI4Math-Auto-Research) |
| `proof-blueprint-review` | 证明蓝图生成与验证者式审查（生成/验证角色分离）。 | [AI4Math-Auto-Research](https://github.com/VeryMath/AI4Math-Auto-Research) |
| `open-problem-research-pipeline` | 开放问题的检索→方法分析→证明框架→报告四段工作流。 | [AI4Math-Auto-Research](https://github.com/VeryMath/AI4Math-Auto-Research) |
| `least-squares` | 最小二乘拟合与参数估计（OLS/WLS/正则化/非线性/贝叶斯，12 级降级链）。 | [AI4Math-Computational-Mathematics](https://github.com/VeryMath/AI4Math-Computational-Mathematics) |
| `invariant-computation` | 代数/拓扑/几何不变量的计算路由与证据报告（审批式环境安装）。 | [AI4Math-Computational-Mathematics](https://github.com/VeryMath/AI4Math-Computational-Mathematics) |
| `mixed-integer-programming` | MILP 建模求解：背包/指派等实测示例（PuLP+CBC）+ 恢复的上游 LP 示例。 | [AI4Math-Optimization](https://github.com/VeryMath/AI4Math-Optimization)（已修复错版示例） |
| `osqp-solver` | 凸二次规划的求解与验证：状态门、独立 KKT 检查与不可行证书（需 osqp Python 栈）。 | [AI4Math-Optimization](https://github.com/VeryMath/AI4Math-Optimization) |
| `matlab-runner` | MATLAB 执行路由/安全/报告层——经 MathWorks 官方 MCP server 驱动本机 MATLAB（需用户自装 MATLAB + license）。 | [AI4Math-MathTool](https://github.com/VeryMath/AI4Math-MathTool) |
| `math-beamer` | 数学 Beamer 幻灯片：23 模板包（中英/学科分类）、4 闸门引导流程、slide-source-ledger 溯源。 | [AI4Math-Writing](https://github.com/VeryMath/AI4Math-Writing) |
| `lean-formalization` | Lean 4 形式化、证明修复、sorry 补全与 patch 审查（编码代理优先，GB 级工具链留在用户机器）。 | [AI4Math-Lean-Agents](https://github.com/VeryMath/AI4Math-Lean-Agents) |
| `lean-setup` | Lean/elan/lake/mathlib 工作区的检测、安装引导与两级就绪度报告。 | [AI4Math-Lean-Agents](https://github.com/VeryMath/AI4Math-Lean-Agents) |

> 暂缓接入（理由与升级路径见 [`docs/integration-matrix.md`](https://github.com/LouisUltra/dsh-verymath/blob/main/docs/integration-matrix.md)，该文件是仓库内的调研材料，不随 npm 包分发）：Sagemath-skill 技能本体（GPLv3；查询能力已按
> 评审结论以干净房间 TS 重实现，语料独立分发）、paper-to-skill 全链（MinerU 云 API 隐私考量；本地 mineru 可选）、
> agent-laboratory-workflow（外部 LLM API+重部署）、scientific-computing-reproduction（Codex 生态耦合，零依赖脚本按需摘取）、
> co-mathematician（独立 App，仅提炼概念）、textbook-copilot（Apache-2.0 独立应用）。

技能承载方法论，工具承载确定性执行；与 DSH 会话、工作区、沙箱和 `literature` 等其他插件天然协作（如用 `literature_fulltext` 下载论文全文，再交给 `math-paper-reading` 分析）。

## 安装与使用

要求 Node.js `24.22.1+` 与 DSH `0.2.x`：peer 覆盖 `0.2.1-rc.5` 到 `0.2.x` 并显式包含 `0.2.2-rc.1`，开发依赖锁定 `0.2.2-rc.1`。运行探针会检测宿主是否装载了工具执行器，据此自适应 0.2.1 的单调用与 0.2.2 的批量接口。

```sh
dsh plugin --profile <你的profile> add @louisultra/dsh-verymath
```

或从源码构建：

```sh
git clone https://github.com/LouisUltra/dsh-verymath.git
cd dsh-verymath
npm install && npm run check && npm pack
dsh plugin --profile <你的profile> add ./louisultra-dsh-verymath-<version>.tgz
```

之后在会话中直接说"帮我查一下 manifold 的中文术语"/"读一下这篇论文的结构"即可。产物（`glossary.json`、`<slug>_structure.json`、结构分析报告）全部写入当前会话工作区。

### 依赖说明

- **查询与论文校验**：无需任何外部依赖。
- **术语库构建/导出**（`verymath_glossary_build`）：需要本地 Python 3 与上游脚本依赖（`PyYAML`；Excel 导出另需 `openpyxl`，Web 管理界面另需 `Flask`）。`verymath_python_check` 只能确认 `python3` 可用；上游依赖缺失时由脚本报错（如 `No module named 'yaml'`），按需 `pip install PyYAML openpyxl Flask`。插件不捆绑 Python。
- **平台**：仅在 macOS（Apple Silicon）验证过（DSH CLI 沙箱 + EduWork 0.4.3 桌面端实际装载）。**Windows 未测试**：代码依赖 Node 与 Python 的 PATH；外部二进制按 PATH 与 PATHEXT 解析（不再指向 macOS 固定路径），但未在 Windows 上实测，涉及 TeX、MATLAB、osqp 等外部环境的场景尤其如此。

## 持续集成

`.github/workflows/check.yml` 在每次 push / PR 时跑 `typecheck → build → test → runtime probe`（GitHub Actions，Node 24）。

## 从源码开发

```sh
npm run typecheck   # tsc --noEmit
npm run build       # tsc → lib/
npm test            # vitest 合成测试（不联网）
npm run test:runtime  # 真实 DSH API 探针（合成数据，不调用模型）
npm run check       # 全部
npm run test:upstream  # 上游 math-glossary 离线测试（需把 VeryMath 的 AI4Math-MathTool 仓库
                       # 克隆到与本仓库同级的 research/ 下；仅开发机可用，不随 npm 包分发）
```

## 许可与来源

本包 MIT 许可（`LICENSE`）。技能内容与 Python 脚本改编自 VeryMath 的 MIT 项目，来源提交与适配范围见 `UPSTREAM.json`，归属详情见 `NOTICE.md`。感谢 VeryMath 团队与上游贡献者。

## 相对上游 VeryMath 的差异

- **论文依赖图工具化**：上游 `skill_base`/`skill_pathway_proof` 明文要求"严禁大模型手工遍历拼接 JSON"，但上游仓库并未提供合并/拓扑脚本（模型每次现场生成）。本插件用 TypeScript 实现了确定性引擎（`verymath_paper_graph`），论文阅读关键路径不再依赖 Python。
- **术语读写闭环**：`verymath_glossary_upsert` 自动维护上游合同的不变量（term_id 派生、`en__N` 别名行、排序、连续 idx），上游只能靠模型手改 JSON。同一英文的多个译名分开成行保留，改译名用 `term_id` 指定具体行。
- **消歧支持**：查询返回例句、支持按子领域过滤，对应上游 usage-guide 的消歧策略（上游 DSH 化后原本无法执行）。
- **验证边界**：本插件做结构层验证（依赖完整性、环检测、断链/孤立节点），不验证数学证明的正确性——这与上游 `skill_base` 的能力边界声明一致。

## 已知限制

- 术语库的 MDX 词典、OCR 扫描件与 Web 管理界面走技能工作流（shell），未纳入插件工具。
- 术语库构建/导出仍需 Python（查询、存词、论文图引擎均不需要）。
- 上游仍在活跃演进；适配的上游版本以 `UPSTREAM.json` 记录为准。
