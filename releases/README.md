# ChatNote 0.8.0 · Windows x64

- `ChatNote_0.8.0_x64-setup.exe`：安装程序。
- `ChatNote_0.8.0.exe`：直接启动程序，需系统具备 WebView2。
- `ChatNote_0.8.0_learning-note-example.html`：合成会话的离线笔记样例。
- `SHA256SUMS.txt`：当前与历史交付校验值。

先关闭旧版和开发预览窗口/服务，再安装或启动，不用退出账号。原对话、锚点、草稿、连接、凭据和 ChatGPT 注册保留。

新增本地附件、语音转写与检查/直接发送、路径目录＋主线轨道、五步欢迎介绍和离线学习笔记；修复原生黑条和数学渲染吞入正文。HTML 文件可离线打开；“请模型整理”可选、会发请求；浏览器打印可保存为 PDF。

语音使用 API 密钥服务商，ChatGPT 套餐登录不含转写接口。图片需视觉模型；PDF/Office 仅 OpenAI API，其他连接可用文本与支持的图片。详见 [使用、验证与限制](../docs/V0.8.0_VALIDATION.md)。108 项前端、24 项常规原生检查通过；真实附件/语音/整理与安装升级仍待用户验收。

常用目录保留 0.8.0 与 0.7.1，0.7.0 及更早已交付文件归档，哈希逐个验证。旧版不能完整处理新附件，回退前保存新版完整备份。仍为未签名、手动更新，其他平台未交付。

[私有 Release](https://github.com/MKCorleonE/ChatNote/releases/tag/v0.8.0) · [版本记录](../docs/CHANGELOG_AND_IDEAS.md)。私有下载需仓库权限。
