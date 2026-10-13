# ChatNote 0.11.0 · Windows x64

- ChatNote_0.11.0_x64-setup.exe：安装程序。
- ChatNote_0.11.0.exe：直接启动程序，需要系统WebView2。
- ChatNote_0.11.0_mind-map-example.html：合成会话离线导图，保留连线和拖动调宽。
- SHA256SUMS.txt：35 个当前与历史交付文件的校验值。

先关闭旧版及开发预览，再安装或启动，无需退出账号。原会话、锚点、笔记、草稿、附件、连接、凭据及ChatGPT注册保留。回退前导出完整工作区备份。

本版修复手动滚动刻度、主线上下文卡越界、导图重开动画；图片显示缩略图，点击打开大图和保存原图。语音服务商与转写模型在设置→模型与连接，输入框语音入口会定位到该卡片。

沿用0.10.0可选上下文、导图连线/调宽、2.5秒弹性提示与导出彩带。DeepSeek使用deepseek-flash处理图片，PDF/Office和语音暂不支持；OpenAI与千问按连接和模型支持文档/转写。上下文预算是文字字符预算，不是Token配额。

131项前端、27项原生、格式及构建结果见 [完整验证](../docs/V0.11.0_VALIDATION.md)。真实API、麦克风、覆盖安装与动效手感待用户验收。未签名、手动更新，其他平台暂未交付。

常用目录保留0.11.0和0.10.0，0.9.0及更早经校验归档，个人导出保留。私有 [0.11.0下载](https://github.com/MKCorleonE/ChatNote/releases/tag/v0.11.0) / [0.10.0回退](https://github.com/MKCorleonE/ChatNote/releases/tag/v0.10.0)，需要仓库权限。源代码通过PR/Windows CI后合并main，二进制仅存于发布资产。
