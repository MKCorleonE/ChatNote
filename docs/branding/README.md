# ChatNote 森林图标

2026-10-09，作者选择 H 方向，并确认五棵树的错落版本用于软件升级。

- `forest-approved-square.png`：2026-10-09 作者批准的原始 1254×1254 PNG，哈希 `8f840c204faf4cd9228e968d69b2f17deb5fecfb544e78232a03bc66a3c12ca0` 保持不变。保存原五树/主线排布，正式 0.7.1 使用这张图。
- `../../app-icon.svg`：2026-10-10 开发预览内嵌批准原图，以 20% 半径圆角裁切外围白色直角；不是重新生成或矢量重画。
- `../../app-icon.png`：当前预览的 512px RGBA 渲染图，四角真正透明；正式历史文件不变。
- `legacy-icon.svg`：升级前菱形标志的来源保留；历史交付程序继续保留原图标。
- `../../public/app-icon.png`：浏览器标签图标，同母图；启动/欢迎/关于页面通过 Vite 导入母图。
- `../../src-tauri/icons/`：使用 Tauri 图标工具生成的 Windows ICO/PNG、macOS ICNS、iOS/Android 尺寸资源。其他平台仅准备资源，本次没有平台构建或交付验收。

重新生成：`npm run tauri -- icon app-icon.svg`，再将生成的 `src-tauri/icons/icon.png` 复制到 `app-icon.png` 和 `public/app-icon.png`。不要用重新生成的候选图替换批准的母图。

原图由内置 image_gen 生成，作者已明确选定。该版最终生成指令为：沿用 H 的绿色轮廓树、青绿色蜿蜒主线与原旁支，将树增加到恰好五棵，以高低、大小及间距形成非对称错落布局；仅输出单个正方形预览，不添加新符号或文字。

升级验证包括母图来源哈希、各尺寸/格式、生成 ICO 帧、最终 EXE 与安装包嵌入资源、界面加载和完整应用构建。
