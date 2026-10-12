# ChatNote

源码与版本历史保存在 [ChatNote 私有仓库](https://github.com/MKCorleonE/ChatNote)。开发与发布步骤见 [GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md)。

ChatNote 是独立的跨平台对话式学习软件项目，目标平台为 **iPadOS、macOS、iOS、Windows、Android**。

核心体验：沿主线学习，选中回答中的词语或段落建立可持续追问的批注，在批注内继续深入，并通过追问树与笔记回顾内容。

已确认沿用现有原型、Windows 先跑通、预留全部平台。界面以当前对话与右侧追问为中心，弱化左侧历史列表，保持简洁且有设计感；历史通过胶囊按钮按需展开，也可固定为三栏布局。

项目于 2026-10-08 从 CodexAnnotation 更名为 ChatNote，进入独立产品规划阶段。当前目录名仍为 `D:\CodexAnnotation`。

## 产品与开发

- [产品与开发计划](docs/CHATNOTE_PLAN.md)：初版范围、技术路线、模型接入、五个平台和阶段验收。
- [功能清单](docs/FEATURES.md)：持续收集想法，按优先级与状态管理。
- [版本记录与待实现 idea](docs/CHANGELOG_AND_IDEAS.md)：每版变更、用户验证、升级建议和服务商/认证讨论。

当前实现：TypeScript + React 界面、Tauri 2 应用外壳、Rust 系统能力与 SQLite 本地存储。

v0.3.0 扩大代码/公式/格式选区，补齐常见公式写法，新增私人批注笔记、发送前上下文确认和回答状态小字，并完善阅读位置与会话续期提示。

Windows v0.9.0：顶部学习笔记/思维导图入口、可见且可保存的学科整理预设、真实整理上下文预览与生成状态、可展开离线 HTML 思维导图、横向追问树切换及按钮旁的新人引导气泡。启动图标与文字放大、停留延长，座右铭改为“探索每一个问题，同时不偏离主线。”并同步三语。原会话、锚点、草稿、附件、连接与凭据保留。

- [v0.9.0 Windows 安装包](https://github.com/MKCorleonE/ChatNote/releases/download/v0.9.0/ChatNote_0.9.0_x64-setup.exe)
- [v0.9.0 可直接启动的程序](https://github.com/MKCorleonE/ChatNote/releases/download/v0.9.0/ChatNote_0.9.0.exe)
- [v0.9.0 使用与验证](docs/V0.9.0_VALIDATION.md)
- [版本保留规则](docs/RELEASE_POLICY.md)
- [国际化维护说明](docs/INTERNATIONALIZATION.md)
- [v0.1.0 基线验证](docs/BUILD_AND_VALIDATION.md)

117 项前端及 24 项常规原生检查通过；真实模型整理质量、安装升级、手机打开与手感仍待用户验收。DeepSeek 图片与文档/语音接口区别见 [本版说明](docs/V0.9.0_VALIDATION.md)。

升级时先关闭旧版及开发预览/启动服务，再启动新版或安装，无需退出账号。常用目录保留 0.9.0 与 0.8.0，0.7.1 及更早交付归档保留；原对话、锚点、草稿、附件、连接与凭据保留。私有下载需要仓库权限。

圆角图标与跟随系统主题预览已纳入 0.8.0；预览过程保留。[本轮说明](docs/PREVIEW_ROUNDED_ICON_SYSTEM_THEME.md)。

小改动继续先开发预览，再积累发布：双击 [启动开发预览.cmd](启动开发预览.cmd)，默认沿用工作区与登录。[开发说明](docs/DEVELOPMENT_PREVIEW.md)。

命令行桌面预览：`npm run desktop:dev`；浏览器界面预览：`npm run dev`；界面测试为 `npm test`；桌面构建为 `npm run desktop:build`。`prototype` 目录保留早期独立演示。

v0.4.0 新增右侧调宽、输入框内模型/连接/思考强度、自动目录缓存、Enter/Alt+Enter 和可定制 RGB 光效。消息附件已在 0.8.0 首版实现。

## 当前原型

- [原型入口](prototype/index.html)
- [原型使用说明与已有验证](prototype/README.md)
- Windows 窗口启动：[Launch-Prototype.cmd](prototype/Launch-Prototype.cmd)
- 新名称的单文件演示：[ChatNote-demo.html](prototype/ChatNote-demo.html)

原型接近初版交互方向：深色桌面布局、主线聊天、原文高亮、多轮批注、子批注、追问树和 Markdown 导出。全部助手回答仍为预设示例，尚未连接模型；它还不是正式安装版。

开发预览在 `prototype` 中运行 `npm start`；核心验证为 `npm test`；`npm run build:demo` 生成新名称的离线演示。

更名保留已有浏览器存储键，避免旧原型记录因名称变化而不可见。正式应用的数据迁移另行实现。

## 项目历史

- [原始提案与研究记录](docs/ORIGINAL_PROPOSAL.md)
- [此前提交记录](ISSUE_SUBMISSION.md)
- [英文功能建议](FEATURE_REQUEST.md)

旧的 `CodexAnnotation-demo.zip`、同名 HTML、视频和提案保留为历史材料。新的产品开发按 ChatNote 计划推进。
