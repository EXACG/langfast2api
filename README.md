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

本项目可以直接部署到 Deno Deploy，无需服务器维护。

#### 方法一：通过 Deno Deploy 控制台手动部署

1. **准备 GitHub 仓库**
   - 确保代码已推送到 GitHub 仓库
   - 本项目已配置好 `deploy.ts` 作为入口点

2. **创建 Deno Deploy 项目**
   - 访问 [Deno Deploy Dashboard](https://dash.deno.com/)
   - 点击 "New Project"
   - 选择 "GitHub" 连接你的 GitHub 账户
   - 选择 `CassiopeiaCode/langfast2api` 仓库
   - 选择 `main` 分支

3. **配置部署设置**
   - **入口点**: 选择 `deploy.ts`
   - **环境变量**: 无需额外配置（所有配置已在代码中）
   - 点击 "Deploy" 开始部署

4. **获取部署 URL**
   - 部署完成后，你会得到一个类似 `https://langfast2api-xxxx.deno.dev` 的 URL
   - 这个 URL 就是你的 API 端点，可以直接使用

#### 方法二：通过 GitHub Actions 自动部署

1. **获取 Deno Deploy 访问令牌**
   - 在 Deno Deploy Dashboard 中
   - 点击右上角头像 → "Account"
   - 在 "Deno Deploy API tokens" 部分创建新令牌
   - 复制生成的令牌

2. **配置 GitHub Secrets**
   - 在 GitHub 仓库中
   - 进入 "Settings" → "Secrets and variables" → "Actions"
   - 点击 "New repository secret"
   - 添加以下 secrets：
     - `DENO_DEPLOY_TOKEN`: 上一步获取的 Deno Deploy 令牌
     - `DENO_PROJECT_ID`: 你的 Deno Deploy 项目 ID（从项目 URL 获取）

3. **修改工作流文件**
   - 编辑 `.github/workflows/deploy.yml`
   - 将 `project: "langfast2api"` 替换为你的实际项目 ID

4. **触发部署**
   - 推送代码到 `main` 分支会自动触发部署
   - 也可以在 GitHub Actions 页面手动触发

#### 部署后使用

部署完成后，你可以使用以下方式测试：

```bash
# 替换 YOUR_DEPLOY_URL 为你的实际部署 URL
YOUR_DEPLOY_URL="https://your-project-name.deno.dev"

# 测试模型列表
curl $YOUR_DEPLOY_URL/v1/models

# 测试聊天完成
curl -X POST $YOUR_DEPLOY_URL/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'
```

#### 注意事项

- Deno Deploy 免费版有请求限制，生产环境请考虑升级
- WebSocket 连接在 Deno Deploy 上有超时限制，长时间请求可能需要优化
- 部署日志可以在 Deno Deploy Dashboard 中查看

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