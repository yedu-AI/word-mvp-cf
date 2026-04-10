# Cloudflare 部署与回归手册（平台/基建）

## 1. 目标与接口约束
- 保持接口兼容：
  - `POST /api/auth/login`
  - `GET /health`
- 登录必须使用 `users.password_hash`（PBKDF2）进行校验，不允许明文比对。

## 2. 本地准备
```bash
npm install
npm run typecheck
```

## 3. 初始化或更新本地 D1
1. 应用迁移：
```bash
npm run drizzle:migrate:local -w @word-mvp/api
```
2. 回放稳定性检查（连续执行两次迁移并检查表结构）：
```powershell
powershell -ExecutionPolicy Bypass -File ./ai-ops-kit/scripts/25-verify-d1-replay.ps1 -ConfigPath ./ai-ops-kit/project.config.example.json
```

## 4. 生成安全密码哈希并写入测试账号
1. 生成哈希：
```bash
npm run password:hash -w @word-mvp/api -- Admin123!
```
2. 将输出替换 `<HASH>` 后执行：
```bash
cd apps/api
wrangler d1 execute word_mvp --local --command "INSERT OR REPLACE INTO users (id, username, password_hash, role, created_at) VALUES ('u_admin','admin','<HASH>','admin',strftime('%s','now')*1000);"
```

## 5. 本地接口验证（健康检查 + 鉴权）
```bash
npm run verify:auth -w @word-mvp/api
```
默认访问 `http://127.0.0.1:8787`，可通过环境变量覆盖：
- `API_BASE`
- `AUTH_USERNAME`
- `AUTH_PASSWORD`

## 6. Cloudflare 一键化部署顺序
```powershell
powershell -ExecutionPolicy Bypass -File ./ai-ops-kit/scripts/00-precheck.ps1 -ConfigPath ./ai-ops-kit/project.config.example.json
powershell -ExecutionPolicy Bypass -File ./ai-ops-kit/scripts/10-bootstrap.ps1 -ConfigPath ./ai-ops-kit/project.config.example.json
powershell -ExecutionPolicy Bypass -File ./ai-ops-kit/scripts/20-provision-cloudflare.ps1 -ConfigPath ./ai-ops-kit/project.config.example.json
powershell -ExecutionPolicy Bypass -File ./ai-ops-kit/scripts/30-connect-pages.ps1 -ConfigPath ./ai-ops-kit/project.config.example.json
powershell -ExecutionPolicy Bypass -File ./ai-ops-kit/scripts/40-verify.ps1 -ConfigPath ./ai-ops-kit/project.config.example.json
```

说明：
- `20-provision-cloudflare.ps1` 在部署后会主动轮询 `GET /health`，未通过则失败。
- `40-verify.ps1` 会验证登录成功、错误密码失败（401）、非法载荷失败（400）。
- 若只验证 Worker，可执行：
```powershell
powershell -ExecutionPolicy Bypass -File ./ai-ops-kit/scripts/40-verify.ps1 -ConfigPath ./ai-ops-kit/project.config.example.json -SkipWebCheck
```

## 7. 常见失败点
- `wrangler whoami` 失败：先执行 `npx wrangler login`
- `gh auth` 缺失：执行 `gh auth login`，或在 Pages 连接步骤显式传 `-OwnerId`/`-RepoId`
- 登录 401：检查 `users.password_hash` 是否为 `pbkdf2$...` 格式，而非明文
