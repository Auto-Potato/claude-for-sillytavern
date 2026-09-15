# Claude for SillyTavern

SillyTavern 的 Claude 风格主题扩展，提供桌面与手机布局、暖纸日间/夜间配色，以及原生聊天控件的界面整合。

当前为 **0.1.0-dev 开发快照**，以 SillyTavern 1.18.0 为验证宿主。

## 功能

- 响应式侧栏、最近聊天、角色选择和欢迎页。
- 欢迎页新建角色聊天，保留输入草稿。
- 桌面长方形头像、底部消息操作和正文两侧切换箭头。
- 时间戳去掉年份、单行右对齐。
- 输入栏菜单、重新生成、扩展入口及断线反馈。
- 螃蟹入口收纳脚本操作按钮；具体脚本仍由其原扩展执行。
- 保留原生生成、消息编辑及头像查看功能。

## 安装

将本仓库放入酒馆的 `public/scripts/extensions/third-party/claude-theme-next/`，确保 `manifest.json` 直接位于该目录内。刷新酒馆并启用扩展。为避免样式互相覆盖，关闭其他会重写整套界面的主题扩展。

发布到 GitHub 后，也可以在酒馆扩展安装界面输入仓库地址。当前无需构建步骤，也不需要安装主题运行时依赖。

## 开发与预览

使用 Node.js 24+ 在仓库根目录执行 `npm test`。本快照的 11 项 Node 测试通过；这不代表所有第三方脚本和真机键盘场景均已覆盖。

主题加载后访问：

- `/scripts/extensions/third-party/claude-theme-next/preview.html`：480 × 1040 手机预览。
- `/scripts/extensions/third-party/claude-theme-next/preview-desktop.html`：1280 × 800 桌面预览。

预览页用于检查手机和桌面布局。浏览器测试页面位于 `tests/`。

## 文件结构

- `index.js`、`manifest.json`：扩展入口。
- `src/`：宿主桥接、侧栏、输入栏、消息及脚本面板逻辑。
- `styles/`：基础、双端布局、配色和组件样式。
- `icons/`：界面素材。
- `tests/`：自动化及浏览器检查页面。

字体在 `fonts/` 中以 WOFF2 分片本地提供，无需连接 Google Fonts；保留系统中文字体回退，中文正文的显示仍会随设备系统字体而变化。

本仓库不含聊天记录、角色卡、API 密钥、酒馆配置或个人代理设置。

## 来源与发布状态

设计与部分样式、图标参考或沿用 [claudenoshujin/claude-web](https://github.com/claudenoshujin/claude-web)。详见 [THIRD_PARTY.md](THIRD_PARTY.md)。仓库地址：https://github.com/Auto-Potato/claude-for-sillytavern
