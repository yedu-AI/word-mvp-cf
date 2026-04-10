# 傻瓜式操作清单（照抄执行）

## 0. 开始前
把下面信息准备好：
1. 项目名（例如 `word-mvp-cf`）
2. GitHub 仓库（例如 `yedu-AI/word-mvp-cf`）
3. Cloudflare account id

## 1. 一次性环境检查（第一次做）
在终端依次执行：

```powershell
node -v
git --version
gh --version
npx wrangler --version
```

通过标准：每条命令都有版本输出。

## 2. 登录授权（第一次做）
```powershell
npx wrangler login
gh auth login
```

通过标准：
```powershell
npx wrangler whoami
gh auth status
```

## 3. 安装 GitHub App（第一次做）
1. 打开 [Cloudflare Workers and Pages App](https://github.com/apps/cloudflare-workers-and-pages)
2. 点 `Install` 或 `Configure`
3. 选 `All repositories`（推荐）

通过标准：Cloudflare `Pages -> Connect to Git` 能看到你的仓库。

## 4. 每个项目固定执行（按顺序）
在仓库根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\ai-ops-kit\scripts\00-precheck.ps1 -ConfigPath .\ai-ops-kit\project.config.example.json
powershell -ExecutionPolicy Bypass -File .\ai-ops-kit\scripts\10-bootstrap.ps1 -ConfigPath .\ai-ops-kit\project.config.example.json
powershell -ExecutionPolicy Bypass -File .\ai-ops-kit\scripts\20-provision-cloudflare.ps1 -ConfigPath .\ai-ops-kit\project.config.example.json
powershell -ExecutionPolicy Bypass -File .\ai-ops-kit\scripts\30-connect-pages.ps1 -ConfigPath .\ai-ops-kit\project.config.example.json
powershell -ExecutionPolicy Bypass -File .\ai-ops-kit\scripts\40-verify.ps1 -ConfigPath .\ai-ops-kit\project.config.example.json
```

## 5. 看到这些结果就算成功
1. 有 Worker 地址（`https://xxx.workers.dev`）
2. 有 Pages 地址（`https://xxx.pages.dev`）
3. `GET /health` 返回 `ok: true`
4. `ai-ops-kit/STATE.json` 里有最新 URL 和 D1 ID

## 6. 失败时怎么发给 AI（直接复制）
```text
我执行到第X步失败了。
命令是：xxxx
报错是：xxxx
截图：已附上
```

