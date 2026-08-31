# 讲师手册

> 这份不是给学员读的，是给**讲师现场操作**用的。
> Prompt 正文、验收命令、决策卡都在 [`BUILD-FROM-ZERO.md`](./BUILD-FROM-ZERO.md)，
> 本文件只管**节奏、话术、翻车处理**，两边不重复。
>
> 编号只有一套：**Prompt 0–11**，对应 tag `prompt-0` … `prompt-11`。
>
> **语言**：学员全英文。`BUILD-FROM-ZERO.md`、学员粘进 Claude Code 的 Prompt、
> 演示数据、UI、代码注释**全部英文**。本文件是唯一的中文文档，是你自己的现场操作手册。
> 讲课时可以中文讲，但屏幕上出现的一切都必须是英文——学员看的是屏幕。

---

## 课前 30 分钟（必做）

```bash
# 1. 干净状态
cd ~/Documents/workspace/pawn-employee-assistant
git status                       # 应为 clean
git checkout main

# 2. 两条云端通道都预检（没有本地模型，断网就没有 Plan B）
LLM_PROVIDER=portkey npx tsx scripts/check-llm.ts
LLM_PROVIDER=direct  npx tsx scripts/check-llm.ts

# 3. 确认 Portkey dashboard 能打开——Prompt 5 的高光要当场给学员看

# 4. 完整跑一遍
make demo && sleep 30 && npm run smoke && make down

# 5. Claude Desktop 注册预演（Prompt 4 的高光，必须课前试通）
#    用 servers/hr 的 stdio 入口，不是 HTTP —— Desktop 的 config 只认 stdio
#    改完配置要完全退出 Claude Desktop 再启动，否则不重新加载

# 6. 埋雷（Prompt 10 用）
git checkout prompt-9
# 把 execute.ts 的 Promise.allSettled 改成 Promise.all
git commit -am "refactor: simplify concurrent execution"
```

**第 5、6 步一定要课前做完。** 现场改 bug 会露馅，学员看到你手动制造问题，
这一步的教学效果就没了。

---

## 时间轴（180 分钟）

| 时刻 | Prompt | 主题 | 形式 | 现场关键动作 |
|---|---|---|---|---|
| 0:00 | — | 开场：两个 demo 的分工 | 讲 | 对比 Demo 1：那个讲治理，这个讲编排 |
| 0:05 | 0 | Context Stack | 现场 | **故意让 AI 抢跑一次**，当众打断 |
| 0:15 | 1 | PRD | 现场 | 当场答"不要"，示范做减法 |
| 0:25 | 2 | 骨架 | 现场 | 压住想加 LLM 的冲动 |
| 0:40 | 3 | HR tool + 单测 | 现场 | 让 AI 去读 SDK 类型定义 |
| 1:00 | 4 | **协议级验收** | 现场 | 贴进 Claude Desktop 当场问一句 |
| 1:15 | — | 休息 | | |
| 1:25 | 5 | 模型出口 | 现场 | **切通道 + 给学员看 Portkey dashboard 的空行** |
| 1:35 | 6 | 规划器 | 现场 | 展示 debug 日志里的原始 plan |
| 1:55 | 7 | 第二个 Agent + 合成 | 现场 | 三句话连问，看规划器自己拆；再问第四句展示单轮规划的边界 |
| 2:15 | 8 | SSE | 现场 | |
| 2:25 | 9 | **学员自建 Agent** | 学员 | 讲师巡场，不许砍时长 |
| 2:40 | 10 | AI Debug | 现场 | 逼 AI 先解释再动手 |
| 2:55 | 11 | 收口 | 现场 | 当众看行数是否超 2000 |
| 3:00 | | 收尾 | | |

---

## 五个现场高光（记住这五个，其他都是铺垫）

1. **Prompt 0 的打断**（1 分钟）
   AI 一开始就写代码，你打断它："你违反了要求：先输出计划。"
   学员需要看到"AI 抢跑时怎么拉回来"，而不是只看到顺利的演示。

2. **Prompt 4 挂进 Claude Desktop**（30 秒）
   把注册 JSON（**stdio 那份**）贴进你本机的 Claude Desktop，
   完全退出重启，问 "Who is Dana Reeve's manager?"。
   学员刚建的东西被一个真实 host 调用了——这一刻的说服力抵半小时讲解。

