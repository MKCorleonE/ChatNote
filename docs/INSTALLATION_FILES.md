# Windows安装后会生成什么

适用0.14.0，2026-10-17。根据实际NSIS安装脚本和隔离安装目录核对。安装目录默认是`%LOCALAPPDATA%\ChatNote`，选择自定义位置或已有安装记录时会沿用相应目录。

| 安装目录内的文件 | 用途 |
| --- | --- |
| `chatnote.exe` | ChatNote主程序，界面和前端资源已嵌入，不需要另装Node.js或Rust |
| `uninstall.exe` | 卸载程序 |
| `LICENSE` | ChatNote的PolyForm Perimeter 1.0.1许可正文 |
| `NOTICE` | 版权与署名说明 |
| `THIRD_PARTY_SOURCE.md` | 第三方组件源码获取说明；完整第三方许可也可在应用设置中查看 |

安装向导还会根据选择建立桌面/开始菜单快捷方式，并登记Windows“已安装的应用”卸载入口。安装包不包含用户聊天或API密钥。

## 首次运行与后续使用

- `%APPDATA%\app.chatnote.desktop\chatnote.sqlite`：本地对话、批注、笔记、草稿、设置和附件；附件保存在数据库，不单独散落为文件。
- 同目录可能出现`chatnote.sqlite-wal`和`chatnote.sqlite-shm`：SQLite运行时日志与共享内存文件，不能在应用运行时随意删除。
- 同目录的`updates\`：下载更新时临时保存`package.part`/`pending.part`，完整验签后为`package.bin`/`pending.json`；安装尝试时会产生`install-attempted`。完成升级后清除这些固定更新文件。
- `%LOCALAPPDATA%\app.chatnote.desktop\`：WebView2浏览器组件的运行缓存等数据。它与对话数据库用途不同，不代表把聊天上传到了浏览器服务。
- API密钥与ChatGPT登录凭据保存在Windows系统凭据库，不是安装目录中的明文文件，也不包含在工作区导出中。
- 如果电脑缺少Microsoft Edge WebView2 Runtime，安装器会按需安装该共享运行组件；它由微软管理，文件不局限于ChatNote安装目录。

升级不清空上述工作区。卸载时只有主动选择删除应用数据才应清理个人工作区；需要保留资料时先在设置中导出备份。桌面预览或测试指定`CHATNOTE_DATA_DIR`时，数据库和更新缓存使用指定目录，系统凭据库仍属于当前Windows用户。
