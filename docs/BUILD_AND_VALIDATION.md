# ChatNote v0.1.0 Windows 内测版

日期：2026-10-08。技术：React / TypeScript / Tauri 2 / Rust / SQLite。

交付后用户反馈（2026-10-08）：ChatGPT 套餐已成功登录并可对话。此项是用户实际使用补充；下方“本轮未完成真实账号实测”的表述保留为构建时的助手验证边界。令牌刷新、重授权、套餐额度错误与远程撤销仍未确认。

## 交付与使用

Windows 安装包与可直接启动的程序放在项目 `releases` 目录。Windows 需要 WebView2；安装包采用 Tauri 的 WebView2 检测/安装方式。当前为内测构建，尚未进行代码签名。

1. 安装或启动 ChatNote。
2. 可以先点击 **Explore the annotation example** 查看示例，或新建自己的会话。
3. **Settings** 中选择模型连接。API Key 可以先保存再 **Load models**；也可以填写明确的模型 ID。兼容服务商使用 Chat Completions 协议，密钥绑定设置时的 API URL。
4. **Continue with ChatGPT** 会打开系统浏览器；用户自行完成官方登录和套餐授权。此功能代码已实现，但本轮没有用户凭据，尚未完成真实账号的登录、刷新、套餐生成与远程撤销实测。
5. 点击 **Done** 保存设置。新问题从所选服务商获取真实回答，初始 Transformer 示例始终标记为 Example。
6. 在完成的助手回答中选择一段普通文本，点击 **Ask in annotation**。在右侧继续追问，或选择右侧回答中的文字建立子批注。
7. 高亮可重新打开批注；**Follow-up tree** 展示保存的真实父子关系；**Jump to source** 回到来源。
8. 通过右上角菜单导出当前会话的 Markdown，或备份整个工作区。导入备份会添加会话，不会删除现有会话。

当前为英文界面，模型可以按用户问题的语言回复。历史会话默认收在左侧按钮中，选择会话后自动收回。

## 数据与安全边界

- 默认数据库位于 Windows 当前用户的应用数据目录 `app.chatnote.desktop` 内，与程序安装目录分离。
- SQLite 使用 WAL、完整同步与事务写入；保留最近三个旧快照。遇到无法读取或不支持的版本，不静默用示例覆盖。
- 流式生成期间定时保存部分回答；重启把未完成回答标记为 stopped。
- API Key / OAuth 令牌存放在 Windows 凭据库；较长令牌分块保存，先写新数据再发布索引。
- 兼容服务商密钥绑定 API URL；OpenAI / ChatGPT 固定使用官方 API URL。凭据不进入普通聊天数据库和工作区备份。
- 同一程序标识限制为单实例，避免多个窗口覆盖同一工作区。
- 用户主动发送问题时，所选上下文会发送给对应模型服务商；完整本地记录不会自动全部上传。

## 上下文处理

每个旁支保存创建时的来源快照，使用自身问答；兄弟分支和创建后的主线内容不自动加入。

短上下文保留必要历史。超出本地字符预算后，使用明确标记的旧记录摘录与近期问答，并保留精确原文引用；这不是模型生成的语义摘要。点击回答旁的 Context 可以查看实际请求内容、范围和是否缩减。完整原文仍保存在本地。

字符预算不是精确 token 计数。服务商仍可能拒绝超出其模型输入限制的请求。更精确的计数和可审核语义摘要是后续工作。

## 自动测试

本轮通过：

- 9 项核心数据与上下文测试：中文/emoji/重复文字定位、旁支隔离、递归快照稳定性、错误关系拒绝、流式恢复、长上下文与备份结构等。
- 4 项界面测试：选区→真实通信适配层的模拟流→递归子批注、历史抽屉与草稿恢复、停止生成、读取失败不覆盖。这里使用受控模拟模型通信，不代表外部模型已经实测成功。
- 8 项 Rust 桌面测试：SQLite 重启与事务、较新版本拒绝降级、SSE 分片中文/emoji、完成事件识别、API 地址约束、登录 state/PKCE/客户端校验、凭据索引校验。
- 1 项单独执行的 Windows 凭据库测试：长 Unicode 凭据写入、读取、替换和删除；使用随机测试条目，测试后清理。
- TypeScript 检查、Vite 界面构建和 Windows release/NSIS 打包通过。

## 实际交互检查

- 浏览器预览的深色双栏、公式显示、历史列表按需打开和选中后收回。
- 390×844 窄屏布局：批注切换为独立阅读面板；这是响应式布局检查，不等同于 iOS/Android 真机验证。
- 合成工作区 500 条主线消息、500 条批注成功导入；追问树正常打开，并可进入对应批注。一次自动化交互往返约 613 ms，含调用与等待开销，不作为精确渲染耗时或帧率。
- Windows 原生 release 程序实际启动；示例会话与右侧批注可用。
- 原生窗口输入 `NATIVE_DRAFT_CHECK` 后退出、重启，草稿、会话和批注恢复；SQLite 文件内容交叉确认。
- 第二次启动退出码为 0，并复用已有窗口。
- 原生文件对话框导出 Markdown，生成 `.desktop-test/native-export.md`（1440 字节），内容包含主线与批注来源。
- 最终 NSIS 安装包静默安装到 `.desktop-test/installed`，退出码 0；安装后的程序实际启动并加载既有会话、批注与草稿。
- 同版本重复安装退出码 0，独立数据目录的数据库哈希不变。仅验证同版本重装，未验证未来版本的 schema 升级。
- 测试安装卸载退出码 0，安装程序文件移除，独立数据目录的数据库保留；测试安装及快捷方式已清理。

原生检查全部使用 `D:\CodexAnnotation\.desktop-test\data`，与默认正式数据目录分开。

## 尚未验证或尚未提供

- 使用真实 OpenAI API Key 的完整生成与服务端额度错误；ChatGPT 真实账号的登录、令牌刷新、套餐请求与撤销。
- 第二家真实厂商的模型兼容性；现有兼容协议不能保证所有服务商功能一致。
- 全新 Windows 机器上的 WebView2 下载、未来版本升级和长期稳定性；本机安装、同版本重装和卸载已验证，不等于这些场景全部完成。
- macOS、iPadOS、iOS、Android 的编译、签名、权限与真机交互；当前交付仅为 Windows。
- 云同步、商店发布、自动更新、中文界面、文档阅读、语音与手写。
- 跨段落、跨 Markdown 格式片段、代码块与排版公式的批注；v0.1 仅开放能准确映射回源文本的单段普通文本叶节点。
- 自动语义摘要、无限规模列表虚拟化、多账号同时管理。

## 开发命令

```text
npm install
npm run dev
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml long_credential_round_trip -- --ignored
npm run desktop:dev
npm run desktop:build
```

模型请求在 Rust 层执行，浏览器预览不保存密钥或发送模型请求；预览使用 IndexedDB 保存界面测试记录，桌面使用 SQLite。

参考：[Responses 流式响应](https://developers.openai.com/api/docs/guides/streaming-responses)、[ChatGPT 注册与登录](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)、[套餐模型请求](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)、[会话与撤销](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)。