3. **Prompt 5 切通道**（30 秒）
   `LLM_PROVIDER` 从 `portkey` 改成 `direct`，同样的问题、同样的答案、代码一行没改。
   然后打开 Portkey dashboard：走网关那次带着延迟、token、成本躺在那儿，直连那次**什么都没有**。
   让全场盯着那个空白看三秒——**你买的不是更好的答案，是能看见、能计价、能限额、能拦截**。
   这比讲十页"网关的价值"管用。

4. **Prompt 7 三句连问 + 第四句**（3 分钟）
   单域 → 单域 → 跨域，让学员看到规划器**自己在判断要不要拆**，不是写死的规则。
   然后问第四句 **"Who else reports to my manager?"**——它会拒答（实测 7 次 7 次拒），
   因为 `get_team` 需要的 manager 名字只有第一次调用才拿得到，而且没有"列出所有人"的工具
   可以绕过去。**当众承认这个边界**，它就是附录 A 存在的理由。

   > **不要用 "Which tickets is my manager waiting to approve?" 来演这个边界。**
   > 实测 7 次里 6 次它答出来了，而且答对了：规划器改成"把所有 awaiting_approval 的工单
   > 全捞回来"，让写作模型在上下文里做 join。单轮规划不是不能链式，是**用过量抓取替代链式**
   > ——只要抓回来的量还塞得进上下文就成立，塞不下的那天它是**静默**退化，不是报错。
   > 这个事实比"它会失败"更值钱，但它不适合当众赌：现场问上面那句拒答稳定的。

5. **Prompt 9 的 `git diff apps/web` 为空**（10 秒）
   学员加完第三个 Agent，当众敲这条命令。空输出就是架构的判卷结果。

---

## 常见翻车与处理

| 现象 | 处理 |
|---|---|
| AI 抢跑写代码 | 打断，重申"先计划"。**第一次故意让它发生**，后面就不会了 |
| MCP SDK API 与 AI 记忆不符 | 让它读 `node_modules/@modelcontextprotocol/sdk` 的类型定义 |
| Portkey 报 401 / 限流 | 一行切 `LLM_PROVIDER=direct`，正好演示第 3 个高光 |
| 直连也挂了（vendor 侧故障） | 换 `PLANNER_VENDOR` / `WRITER_VENDOR` 到另一家。三家 key 就是为这个准备的 |
| 会场断网 | **没有 Plan B**。Prompt 0-4 不需要网，照常讲；Prompt 5 之后改用 $HOST 上的部署实例演示，或念 TEST-CASES 里的录屏结果 |
| 规划器 JSON 不稳 | 换 `PLANNER_VENDOR`。规划器只看 JSON 稳定性，不看文采 |
| 规划器输出不合 schema | 这是**真实现象不是故障**，展示重试逻辑，讲为什么不兜底到默认 Agent |
| 边界演示问题答出来了 | "7 次 7 次拒答"是对非确定系统的统计结论，只在某个模型的某一天成立。**每期开课前把 Prompt 7 的第 4 句和 5b 各跑两遍**，不成立就换问题，别在现场发现 |
| 学员卡在 Prompt 9 | `git checkout prompt-9`，别让任何人卡死 |
| AI 生成了中文注释或中文错误信息 | 学员的 Prompt 被污染了。检查他是不是用中文补问了一句——CLAUDE.md 里已写死 English only |
| 整体进度落后 20 分钟 | 按下面的砍单顺序 |

---

## 砍单顺序（现场必然超时）

1. 加餐 A/B（ToolLoopAgent、Guardrail）→ 口头两句带过
2. Prompt 8（SSE）→ 展示写好的效果，不现场写。好看，但不改变架构
3. Prompt 10（AI Debug）→ 缩到 8 分钟，只做"先解释再动手"那一轮对话
4. **Prompt 9 的学员时间不许砍。** 学员自己写成一个 Agent 的 15 分钟，
   比讲师演示 45 分钟留下的东西多

---

## 学员课前准备

发给学员，让他们**上课前**装好：

```bash
node -v          # 需要 >= 20.9（Next 16 的下限）
git --version
docker --version # 只有 Prompt 11 的 make demo 需要；没有就用 npm run dev
```

Claude Code 已登录可用。**API key 现场发**：Prompt 0-4 不需要 key，
课间休息时发下去，Prompt 5 开始用。

学员准备清单发英文版：

```
node -v          # needs >= 20.9
git --version
# Claude Code signed in
# You will receive an API key at the break. Prompts 0-4 need no key and no internet.
```
