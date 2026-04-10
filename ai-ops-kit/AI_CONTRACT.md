# AI 执行协议（可跨模型复用）

## 1. 目标
把新项目从空白状态推进到“可访问、可联调、可迭代”的基建完成状态。

## 2. 输入
最少输入：
1. `projectName`
2. `github.owner`
3. `github.repo`
4. `cloudflare.accountId`

可选输入：
1. `cloudflare.d1Name`
2. `cloudflare.pagesProject`
3. `cloudflare.workerName`
4. 测试账号

## 3. 执行顺序（必须）
1. 环境检查
2. 项目命名和配置初始化
3. Cloudflare 资源开通（D1 + Worker）
4. Pages Git 集成
5. 验收
6. 回写状态文件

## 4. 输出（必须）
1. Worker URL
2. Pages URL
3. D1 database_id
4. 验收结果（通过/失败+原因）
5. 下一步动作（最多 3 条）

## 5. 安全规则
1. 不要求用户在聊天贴明文 token
2. 优先使用本机登录态（`wrangler login`, `gh auth`)
3. 不把 secret 写入 git 跟踪文件
4. 若检测到认证失败，先报告再重试

## 6. 失败处理
1. 每一步失败必须给出：错误信息 + 最小修复动作
2. 不跨步继续执行
3. 修复后从失败步骤重试，不从头重跑

## 7. 成功判定
1. API `/health` 返回 `ok: true`
2. Pages 首页返回 200
3. 至少一个业务 API 联调成功
4. `STATE.json` 已写入最新信息

