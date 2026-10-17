# 第三方组件与对应源码

ChatNote 的 PolyForm Perimeter 条款只覆盖有权授权的项目代码；第三方组件保持各自许可，不被重新许可。应用内“开源许可”保留完整原文，清单由 `scripts/generate-license-notices.mjs` 从锁文件和源码包生成。

当前 MPL-2.0 组件使用未修改的上游文件，对应版本源码可取得如下：

- cssparser 0.37.0：<https://crates.io/api/v1/crates/cssparser/0.37.0/download>
- cssparser-macros 0.7.1：<https://crates.io/api/v1/crates/cssparser-macros/0.7.1/download>
- dtoa-short 0.3.5：<https://crates.io/api/v1/crates/dtoa-short/0.3.5/download>
- option-ext 0.2.0：<https://crates.io/api/v1/crates/option-ext/0.2.0/download>
- selectors 0.38.0：<https://crates.io/api/v1/crates/selectors/0.38.0/download>

Cargo 及 npm 的其他锁定版本、原始许可声明见 `src-tauri/Cargo.lock`、`package-lock.json` 和 `src/third-party-notices.json`。源码包中的双重许可按允许的兼容许可使用；本项目未将第三方源码中的原有声明删除或改为项目许可。

图标来源与作者确认记录见 `docs/branding/README.md`。公开截图为既有合成学习场景；私人工作区、API 凭据与更新签名私钥不随源码分发。
