# TaskMaster

TaskMaster 是一个面向个人与小团队的任务管理应用，支持任务维护、模板复用、历史追踪与日报输出，并提供访客模式便于快速体验。

## 主要功能

- Google 登录（已提供访客模式，支持本地试用）
- 案件/父任务与子任务管理
- 任务模板与模板子任务管理
- 历史记录查看与任务回溯
- 文件导入与日报生成
- 基于 AI 的内容处理能力（需配置密钥）

## 本地运行

**前置条件：** Node.js 18+

1. 安装依赖：
   `npm install`
2. 配置环境变量（在 `.env.local` 中设置）：
   - `GEMINI_API_KEY=你的密钥`
3. 启动开发环境：
   `npm run dev`

## 备注

- 如需使用 Google 登录，请在 Firebase Console 中正确配置 Authentication 与 Authorized domains。
- 访客模式下，数据会保存在浏览器本地存储。
