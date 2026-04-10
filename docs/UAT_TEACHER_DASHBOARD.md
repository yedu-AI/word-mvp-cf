# 教师端最小看板 UAT（可上线判定）

## 1. 目标范围
本 UAT 只覆盖教师端最小看板能力，核心是以下 5 个指标能展示并可解释：
1. 完成率
2. 正确率
3. 复习积压
4. 连续学习天数
5. 阅读完成率

## 2. 执行前准备
在仓库根目录 `D:\背单词\word-mvp-cf` 执行：

```powershell
npm run dev:api
npm run dev:web
```

教师看板访问地址：
- `http://127.0.0.1:5173/src/teacher/index.html`

自动化脚本：
- `docs\uat_teacher_dashboard.ps1`
- 用法（包含教师登录校验）：
```powershell
powershell -ExecutionPolicy Bypass -File .\docs\uat_teacher_dashboard.ps1 -TeacherUsername teacher01 -TeacherPassword 123456
```
- 用法（仅检查页面与 API 可用性）：
```powershell
powershell -ExecutionPolicy Bypass -File .\docs\uat_teacher_dashboard.ps1
```

## 3. UAT 核心清单（逐项打勾）
1. 页面可打开，标题显示“教师端最小看板”。
2. 页面至少展示 5 张指标卡，且名称与目标一致。
3. 未登录时能看到数据（演示数据回退），不会空白。
4. 输入教师账号后点击“登录并刷新数据”，请求 `/api/auth/login` 成功时不报错。
5. 后端无教师接口时，页面出现“演示数据”标识和回退提示。
6. “指标口径（UAT 校验用）”中可看到 5 项口径定义。
7. 移动端宽度（<640px）下页面无重叠、可滚动查看完整数据。
8. 指标值显示格式正确：百分比保留 1 位小数；积压为“词”；连续天数为“天”。

## 4. 可上线判定规则
同时满足以下条件，即判定“可上线”：
1. `docs\uat_teacher_dashboard.ps1` 返回 exit code `0`。
2. 第 3 节 8 项全部通过。
3. 指标口径与第 5 节一致，无歧义项。
4. 教师账号登录后，不出现阻断级错误（白屏、崩溃、接口异常未处理）。

任一项不满足，判定“不可上线”。

## 5. 指标口径（与页面一致）
1. 完成率 = 当日完成学习流程学生数 / 班级学生总数  
分母范围：班级内 `role=student` 的用户数。
2. 正确率 = 当日反馈 `know` 次数 / 当日总反馈次数  
分母范围：当日 `learning_records` 中 `last_result` 总次数。
3. 复习积压 = 当前应复习但未完成条目数  
统计条件：`next_review_at <= 当前时间` 的 `learning_records` 条数。
4. 连续学习天数 = 班级学生个人连续学习天数的中位数  
统计窗口：按每个学生近 30 天有学习记录的自然日计算。
5. 阅读完成率 = 当日 `reading_status=done` 学生数 / 班级学生总数  
分母范围：班级内 `role=student` 的用户数。

## 6. 演示数据样例（页面默认回退）
```json
{
  "date": "2026-04-10",
  "className": "七年级(2)班",
  "sampleSize": 36,
  "completionRate": 72.2,
  "accuracyRate": 83.4,
  "reviewBacklog": 49,
  "streakDays": 11,
  "readingCompletionRate": 66.7
}
```
