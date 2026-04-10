# 新手手册：AI 协作做一个可上线项目（业务版）

## 1. 先讲业务流程（为什么要这样做）
你要做的不是“写代码”，而是“让业务能上线并可持续迭代”。  
标准业务流程是：

1. 先打通基建
说明：没有基建，业务功能写完也上不了线。
产出：有前端地址、后端地址、数据库。

2. 再做核心业务功能
说明：例如登录、背词、复习、阅读题。
产出：用户能完成完整学习流程。

3. 最后做优化和扩展
说明：如性能、监控、数据看板、增长功能。
产出：系统稳定且可运营。

## 2. 你和 AI 各做什么
你负责：
1. 登录和授权（GitHub、Cloudflare）
2. 在控制台点确认（只有平台授权类步骤需要你点）
3. 把报错截图或命令输出发给 AI

AI 负责：
1. 写代码、改代码、跑命令
2. 部署、联调、验收
3. 记录状态和下一步动作

## 3. 一次性准备（只做一次）
### 步骤 1：安装软件
做什么：安装 `Node`、`Git`、`gh`、`wrangler`。  
为什么：后面所有自动化都依赖这几个命令。  
成功标志：下面命令都能显示版本号。

```powershell
node -v
git --version
gh --version
npx wrangler --version
```

### 步骤 2：登录 Cloudflare
做什么：让本机有 Cloudflare 操作权限。  
怎么做：

```powershell
npx wrangler login
```

浏览器会弹出授权页，点同意即可。  
成功标志：

```powershell
npx wrangler whoami
```

能看到你的邮箱和 account id。

### 步骤 3：登录 GitHub
做什么：让 AI 可以创建仓库、提交代码、触发 CI。  
怎么做：

```powershell
gh auth login
```

成功标志：

```powershell
gh auth status
```

### 步骤 4：安装 Cloudflare GitHub App
做什么：让 Cloudflare Pages 能读取你的 GitHub 仓库。  
怎么做：
1. 打开 [Cloudflare Workers and Pages App](https://github.com/apps/cloudflare-workers-and-pages)
2. 点击 `Install` 或 `Configure`
3. 选择你的账号
4. 选 `All repositories`（小白推荐）或只选目标仓库

成功标志：Cloudflare 控制台 `Pages -> Connect to Git` 能看到你的仓库。

## 4. 每个新项目的标准步骤（按顺序）
### 步骤 A：新建 GitHub 仓库
做什么：给项目一个代码托管地址。  
你给 AI 的信息：`owner/repo`。

### 步骤 B：初始化项目模板
做什么：把标准目录、脚本、配置准备好。  
为什么：避免每次重复造轮子。

### 步骤 C：创建数据库（D1）
做什么：创建 D1，拿到 `database_id`，写入 `wrangler.toml`。  
为什么：后端要先有数据存储。

### 步骤 D：部署后端（Worker）
做什么：部署 API 服务，拿到 API 地址。  
为什么：前端需要调用后端接口。

### 步骤 E：创建 Pages（Git 原生集成）
做什么：把仓库连到 Pages，让每次 push 自动部署。  
为什么：后续迭代不需要手工上传文件。

### 步骤 F：配置前端环境变量
做什么：在 Pages 配置 `VITE_API_BASE=你的 Worker 地址`。  
为什么：告诉前端去哪里请求后端。

### 步骤 G：验收
必须通过：
1. API `/health` 正常
2. 页面地址打开 200
3. 至少一个业务接口可用（如登录）

## 5. 傻瓜式提问模板（你发给 AI）
每次开新项目，直接发下面 4 行：

```text
项目名：xxx
GitHub仓库：owner/repo
Cloudflare账号ID：xxxx
目标：先打通基建，再做业务
```

## 6. 常见报错怎么处理
### 报错 1：`8000011`（Pages Git 安装异常）
处理：
1. 重新安装 `Cloudflare Workers and Pages` GitHub App
2. 回到 Cloudflare 再点 `Connect to Git`

### 报错 2：`Authentication error` 或 `401`
处理：
1. 重新执行 `npx wrangler login`
2. 再执行 `gh auth login`

### 报错 3：页面打开了但接口报错
处理：
1. 检查 Pages 环境变量 `VITE_API_BASE` 是否是 Worker 线上地址
2. 检查 Worker `/health` 是否可访问

## 7. 你只要记住一句话
先把“前端地址 + 后端地址 + 数据库”打通，再做业务功能。  
这是最快、最稳、最省钱的路径。

