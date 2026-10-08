# ChatNote

源码与版本历史保存在 [ChatNote 私有仓库](https://github.com/MKCorleonE/ChatNote)。开发与发布步骤见 [GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md)。

ChatNote 是独立的跨平台 AI 对话与笔记软件项目，目标平台为 **iPadOS、macOS、iOS、Windows、Android**。

核心体验：沿主线学习，选中回答中的词语或段落建立可持续追问的批注，在批注内继续深入，并通过追问树与笔记回顾内容。

已确认沿用现有原型、Windows 先跑通、预留全部平台。界面以当前对话与右侧追问为中心，弱化左侧历史列表，保持简洁且有设计感；具体收起交互仍待原型比较。

项目于 2026-10-08 从 CodexAnnotation 更名为 ChatNote，进入独立产品规划阶段。当前目录名仍为 `D:\CodexAnnotation`。

## 产品与开发

- [产品与开发计划](docs/CHATNOTE_PLAN.md)：初版范围、技术路线、模型接入、五个平台和阶段验收。
- [功能清单](docs/FEATURES.md)：持续收集想法，按优先级与状态管理。
- [版本记录与待实现 idea](docs/CHANGELOG_AND_IDEAS.md)：每版变更、用户验证、升级建议和服务商/认证讨论。

当前实现：TypeScript + React 界面、Tauri 2 应用外壳、Rust 系统能力与 SQLite 本地存储。

v0.3.0 扩大代码/公式/格式选区，补齐常见公式写法，新增私人批注笔记、发送前上下文确认和回答状态小字，并完善阅读位置与会话续期提示。

Windows v0.3.0 内测版已构建，新增登录取消、重试恢复说明与手动检查登录连接，新增英语/简体/繁体界面，设置中的语言切换立即生效并保存。除主线/递归批注、追问树与本地保存外，新增 DeepSeek/Qwen 预设、独立连接档案、一键切换、模型目录检查、DeepSeek 余额查询和分类错误。2026-10-08 用户已验证旧版 ChatGPT 套餐登录与对话；国内真实账号及连接生命周期仍待分别实测。

- [v0.3.0 Windows 安装包](https://github.com/MKCorleonE/ChatNote/releases/download/v0.3.0/ChatNote_0.3.0_x64-setup.exe)
- [v0.3.0 可直接启动的程序](https://github.com/MKCorleonE/ChatNote/releases/download/v0.3.0/ChatNote_0.3.0.exe)
- [v0.3.0 使用与验证](docs/V0.3.0_VALIDATION.md)
- [版本保留规则](docs/RELEASE_POLICY.md)
- [国际化维护说明](docs/INTERNATIONALIZATION.md)
- [v0.1.0 基线验证](docs/BUILD_AND_VALIDATION.md)

升级时先退出旧版，再启动新版或运行安装包。原程序标识、数据库与 ChatGPT 登录路径保留。本机常用目录保留 v0.3.0 和 v0.2.1，v0.1.0/v0.1.1 保存在 releases/archive。私有下载链接需要登录有仓库权限的 GitHub 账号。

开发入口在根目录：`npm run dev`；界面测试为 `npm test`；桌面构建为 `npm run desktop:build`。`prototype` 目录保留早期独立演示。

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
