# README 星标历史图

README 使用面积填充图，通过 `<picture>` 在 GitHub 明暗主题下选择两份 SVG。浅色线条为 ChatNote 的 `#317659`，深色线条为 `#a1d9c0`，与 `src/styles.css` 一致；填充沿用生成器的透明度。图片位于 `.github/assets/star-history-{light,dark}.svg`。

`.github/workflows/star-history.yml` 每天北京时间06:17调度，也可在 Actions → Update star history → Run workflow 手动刷新。GitHub 调度可能延迟。

生成器为固定提交的 [Star Chart v0.3](https://github.com/leereilly/star-chart/releases/tag/v0.3)，原有 MIT 许可归上游所有。它只从 GitHub 获取仓库元数据与按周汇总的星标计数，不读取星标用户名单；使用本次运行的内置 `GITHUB_TOKEN`，不需要添加个人令牌。工作流只提交两份生成图，客户端、官网及发行版本不变。失败时保留仓库中此前的图片。

`scripts/style-star-history.mjs` 仅调整生成图中的曲线、填充和星标强调色，不改动数据、坐标或来源说明。升级生成器后应检查颜色声明、面积图和明暗主题是否仍正确。

曲线累计的是 GitHub 历史接口记录的新增 Stars，右上角是仓库当前 Stars。取消星标和历史保留范围可能导致两者不同，不能将历史新增曲线解释为每一天的精确净星标数。仓库尚新或星标较少时，面积图平缓属于真实数据表现。
