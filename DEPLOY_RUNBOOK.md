# Cloudflare 部署与手动 API 执行手册

## 1. 已完成基线
- `apps/api`: Cloudflare Workers + Hono + D1（已含首版迁移与接口骨架）
- `apps/web`: React + Vite（Cloudflare Pages 可部署）
- D1 初始迁移：`apps/api/migrations/0001_init.sql`

## 2. 本地启动
1. 安装依赖：`npm install`
2. 执行本地 D1 迁移：`npm run drizzle:migrate:local -w @word-mvp/api`
3. 启动 API：`npm run dev:api`
4. 启动 Web：`npm run dev:web`

## 3. 初始化测试账号（本地 D1）
1. 生成密码哈希：
```bash
npm run password:hash -w @word-mvp/api -- Admin123!
```
2. 将输出哈希替换到 SQL 里并执行：
```bash
cd apps/api
wrangler d1 execute word_mvp --local --command "INSERT INTO users (id, username, password_hash, role, created_at) VALUES ('u_admin','admin','<HASH>','admin', strftime('%s','now') * 1000);"
```

## 4. 手动 API 调试（本地）
1. 登录：
```bash
curl -X POST http://127.0.0.1:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"Admin123!\"}"
```
2. 拉取今日任务（替换 TOKEN）：
```bash
curl http://127.0.0.1:8787/api/tasks/today \
  -H "Authorization: Bearer TOKEN"
```
3. 提交单词反馈（替换 TOKEN）：
```bash
curl -X POST http://127.0.0.1:8787/api/words/1/feedback \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"result\":\"know\"}"
```

## 5. Cloudflare 远端配置（你提供后我继续执行）
需要你提供：
1. `CLOUDFLARE_ACCOUNT_ID`
2. `CLOUDFLARE_API_TOKEN`（Workers + D1 + Pages 权限）
3. 远端 D1 数据库名（默认 `word_mvp`，可改）
4. GitHub 仓库名（`org/repo`）

## 6. 远端部署顺序（脚本化执行）
1. 创建 D1 数据库：`wrangler d1 create word_mvp`
2. 更新 `apps/api/wrangler.toml` 中 `database_id`
3. 执行远端迁移：`npm run drizzle:migrate:remote -w @word-mvp/api`
4. 部署 API：`npm run deploy -w @word-mvp/api`
5. 部署 Web 到 Pages（可用 `wrangler pages` 或 GitHub Actions）

## 7. 安全提醒
- 你在对话里发过 GitHub Token，建议尽快在 GitHub 里撤销并新建一个 token 再用于自动化。
