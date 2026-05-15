# TaskMaster AI

TaskMaster 是一个面向个人与小团队的任务管理应用，支持任务维护、模板复用、历史追踪与日报输出，并提供访客模式便于快速体验。

## 主要功能

- Google 登录（已提供访客模式，支持本地试用）
- 案件/父任务与子任务管理
- 任务模板与模板子任务管理
- 历史记录查看与任务回溯
- Excel 导入与周报导出（`.xlsx`）
- 基于 Gemini 的 AI 内容处理（需配置密钥）

## 技术栈

- React 19 + TypeScript + Vite 6
- Firebase（Authentication、Firestore）
- Express 开发服务器
- [exceljs](https://www.npmjs.com/package/exceljs) 处理 Excel 读写

## 本地运行

**前置条件：** Node.js 18+

1. 安装依赖：

   ```bash
   npm install
   ```

2. 配置环境变量（复制 `.env.example` 为 `.env.local` 并填写）：

   | 变量 | 说明 |
   | --- | --- |
   | `GEMINI_API_KEY` | Gemini API 密钥，用于 AI 功能 |
   | `APP_URL` | 应用访问地址（OAuth 回调、自引用链接等） |

3. 配置 Firebase：在 `firebase-applet-config.json` 中填写项目配置；若使用 Google 登录，请在 Firebase Console 中配置 Authentication 与 Authorized domains。

4. 启动开发环境：

   ```bash
   npm run dev
   ```

   默认访问：<http://localhost:3000>

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产包至 `dist/` |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | TypeScript 类型检查 |
| `npm audit` | 检查依赖安全漏洞 |

## Excel 导入说明

- 仅支持 **`.xlsx`** 格式（旧版 `.xls` 不支持）
- 导入文件需符合周报模板格式，数据从第 3 行开始
- 若存在名为 `import` 的工作表，将优先使用该表，否则使用第一个工作表

## 备注

- 访客模式下，数据保存在浏览器本地存储。
- 依赖安全：项目使用 `npm audit` 维护；Excel 相关功能使用 `exceljs`，不再使用存在已知漏洞且无官方补丁的 `xlsx` 包。
