# OGE Agent 演示用前端

仅做演示用途的对话框 UI：展示智能体思考阶段、工具调用 trace、最终答案、结果文件地址。

## 启动

```bash
# 1) 启动后端（另开一个终端）
cd ../oge-agent
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2) 启动前端
cd D:\02K2\gitclone\614\ge-agent-frontend\oge-agent-frontend
npm install   # 首次或更新依赖
npm run dev
```

浏览器打开 http://localhost:5173

> 前端通过 Vite 代理 (`vite.config.ts` 的 `server.proxy`) 把 `/api/*` 转发到后端 `http://127.0.0.1:8000`，因此**不要修改后端的 CORS 配置**。

## 测试问题

界面默认提供 3 个示例 chip，其中之一就是：

> 帮我分析下湖北大学4公里范围内有哪些公园

## 文件结构

```
src/
├── App.tsx, main.tsx, index.css
├── lib/
│   ├── api.ts            # SSE 流解析 + 任务结果拉取
│   ├── sse-types.ts      # 与后端事件对齐的 TS 类型
│   └── nodeMeta.ts       # LangGraph 节点 → 中文标签
├── hooks/
│   └── useChatStream.ts  # 对话状态机
└── components/
    ├── ChatWindow.tsx, InputBar.tsx, EmptyState.tsx
    ├── MessageBubble.tsx, AgentProcessPanel.tsx
    ├── ProgressTimeline.tsx, TraceStep.tsx
    ├── FinalAnswer.tsx, CodeBlock.tsx
    └── ResultFileCard.tsx
```

## 注意事项

- 前端代码 `user_id=1`、不传 token / session_id（首次）；后续会自动复用最近一次拿到的 `sessionId`
- 思考过程面板默认折叠，点击展开
- 浏览器需为现代版本（Chrome / Edge / Firefox 最近两年）
