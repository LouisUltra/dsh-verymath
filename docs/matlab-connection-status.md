# MATLAB MCP 连接状态与已知问题（2026-10-16）

## 已验证可用的部分
- MCP server v0.14.0/v0.12.0、dsh-mcp-client 链路、5 个工具注册：全部正常
- 真实计算 E2E（server 自建无界面会话）：rank/det/cond、单测 2 passed、工具箱探测 — 全部真实
- 用户环境：R2025b Update 7 + Optimization + Symbolic（license 已确认）

## 已知问题（MathWorks 上游 bug）
在桌面 MATLAB 运行 `shareMATLABSession()` 之后：
- `--matlab-session-mode=existing` 与 `auto`（默认）**均崩溃**，
  报 `invalid character 'C' looking for beginning of value`（v0.14.0 与 v0.12.0 复现）。
- 根因：server 发现桌面 connector 服务（localhost:31517，ServiceHost 托管）后，
  对其响应的解析失败——非用户配置问题。
- 删除/移开 `sessionDetails.json` 不恢复——server 转而发现桌面 connector 端口后仍然崩溃。

## 当前的可用配置
- **不运行 `shareMATLABSession()`** 的机器上：auto 模式 = server 自建无界面会话，执行真实可靠
  （16:28 的 E2E 即此路径；计算在真 MATLAB 中完成，只是不在桌面窗口显示）。
- 已运行 `shareMATLABSession()` 的机器：重启 MATLAB 桌面（connector 随会话关闭）即可恢复 auto 模式；
  或等待 MathWorks 修复。

## 给上游的 bug 报告要点
- 版本：v0.14.0 与 v0.12.0 均复现；macOS arm64；R2025b Update 7
- 复现步骤：`--setup-matlab` → 桌面运行 `shareMATLABSession()` → `--matlab-session-mode=existing` 或 auto
- 错误：`invalid character 'C' looking for beginning of value`（初始化即失败，0.5s 内）
