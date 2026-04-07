# 技术栈决策（MVP 固定版）

## 1. 运行时与后端
- 运行时：Cloudflare Workers
- 框架：Hono + TypeScript
- 原因：原生贴合 Cloudflare、轻量、API 优先开发效率高

## 2. 数据库
- 数据库：Cloudflare D1（SQLite）
- ORM：Drizzle ORM
- 迁移：wrangler d1 migrations

## 3. 前端
- React + Vite
- 部署：Cloudflare Pages
- 形态：H5，移动端优先适配

## 4. 鉴权
- 账号密码登录
- 密码哈希：PBKDF2（Workers WebCrypto）
- 会话：JWT（Bearer Token）

## 5. API 规范
- 风格：REST API
- 入参校验：Zod
- 鉴权：除 `/api/auth/*` 外统一鉴权中间件

## 6. 已创建接口（首批）
- `POST /api/auth/login`
- `GET /api/tasks/today`
- `POST /api/words/:wordId/feedback`
- `GET /health`

## 7. 下一阶段目标
1. 完成阅读生成与题目生成 API（AI 接口）
2. 完成教师端统计 API
3. 打通 Cloudflare 远端部署（Workers + D1 + Pages）
