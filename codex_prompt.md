我正在尝试将一个 Deno 应用程序部署到 Deno Deploy，但它在 'Warm Up' 阶段失败了。日志显示服务器已启动，但部署最终超时。

情况如下：
- 该应用程序是一个 API 代理，将请求转发到另一个服务。
- 它使用 Deno 的原生 `serve` 函数。
- 部署的入口点是 `deploy.ts`。

这是 `deploy.ts` 的相关代码：
```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// ... 其他导入 ...

async function handleRequest(req: Request): Promise<Response> {
  // ... 请求处理逻辑 ...
  // 这部分包含异步操作，如 fetch 和 new WebSocket()
}

serve(handleRequest, {
  port: Deno.env.get("PORT") ? Number(Deno.env.get("PORT")) : 8000,
  hostname: "0.0.0.0"
});
```

这是 `deno.jsonc` 的内容：
```json
{
  "tasks": {
    "dev": "deno run --allow-net --allow-read --watch main.ts",
    "deploy": "deno run --allow-net --allow-read deploy.ts"
  },
  "imports": {},
  "compilerOptions": {
    "lib": ["deno.window"]
  },
  "deploy": {
    "entrypoint": "deploy.ts"
  }
}
```

`handleRequest` 函数在处理请求时执行了多个 `await` 操作。错误是在 'Warm Up' 阶段超时。我已经将服务器配置为监听 `0.0.0.0` 和正确的 `PORT`。

可能是什么原因导致 Deno Deploy 的预热阶段失败？这是否与服务器初始化阶段的顶层异步操作有关？