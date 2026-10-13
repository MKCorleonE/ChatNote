# ChatNote · GitHub Pages 官网与公开下载行动清单

核对日期：2026-10-13；客户端基线：0.12.0。用户已明确授权独立公开官网仓库与公开安装包分发，原应用源码保持私有。官网已创建并部署，下载分发与验收状态见下表及[建站验证记录](WEBSITE_LAUNCH_VALIDATION.md)。10月12日的云主机/对象存储方案保留为其他路线参考。

## 执行进度

当前官网已按用户确认的方向重构为1.1.0：森林主线滚动开场、原座右铭、三个精简功能及下载。移除展示视频，下载/FAQ/联系改为独立页，三语共27页；客户端仍0.12.0。[重构设计与验证](WEBSITE_FOREST_REDESIGN.md)。下表中的首发素材记录保留为历史。

| 项目 | 状态 |
| --- | --- |
| 独立仓库 | [MKCorleonE/chatnote-site](https://github.com/MKCorleonE/chatnote-site)，公开；只包含官网、公开说明与合成素材 |
| 官网 | [GitHub Pages](https://mkcorleone.github.io/chatnote-site/)，main 根目录、HTTPS，构建成功 |
| 页面与素材 | 简体/繁体/英文共18页；4张0.12.0合成学习截图、45秒MP4界面导览、从当前应用导出的可交互合成导图；无真实用户内容 |
| 内容说明 | 快速开始、FAQ、更新日志、隐私/托管数据流、免费测试版使用说明、联系与试用检查表；费用/能力/数据流按实际边界说明 |
| 下载与回退 | 0.12.0与0.11.0原字节镜像，两个正式公开Release、每版独立校验表；六项远程摘要与匿名完整下载全部通过 |
| 页面检查 | 三语结构、20个HTML及369条本地资源链接；桌面与390px手机布局、导览/复制/FAQ检查 |
| 真实用户试用 | 新电脑、真实API、录音设备、Wi-Fi/移动网络与大陆目标网络仍待人工完成；已准备三语检查表与脱敏反馈格式，未替用户发邀请 |

维护入口为独立官网仓库README；本机独立检出位于`.cache/chatnote-site/`，不纳入私有应用源码历史。网站不使用Sites托管、不需要新服务器或账号后端。

## 可行性结论

GitHub Pages可以承载产品介绍、截图、视频、文档、更新日志、隐私说明以及使用合成数据的前端交互示例。它托管HTML/CSS/JavaScript静态页面，可使用github.io网址及HTTPS，无需自行维护虚拟服务器。GitHub Free可用于公开仓库的Pages；从私有仓库发布Pages需要符合相应付费计划条件。[官方Pages说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[HTTPS说明](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)。

下载按钮链接到公开GitHub Releases，适合分发Windows安装包和直接启动程序。当前应用源码仓库的Release需要仓库读取权限，不能供普通匿名访客下载；Pages公开不会使私有Release自动公开。[Release说明](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)、[公开资源的匿名访问](https://docs.github.com/en/rest/releases/assets)。

## 推荐结构

| 部分 | 可见性 | 内容 |
| --- | --- | --- |
| MKCorleonE/ChatNote | 继续私有 | 应用源码、原有版本历史、开发记录与私有Release |
| MKCorleonE/chatnote-site | 公开，已创建 | 官网源文件、公开文档、合成演示素材；该仓库的Releases分发批准公开的安装包 |

一个新增仓库即可同时负责官网和下载，不必另买服务器或默认公开应用源码。网站源文件会公开，应用源码继续留在原仓库。GitHub自动生成的公开Release源码压缩包只对应官网仓库内容，不包含原私有应用仓库。[Release自动归档说明](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)。

已上线项目站网址：`https://mkcorleone.github.io/chatnote-site/`。自有域名可等首期运行后再决定。

## 按顺序执行

| 顺序 | 行动 | 完成标准 |
| --- | --- | --- |
| 1 | 确认公开范围与官网仓库名称 | 原应用仓库保持Private；只公开官网内容、合成素材及选定安装包。网站定位为免费Windows项目展示/试用下载 |
| 2 | 制作官网本地预览 | 沿用ChatNote配色、圆角、轻量弹性动效；提供简体/繁体/英文切换，默认按目标用户选择简体。手机、电脑均能清楚找到下载和快速开始 |
| 3 | 准备展示素材 | 3–5张合成截图、约30–60秒学习流程演示、可打开的合成导图示例；展示主线提问→原文追问→查看层级→导出成果，不使用私人会话 |
| 4 | 准备说明文件 | 同步0.12.0功能、隐私政策、升级/回退、FAQ、模型费用和支持边界。补充免费beta使用授权及第三方许可说明，源码是否开源另作决定 |
| 5 | 创建公开官网仓库并启用Pages | 对本地预览和公开内容完成审阅后创建仓库。简单静态文件可从main根目录部署；需构建时使用GitHub Actions。检查项目路径下的图片、语言资源、子页面和演示链接 |
| 6 | 发布公开下载资产 | 将0.12.0原安装包和直接程序按原字节镜像到公开仓库Release，保留版本化文件名；另外保留0.11.0回退入口。网站不使用私有Release链接 |
| 7 | 接通并验收下载 | 已用独立无凭据请求完整下载六项资产，大小/SHA-256一致；电脑/手机页面通过。真实Wi-Fi/移动网络及目标大陆用户网络继续由试用者完成 |
| 8 | 新电脑完成学习流程并小范围试用 | 安装→一条真实可用API连接→主线提问→原文追问→导出→重启查看保留。先邀请约10–20名Windows用户，优先修安装、连接和数据留存阻断问题 |

步骤5的GitHub操作参考：[Pages快速开始](https://docs.github.com/en/pages/quickstart)。HTTPS与资源加载检查参考：[HTTPS说明](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)。公共仓库与软件公开分发已在用户本轮明确授权范围内执行。

## 首期页面内容

| 页面或区块 | 内容 |
| --- | --- |
| 首页 | 学习场景、核心工作流、功能截图/短演示、主要Windows下载按钮 |
| 下载 | 当前版本/日期、安装包与直接程序区别、系统/运行组件要求、文件大小、校验值、上一稳定版和升级方式 |
| 快速开始 | 安装、模型连接、首次问题、原文追问、上下文选择、笔记/导图导出；说明API推理费用由所选服务商收取 |
| FAQ与更新日志 | 文件/语音能力边界、上下文预算、备份与回收站、常见连接错误；不把自动测试扩大为真实账号/设备验收 |
| 隐私与使用说明 | 复用客户端三语政策，并补充官网托管方GitHub及访问日志说明；区分官网访问与客户端数据流 |
| 一起改进 | 建议反馈、开发参与介绍；邮箱529023573@qq.com和小红书1006863642，首期采用人工联系 |

官网不需要首期账号系统、数据库或模型代理。以后需要云同步、账号或在线服务时另行设计后端。GitHub说明Pages访问者IP会为安全目的记录，即使访客未登录；官网政策应相应说明，不宣称网站访问完全无日志。[Pages数据收集说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)。

## 下载与日后更新规则

- 当前可发布候选文件：`ChatNote_0.12.0_x64-setup.exe`（4,814,660字节）和`ChatNote_0.12.0.exe`（12,728,832字节）；来源与摘要已在0.12.0交付记录中验证。
- 首次公开分发复制已验证文件，不为建站重新构建，也不覆盖同版本文件。程序/安装包摘要分别为`effc978c70ec8566d56a2857f195fbeeda39168a6ed1370e9a1c83dfa70f575c`与`edd0ed852c3657102308359b25f086e9203daca39616faf05885a3ac7f2e509a`。
- 公开Release附单独校验清单，只列本次真正公开的文件。私有仓库的37项总校验表继续保留，不将不存在于公开分发区的历史路径作为下载清单。
- 页面下载按钮使用公开Release的版本化地址；用一个版本信息文件集中维护版本、日期、地址、大小和摘要。当前文件名含版本号，不能直接让`latest/download/旧版本文件名`跨版本长期有效；升级时更新该信息文件。[链接Release的方式](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases)。
- 后续流程：私有源码验证并发布→审阅新版本公开范围→复制到公开Release并核对摘要→更新官网版本信息→匿名下载复核。稳定后再自动化，令牌只放自动化密钥配置，不放网页。
- 不上传整个应用目录、整个releases目录、用户数据库、私人导出、工作区备份、API密钥或未审阅的内部记录。现有目录中有个人导出，复制采用明确文件清单。

## 托管边界

- Pages已发布网站大小上限1GB，软带宽限制100GB/月；网页保持轻量，安装包放Releases。Release每个附件需小于2GiB，官方未给出Release总大小或带宽上限。这些额度不是访问速度或服务可用性保证。[Pages限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)、[Release额度](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)。
- Pages条款限制主要用于商业交易或商业SaaS的网站；当前方案是项目展示/免费试用下载。若以后增加支付、订阅或将网站转为商业服务入口，应重新评估托管，不能因为页面静态就忽略用途限制。[官方使用限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)。
- GitHub托管省去服务器维护，但目标用户的访问/下载体验仍要实测。若实测不理想，再增加其他下载分发路线，不预先保证大陆所有网络速度。
- 当前Windows交付未签名，官网如实标注测试版/发布者/摘要；新电脑安装验收仍需完成，不将关闭系统安全防护作为默认教程。

后续集中完成真实设备/API和目标网络试用，再根据反馈补下载分发路线。当前客户端仍为0.12.0；建站不重建、覆盖或变更已交付程序。
