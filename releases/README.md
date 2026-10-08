# ChatNote 0.2.1 · Windows x64 内测版

- `ChatNote_0.2.1_x64-setup.exe`：最新安装程序。
- `ChatNote_0.2.1.exe`：最新可直接启动程序，需要系统具备 WebView2。安装包会按 Tauri 方式处理该运行时。
- v0.2.0 保留为上一版；v0.1.0/v0.1.1 位于 `archive` 的对应版本目录，早期 `ChatNote.exe` 是 v0.1.0。
- `SHA256SUMS.txt`：全部已交付文件的校验值。

先退出旧版，再启动 v0.2.1 或运行新安装包。原会话与 ChatGPT 连接保留。打开左下角 **Settings → Interface language**，选择 English / 简体中文 / 繁體中文，立即生效并自动保存。中文入口为 **设置 → 界面语言** / **設定 → 介面語言**。

ChatGPT 登录等待中可以取消并重试；手动“检查登录连接”不调用模型。浏览器授权页超时时，取消本次尝试，关闭旧授权页再重新登录。本轮用户重试已恢复，这不代表新版修复了服务端故障。

[私有 v0.2.1 下载](https://github.com/MKCorleonE/ChatNote/releases/tag/v0.2.1) / [v0.2.0 与历史安装包归档](https://github.com/MKCorleonE/ChatNote/releases/tag/v0.2.0)。需要登录有仓库权限的 GitHub 账号，全部程序/安装包已核对远程摘要。

界面语言不翻译原来的聊天、引用或连接名称；模型回复继续跟随提问。法语、德语尚未提供。

**添加连接**支持 DeepSeek/Qwen 等预设，各自保存 Key/地址/模型；主界面右上角切换连接。**检查并加载模型**只检查目录，不触发生成；DeepSeek 支持主动查询余额，其他套餐/额度使用官方用量入口。

记录在本机保存，右上角菜单可导出 Markdown 或完整备份；备份不包含密钥与登录令牌。真实厂商请求、登录生命周期和本版升级安装仍需分别验收。

41 项本地测试及首次云端检查通过。详细范围见 [v0.2.1 验证](../docs/V0.2.1_VALIDATION.md)、[版本记录](../docs/CHANGELOG_AND_IDEAS.md)和[版本保留规则](../docs/RELEASE_POLICY.md)。当前仍是未签名内测版，无云同步/自动更新，其他平台尚未交付。
