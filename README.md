# LangFast to OpenAI API Proxy

这是一个基于 Deno 的 API 服务器，它将 LangFast 的 API 代理为完全兼容 OpenAI 的接口。

## 功能特性

- **完全兼容 OpenAI API**: 支持标准的 `/v1/models` 和 `/v1/chat/completions` 端点
- **流式响应**: 通过 Server-Sent Events (SSE) 实时返回增量聊天内容
- **非流式响应**: 等待完整响应后一次性返回 JSON 格式的最终结果
- **无需外部依赖**: 使用 Deno 原生 WebSocket 实现 Socket.IO 协议

## 快速开始

### 前置要求

- 安装 [Deno](https://deno.land/)

### 本地运行

```bash
git clone https://github.com/CassiopeiaCode/langfast2api.git
cd langfast2api
deno task dev
```

服务器将在 `http://localhost:8000` 上启动。

### Deno Deploy 部署

本项目可以直接部署到 Deno Deploy：

1. 访问 [Deno Deploy](https://dash.deno.com/)
2. 创建新项目并连接到 GitHub 仓库
3. 选择 `deploy.ts` 作为入口点
4. 点击部署

或者使用 GitHub Actions 自动部署（见下文）。

## API 使用示例

### 获取模型列表

```bash
curl http://localhost:8000/v1/models
```

### 非流式聊天完成

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "stream": false
  }'
```

### 流式聊天完成

```bash
curl -N -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }'
```

## 项目结构

- `main.ts`: 主服务器文件，处理路由和请求
- `langfast_client.ts`: 封装与 LangFast 后端通信的逻辑
- `types.ts`: TypeScript 类型定义
- `models.json`: 模型列表配置
- `deno.jsonc`: Deno 配置文件

## 工作原理

1. **认证**: 获取 LangFast 的匿名访问令牌
2. **创建 Prompt**: 在 LangFast 中创建一个 prompt 并获取其 ID
3. **启动运行**: 启动 prompt 运行并获取任务 ID
4. **WebSocket 连接**: 通过 WebSocket 连接接收流式响应
5. **格式转换**: 将响应转换为 OpenAI 兼容的格式

## 开发

```bash
# 开发模式（自动重启）
deno task dev

# 检查代码
deno fmt
deno lint
deno check
```

## 许可证

MIT License