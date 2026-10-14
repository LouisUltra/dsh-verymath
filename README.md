# dsh-verymath

**简体中文** | [English](README_EN.md)

<p align="center"><strong>VeryMath 数学科研能力接入 DSH / EduWork 的社区插件。</strong><br><sub>双语数学术语库 · 数学论文结构化阅读 · 技能与工具一体</sub></p>

`@louisultra/dsh-verymath` 把 [VeryMath](https://github.com/orgs/VeryMath/repositories) 的 AI4Math 技能与工具封装为 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness)插件，适用于 [EduWork](https://github.com/ECNU/EduWork) 及其他 DSH 0.2.x 宿主。对应 [ECNU/EduWork#152](https://github.com/ECNU/EduWork/issues/152) 的首批场景。

## 提供的能力

**模型工具**（安装即用，Agent 自动调用）：

| 工具 | 用途 |
| --- | --- |
| `verymath_glossary_query` | 查询双语（英中）数学术语库 JSON：精确、前缀、子串、term_id、子领域匹配；返回例句，支持按子领域过滤消歧。 |
| `verymath_glossary_build` | 运行上游 `math-glossary` Python 脚本，从 CSV/TSV/JSON/YAML 构建或扩充术语库。 |
| `verymath_glossary_upsert` | 读论文/翻译时顺手存词：自动维护 term_id、排序与连续 idx 等合同不变量，无需手改 JSON。 |
| `verymath_python_check` | 检查本机 Python 3 可用性并给出安装提示。 |
| `verymath_paper_validate` | 校验 `math-paper-reading` 产出的 `<slug>_structure.json`（实体类型、依赖完整性）。 |
| `verymath_paper_graph` | 论文依赖图引擎：批次合并、`cited_by` 重建、`shared_node` 枢纽、环检测、双向阅读路径、`focus` 传递闭包、Mermaid 渲染（>40 实体自动降级）。 |

**随包技能**（注册进 DSH 技能目录，模型与用户均可触发）：

| 技能 | 用途 | 上游 |
| --- | --- | --- |
| `math-glossary` | 从 PDF/词典/表格构建、维护、查询双语术语库的完整工作流。 | [AI4Math-MathTool](https://github.com/VeryMath/AI4Math-MathTool) `math-glossary` v0.1.0 |
| `math-paper-reading` | 论文结构化提取、定理依赖分析、深读、文献检索、引用管理。 | [AI4Math-Paper-Reading](https://github.com/VeryMath/AI4Math-Paper-Reading) v4.2 |

技能承载方法论，工具承载确定性执行；与 DSH 会话、工作区、沙箱和 `literature` 等其他插件天然协作（如用 `literature_fulltext` 下载论文全文，再交给 `math-paper-reading` 分析）。

## 安装与使用

要求 Node.js `24.18.0+` 与 DSH `0.2.x（从 0.2.0-rc.1 起）`。

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
- **术语库构建/导出**（`verymath_glossary_build`）：需要本地 Python 3 与上游脚本依赖（`PyYAML`；Excel 导出另需 `openpyxl`，Web 管理界面另需 `Flask`）。缺失时先用 `verymath_python_check` 检查并按提示安装；插件不捆绑 Python。
- **平台**：macOS（Apple Silicon）已验证；Windows 理论可用（依赖 Node 与 Python 的 PATH），尚未实测——欢迎反馈。

## 从源码开发

```sh
npm run typecheck   # tsc --noEmit
npm run build       # tsc → lib/
npm test            # vitest 合成测试（不联网）
npm run test:runtime  # 真实 DSH API 探针（合成数据，不调用模型）
npm run check       # 全部
```

## 许可与来源

本包 MIT 许可（`LICENSE`）。技能内容与 Python 脚本改编自 VeryMath 的 MIT 项目，来源提交与适配范围见 `UPSTREAM.json`，归属详情见 `NOTICE.md`。感谢 VeryMath 团队与上游贡献者。

## 相对上游 VeryMath 的差异

- **论文依赖图工具化**：上游 `skill_base`/`skill_pathway_proof` 明文要求"严禁大模型手工遍历拼接 JSON"，但上游仓库并未提供合并/拓扑脚本（模型每次现场生成）。本插件用 TypeScript 实现了确定性引擎（`verymath_paper_graph`），论文阅读关键路径不再依赖 Python。
- **术语读写闭环**：`verymath_glossary_upsert` 自动维护上游合同的不变量（term_id 派生、排序、连续 idx），上游只能靠模型手改 JSON。
- **消歧支持**：查询返回例句、支持按子领域过滤，对应上游 usage-guide 的消歧策略（上游 DSH 化后原本无法执行）。
- **诚实边界**：本插件做结构层验证（依赖完整性、环检测、断链/孤立节点），不验证数学证明的正确性——这与上游 `skill_base` 的能力边界声明一致。

## 已知限制

- 术语库的 MDX 词典、OCR 扫描件与 Web 管理界面走技能工作流（shell），未纳入插件工具。
- 术语库构建/导出仍需 Python（查询、存词、论文图引擎均不需要）。
- 上游仍在活跃演进；适配的上游版本以 `UPSTREAM.json` 记录为准。
