# MATLAB MCP 连接状态与已知问题（2026-10-16 v2，彻底修正）

## 结论（v2 取代 2026-10-16 早前的 v1 结论）

**v1 曾报告「shareMATLABSession() 后 existing/auto 模式崩溃（invalid character 'C'）」——该结论是误报，已在 v2 用正确方法推翻。**

'invalid character 'C' looking for beginning of value' 的真实来源：**测试客户端的 stdio framing 错误**，
与 MATLAB session mode 完全无关。MCP stdio 传输按规范使用换行分隔的 JSON；手搓测试客户端使用了
LSP 风格的 `Content-Length:` framing，server 的 JSON 解析器读到第一行 `Content-Length: ...` 即报
`invalid character 'C'`（'C' 就是 Content-Length 的 C）。该错误在任何 session mode 下都会出现，
与 existing/auto/new 的选择无关。

### 干净复现证据（2026-10-16 03:26–03:36，官方 dsh-mcp-client，正确 framing）

| 场景 | 结果 |
| --- | --- |
| v0.14.0 + `--matlab-session-mode=existing` + 桌面共享会话 | ✅ attach 成功，`disp(6*7)`→42 |
| v0.14.0 + existing + `disp(feature('getpid'))` | ✅ 返回 8386（桌面 MPA service 进程）——eval 真实落在共享会话 |
| v0.14.0 + `--matlab-session-mode=auto`（默认） | ✅ attach 成功，PID 8386 |
| v0.12.0 + existing | ✅ attach 成功，`disp(5*5)`→25 |
| Content-Length framing 喂 server stdin（复现实验） | ❌ 精确复现 `invalid character 'C'`——确证 framing 假象 |

server 日志证据（`--log-folder` debug）：`New client session (dsh-mcp-client)` →
`Attaching to existing session` → `Discovering existing MATLAB sessions` → eval 执行 →
`Skipping session stop for externally managed MATLAB session`，全程无错误。

## 实际可用的两条执行路径（均可验证）

### 路径 A：自建无界面会话（不运行 shareMATLABSession）
- auto 模式发现不了共享会话文件 → fallback 启动新 headless MATLAB（`--matlab-root` + nodesktop）
- 计算真实可靠，只是不出现在用户的桌面窗口

### 路径 B：附着用户桌面会话（桌面运行 `shareMATLABSession()` 后）✅ 实际可用
- 桌面 MATLAB 把 connector 详情写入
  `~/Library/Application Support/MathWorks/MATLAB MCP Server/v1/sessionDetails.json`
  （port=MPA service HTTPS 端口、certificate=thisMatlab.pem、apiKey、basePath="/"）
- server auto/existing 模式发现该文件 → 以 apiKey + 客户端证书附着 → **eval 在用户的桌面
  MATLAB 计算服务中执行**（getpid 验证=8386）
- 这意味着 EduWork 集成**支持桌面附着**：用户在桌面 MATLAB 里能看到执行结果与连接问候

## 环境架构备注（R2025b，macOS arm64 实测）

- 桌面 MATLAB 进程自带 connector（如 127.0.0.1:31515，`The connector service is running.`）
- **MCP 相关的 connector 实际由 MPA service 进程承载**（如 31516，`-mpasessionid=...`），
  shareMATLABSession() 写入的就是这个端口；该端点强制 `mwapikey` 认证（无 key 返回 Forbidden）
- 桌面进程自己的 connector（31515）对 localhost 的 messageservice 调用**不强制 apiKey**——
  本机任意进程可直接 eval 执行 MATLAB 代码。属 MathWorks 侧的安全设计弱点（仅 localhost 可达，
  威胁模型有限），值得在给上游的反馈中提及
- 端口每次 MATLAB 重启会变化（31515/31516/31517 等），sessionDetails.json 由 shareMATLABSession()
  现场写入，无需手改

## 给上游的反馈要点（修正后）

1. ~~existing/auto 崩溃~~ → 撤回：是测试客户端 framing 问题，非 server bug
2. **安全观察**：桌面进程 connector 的 messageservice 端点对 localhost 请求不强制
   `mwapikey`（MPA service 端点则强制）——建议统一认证行为
3. 可选改进：`invalid character` 类 stdio 解析错误可以给一条更友好的诊断
   （例如提示「客户端可能使用了 Content-Length framing 而非 MCP 规范的换行分隔 JSON」），
   避免用户把客户端 framing 错误误判为 server bug（本次排查即被误导）
