# dsh-mail-cases · 客户邮件与事项跟进

DeepSeek Harness 的一个插件：把客户端（网易企业邮箱）的未读邮件自动整理成可跟进的事项，也支持把微信 / QQ 里的客户问题手动收进来。左侧栏「知识库」下面多一个入口，点开是三栏工作台。

![三栏](https://img.shields.io/badge/panel-%E4%B8%89%E6%A0%8F%E5%B7%A5%E4%BD%9C%E5%8F%B0-blue) ![license](https://img.shields.io/badge/license-MIT-green)

## 它做什么

- **自动整理**：每天 8:30（可改）抓昨天 8:30 到今天的未读邮件，翻译成中文、出摘要、列客户需求、给处理建议。
- **三栏工作台**：左边 Case 列表（未完成 / 已完成，按日期分组，可折叠）；中间邮件原文 + 中文全文 + 需求 + 建议；右边状态与处理记录。
- **同主题归并**：同一件事的后续邮件自动追加进原 Case，按时间往下排。
- **手动记录**：处理完随时补一条，带「下一步」，形成完整时间线。
- **微信 / QQ 事项**：手动新建，粘聊天记录、粘图片，来源会标在列表上。
- **完成 / 回收站 / 恢复 / 彻底删除 / 拆 Case / 导出 Markdown**。
- **添加到对话**：把一条事项的上下文预填进新对话的输入框，接着问你想问的。

## 安装（换一台电脑）

前提：那台机器已经装了 DeepSeek Harness，并且有网易企业邮箱的**客户端授权码**（不是登录密码）。

1. 把整个目录拷过去（或 `git clone` 到任意位置，比如 `D:\Plugins\dsh-mail-cases`）。
2. 在 DSH 里让 agent 装上它，一句话就行：

   > 把 `D:\Plugins\dsh-mail-cases` 作为插件装上

   等价于调用 `plugin_manager` 的 `install_bundle`，`target` 填这个绝对路径。
3. 装完在左侧栏点「客户邮件」→ 右上「设置」→ 填邮箱地址和授权码 → 「测试连接」→ 保存 → 「立即整理」。

装完若侧栏没出现图标，刷新一下页面（`Ctrl+R`）。

## 数据放在哪

| 内容 | 位置 |
|---|---|
| 数据库（Case / 邮件 / 记录） | `%LOCALAPPDATA%\dsh-mail-cases\cases.db` |
| 手动事项的图片与附件 | `%LOCALAPPDATA%\dsh-mail-cases\files\<caseId>\` |
| 授权码 | 同一个数据库的 `account` 表（本机明文，只有当前 Windows 用户可读） |

**换机器想带数据**：把上面整个 `dsh-mail-cases` 文件夹拷过去覆盖即可（先关掉 DSH）。
**只要功能不要历史**：什么都不用拷，新机器上的库会自动建。

## 邮箱要求

- IMAP：`imap.qiye.163.com:993`（默认，可在设置里改）。
- 必须在邮箱网页端「设置 → 账户与安全 → 客户端设置」生成**客户端授权码**，第三方客户端用它当密码。
- 管理员与成员两侧都要开启 IMAP 权限，否则报 `LOGIN.PERMDENY`。
- 网易后台的「收取范围」默认只允许第三方客户端同步近 30 天。

## 已知限制

- **只整理未读**：设了「只整理未读邮件」后，你在手机或邮箱大师里先读过的邮件不会进插件。这是所选口径的必然结果，设置里可以关掉。
- **单轮上限**：一次最多抓 60 封、翻译 30 封，超出的下一轮继续（Case 顶部会提示「有 N 封未整理」）。
- **只在应用运行时工作**：8:30 没开机不会跑，下次启动会补跑一次。
- **邮件附件只记文件名**，没有落盘；手动事项的图片/附件会真正存下来。
- 目前只适配**网易企业邮箱**；Outlook（微软已停 IMAP 基础认证，需要 OAuth2）未实现。
- 界面只有中文。

## 开发

无构建步骤，纯 ESM：

```
lib/index.js    宿主：/mail 路由、定时、IMAP 抓取、编排
lib/imap.js     极简 IMAP 客户端
lib/mime.js     MIME 解析（多段、编码字、GBK、quoted-printable）
lib/analyze.js  一次模型调用产出 标题/译文/摘要/需求/建议
lib/db.js       SQLite（node:sqlite，含老库迁移）
lib/client.js   三栏面板（React，注册到 sidebar.panellist + main）
test/smoke.mjs  冒烟测试：node test/smoke.mjs ./lib
```

改了宿主代码后需要让插件重新加载（禁用再启用 bundle，或重启 DSH）；改了 `lib/client.js` 刷新页面即可。

## License

MIT
