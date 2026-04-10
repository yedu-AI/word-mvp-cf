# AI Ops Kit

这个目录是“给 AI 执行”的可复用资产。目标是让任何 AI 都能按同一流程完成基建。

## 目录
- `AI_CONTRACT.md`: 给 AI 的执行协议
- `STATE.template.json`: 状态模板
- `project.config.example.json`: 项目配置样例
- `scripts/`: 可执行脚本

## 脚本顺序
1. `scripts/00-precheck.ps1`
2. `scripts/10-bootstrap.ps1`
3. `scripts/20-provision-cloudflare.ps1`
4. `scripts/30-connect-pages.ps1`
5. `scripts/40-verify.ps1`

## 最小使用方式
```powershell
powershell -ExecutionPolicy Bypass -File ./ai-ops-kit/scripts/00-precheck.ps1
powershell -ExecutionPolicy Bypass -File ./ai-ops-kit/scripts/10-bootstrap.ps1 -ConfigPath ./ai-ops-kit/project.config.example.json
powershell -ExecutionPolicy Bypass -File ./ai-ops-kit/scripts/20-provision-cloudflare.ps1 -ConfigPath ./ai-ops-kit/project.config.example.json
powershell -ExecutionPolicy Bypass -File ./ai-ops-kit/scripts/30-connect-pages.ps1 -ConfigPath ./ai-ops-kit/project.config.example.json
powershell -ExecutionPolicy Bypass -File ./ai-ops-kit/scripts/40-verify.ps1 -ConfigPath ./ai-ops-kit/project.config.example.json
```

## 说明
- 脚本默认在仓库根目录执行。
- 不要求把 token 贴到聊天里；优先使用本机 `wrangler login` 和 `gh auth`。
- 所有关键输出都会回写到 `ai-ops-kit/STATE.json`。
- 如果机器没有 `gh`，执行 `30-connect-pages.ps1` 时可显式传 `-OwnerId` 和 `-RepoId`。
