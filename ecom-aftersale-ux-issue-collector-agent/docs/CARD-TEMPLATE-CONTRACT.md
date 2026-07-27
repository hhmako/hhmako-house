# 飞书卡片模板变量契约

代码包含真实数据读取、变量生成、发送前校验和发送能力，但飞书 CardKit
模板属于使用者自己的云端资源，不能随 Git 仓库自动复制。每位同事需要在
自己的飞书环境复制现有模板或新建模板，再把发布后的模板 ID 写入
`config.local.json`。

禁止把模板中的标题、图片、负责人和按钮 URL 写成固定示例值。变量缺失时
应隐藏对应区域或显示空状态，不能回退到假数据。

## 1. 双周合并卡片

配置项：`cardTemplate.templateId`

顶层变量：

| 变量 | 类型 | 组件用途 |
| --- | --- | --- |
| `header_title` | 文本 | 卡片主标题 |
| `header_summary` | 文本 | 新录入、已解决数量摘要 |
| `new_section_title` | 文本 | 新录入分区标题 |
| `new_count` | 数字 | 新录入数量 |
| `processing_section_title` | 文本 | 已解决分区标题 |
| `processing_count` | 数字 | 两周内已解决数量 |
| `new_issues` | 对象数组 | 新录入问题循环容器 |
| `processing_issues` | 对象数组 | 已解决问题循环容器 |
| `unfollowed_count` | 数字 | 当前仍为“待确认”的数量 |
| `unfollowed_tip` | 文本 | `有X个问题暂无跟进，请尽快解决` |
| `unfollowed_notice` | 文本 | 已废弃，保持空字符串 |
| `issue_base_url` | URL | “打开问题收集表”按钮 |

`new_issues` 每个对象：

| 变量 | 类型 | 组件用途 |
| --- | --- | --- |
| `record_id` | 文本 | 审计与映射，不直接展示 |
| `title_line` | 富文本或文本 | `P0 · 简短标题`，标题组件加粗 |
| `problem_line` | 文本 | 精简问题描述 |
| `owner_line` | 文本 | 负责人 |
| `image_key` | 图片对象 | `{ "img_key": "img_xxx" }` |
| `source_url` | URL | “查看来源”按钮，打开真实原帖 |
| `detail_url` | URL | 标题或信息区域，打开当前记录 |

图片组件必须绑定 `new_issues.image_key` 并开启“查看图片预览”，让缩略图
可点击放大。来源按钮必须绑定 `new_issues.source_url`，不能绑定表格首页。

`processing_issues` 每个对象：

| 变量 | 类型 | 组件用途 |
| --- | --- | --- |
| `record_id` | 文本 | 审计与映射 |
| `line` | 纯文本 | `【优先级】页面｜标题｜负责人` |
| `detail_url` | URL | 当前记录详情 |

## 2. 实时单条卡片

配置项：`cardTemplate.realtimeTemplateId`

默认变量名可以在 `cardTemplate.realtimeVariables` 中调整：

| 默认变量 | 类型 | 组件用途 |
| --- | --- | --- |
| `header_title` | 文本 | 卡片主标题 |
| `title_line` | 富文本或文本 | 优先级和简短标题 |
| `problem_line` | 文本 | 问题描述 |
| `owner_line` | 文本 | 负责人 |
| `image_key` | 图片对象 | `{ "img_key": "img_xxx" }` |
| `source_url` | URL | “查看来源”按钮 |
| `detail_url` | URL | 当前 Base 记录详情 |
| `issue_base_url` | URL | 问题收集表 |

实时卡片同样必须开启图片预览。来自两个反馈群和人工录入群的问题每条单独
发送，不能展示双周卡片中的“已解决”或“未跟进”分区。

## 3. 发布前检查

1. 发布模板新版本，并把新模板 ID 写入本机配置。
2. 所有文字组件直接绑定变量，不把 `{{变量名}}` 当普通文字。
3. 图片组件绑定图片对象中的 `img_key`，且开启大图预览。
4. “查看来源”绑定 `source_url`；标题/信息区绑定 `detail_url`。
5. 底部按钮绑定 `issue_base_url`。
6. 清空模板默认示例标题、示例负责人、示例图片和示例链接。
7. 用一条真实测试记录验证后，再启用实时监听和双周任务。
