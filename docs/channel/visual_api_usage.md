# 70API 图片/视频模型 API 对接文档

本文档面向 70API 用户和下游 API 对接方，说明如何调用图片生成与视频生成模型。

图片生成是同步接口，调用成功后直接返回图片 URL。视频生成是异步任务流程，需要先创建任务，再轮询查询任务状态，任务完成后下载视频文件。

## 1. 接入信息

### 1.1 正式接口地址

```bash
BASE_URL="https://70api.top"
API_KEY="sk-你的密钥"
```

如果你是通过下游代理、聚合网关或自建 API 服务接入，请将 `BASE_URL` 替换成你的服务地址，例如：

```bash
BASE_URL="https://你的服务域名"
API_KEY="你的平台分发给用户的 API Key"
```

本文档所有接口路径都以 `BASE_URL` 为根地址，例如：

```text
POST {BASE_URL}/v1/images/generations
POST {BASE_URL}/v1/videos
GET  {BASE_URL}/v1/videos/{task_id}
GET  {BASE_URL}/v1/videos/{task_id}/content
```

### 1.2 公共请求头

所有请求都需要携带：

```http
Authorization: Bearer sk-你的密钥
Content-Type: application/json
```

下载视频文件时也需要携带 `Authorization`：

```http
Authorization: Bearer sk-你的密钥
```

### 1.3 调用前确认

请确认：

- 已创建可用的 API Key。
- 账户余额或额度充足。
- 请求中的 `model` 使用本文档列出的模型名称。
- 图片、视频等输入素材使用公网可访问的 `http/https` URL。
- 不要传本地路径、内网地址、需要登录的临时链接。
- 图片模型请使用 `/v1/images/generations`。
- 视频模型请使用 `/v1/videos` 创建任务。
- 不建议使用 `/v1/chat/completions` 调用本文档中的图片或视频模型。

## 2. 支持模型与接口

### 2.1 图片模型

| 模型 | 推荐用途 | 接口 |
| --- | --- | --- |
| `seedream-5.0` | 文生图、参考图生成 | `/v1/images/generations` |
| `seedream-4.5` | 文生图、参考图生成 | `/v1/images/generations` |
| `wan2.7-image-pro` | 文生图、图生图、参考图生成 | `/v1/images/generations` |

### 2.2 视频模型

| 模型 | 推荐用途 | 创建任务接口 | 查询任务接口 |
| --- | --- | --- | --- |
| `seedance-2.0` | 文生视频、图生视频、参考生视频 | `/v1/videos` | `/v1/videos/{task_id}` |
| `wan2.7` | 图生视频、首帧生视频、首尾帧生视频、参考视频 | `/v1/videos` | `/v1/videos/{task_id}` |
| `happyhorse-1.0` | 多图参考、首尾帧过渡、参考生视频 | `/v1/videos` | `/v1/videos/{task_id}` |

## 3. 图片生成

图片生成接口为同步接口。请求成功后，响应中会直接返回图片 URL。

### 3.1 文生图

```bash
curl "$BASE_URL/v1/images/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "seedream-5.0",
    "input": {
      "messages": [
        {
          "role": "user",
          "content": [
            {
              "text": "一张产品海报，玻璃质感香水瓶，清晨窗边自然光，商业摄影"
            }
          ]
        }
      ]
    },
    "parameters": {
      "size": "1024*1024",
      "n": 1,
      "watermark": false
    }
  }'
```

### 3.2 图生图 / 参考图生成

如果模型支持参考图，可以在 `input.messages[].content` 中同时传入图片和文本。

```bash
curl "$BASE_URL/v1/images/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan2.7-image-pro",
    "input": {
      "messages": [
        {
          "role": "user",
          "content": [
            {
              "image": "https://example.com/reference-1.png"
            },
            {
              "text": "保留人物姿势，改成电影感夜景霓虹街头"
            }
          ]
        }
      ]
    },
    "parameters": {
      "size": "1024*1024",
      "n": 1,
      "watermark": false
    }
  }'
```

### 3.3 图片请求字段说明

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | 是 | 图片模型名称，例如 `seedream-5.0` |
| `input.messages` | array | 是 | 消息数组 |
| `input.messages[].role` | string | 是 | 固定传 `user` |
| `input.messages[].content` | array | 是 | 内容数组，可包含文本和图片 |
| `content[].text` | string | 文生图必填 | 图片提示词 |
| `content[].image` | string | 图生图时填写 | 公网可访问的图片 URL |
| `parameters.size` | string | 否 | 图片尺寸，例如 `1024*1024` |
| `parameters.n` | number | 否 | 生成数量，通常传 `1` |
| `parameters.watermark` | boolean | 否 | 是否添加水印 |
| `parameters.prompt_extend` | boolean | 否 | 是否开启提示词扩展，按模型能力支持 |
| `parameters.seed` | number | 否 | 随机种子，按模型能力支持 |

### 3.4 图片成功响应示例

```json
{
  "output": {
    "choices": [
      {
        "finish_reason": "stop",
        "message": {
          "role": "assistant",
          "content": [
            {
              "type": "image",
              "image": "https://example.com/result.png"
            }
          ]
        }
      }
    ],
    "finished": true
  },
  "usage": {
    "image_count": 1,
    "input_tokens": 37,
    "output_tokens": 2,
    "size": "1024*1024",
    "total_tokens": 39
  },
  "request_id": "request_xxx"
}
```

### 3.5 取图方式

推荐遍历：

```text
output.choices[].message.content[]
```

取其中：

```json
{
  "type": "image",
  "image": "https://example.com/result.png"
}
```

如果只生成一张图，也可以直接读取：

```text
output.choices[0].message.content[0].image
```

## 4. 视频生成

视频生成是异步任务流程：

1. 调用 `POST /v1/videos` 创建任务。
2. 从响应中读取 `id` 或 `task_id`。
3. 调用 `GET /v1/videos/{task_id}` 查询任务状态。
4. 状态为 `completed` 或 `SUCCEEDED` 后，读取 `metadata.url`，或调用 `/content` 下载视频文件。

### 4.1 文生视频

适合 `seedance-2.0` 等支持文生视频的模型。

```bash
curl "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "seedance-2.0",
    "prompt": "一辆白色跑车穿过雨夜城市街道，镜头低角度跟拍，电影感，真实光影",
    "input": {
      "prompt": "一辆白色跑车穿过雨夜城市街道，镜头低角度跟拍，电影感，真实光影"
    },
    "seconds": "5",
    "size": "1280x720",
    "metadata": {
      "ratio": "16:9",
      "resolution": "720p",
      "duration": 5,
      "watermark": false
    }
  }'
```

### 4.2 单图生视频 / 首帧生视频

适合 `wan2.7`、`seedance-2.0` 等模型。

```bash
curl "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan2.7",
    "prompt": "让画面中的人物缓慢转身，背景灯光轻微流动，镜头稳定推进",
    "input": {
      "prompt": "让画面中的人物缓慢转身，背景灯光轻微流动，镜头稳定推进"
    },
    "image": "https://example.com/start-frame.png",
    "seconds": "5",
    "size": "1280x720",
    "metadata": {
      "ratio": "16:9",
      "resolution": "720p",
      "duration": 5,
      "watermark": false
    }
  }'
```

### 4.3 多图参考 / 首尾帧过渡

适合 `happyhorse-1.0`、`wan2.7` 等支持多图参考的模型。

```bash
curl "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "happyhorse-1.0",
    "prompt": "根据首尾帧生成自然过渡动画，镜头平滑移动",
    "input": {
      "prompt": "根据首尾帧生成自然过渡动画，镜头平滑移动"
    },
    "images": [
      "https://example.com/first-frame.png",
      "https://example.com/last-frame.png"
    ],
    "seconds": "5",
    "size": "1280x720",
    "metadata": {
      "ratio": "16:9",
      "resolution": "720p",
      "duration": 5,
      "watermark": false
    }
  }'
```

### 4.4 视频作为输入

如果模型支持视频输入，可以通过 `metadata.content` 传入视频 URL。

```json
{
  "model": "seedance-2.0",
  "prompt": "基于输入视频做风格化重绘，保持主体运动轨迹，改成赛博朋克城市风格",
  "input": {
    "prompt": "基于输入视频做风格化重绘，保持主体运动轨迹，改成赛博朋克城市风格"
  },
  "seconds": "5",
  "metadata": {
    "content": [
      {
        "type": "video_url",
        "video_url": {
          "url": "https://example.com/input.mp4"
        }
      }
    ],
    "ratio": "16:9",
    "resolution": "720p",
    "duration": 5,
    "watermark": false
  }
}
```

### 4.5 视频请求字段说明

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | 是 | 视频模型名称，例如 `seedance-2.0` |
| `prompt` | string | 是 | 顶层提示词 |
| `input.prompt` | string | 是 | 输入提示词。建议与顶层 `prompt` 保持一致 |
| `seconds` | string | 否 | 视频时长，建议传字符串，例如 `"5"` |
| `size` | string | 否 | 视频尺寸，例如 `1280x720` |
| `image` | string | 图生视频时填写 | 单张参考图 URL，常用于首帧生视频 |
| `images` | array | 多图参考时填写 | 多张参考图 URL |
| `metadata.ratio` | string | 否 | 宽高比，例如 `16:9`、`9:16`、`1:1` |
| `metadata.resolution` | string | 否 | 分辨率，例如 `720p`、`1080p` |
| `metadata.duration` | number | 否 | 视频时长，数字类型 |
| `metadata.watermark` | boolean | 否 | 是否添加水印 |
| `metadata.prompt_extend` | boolean | 否 | 是否开启提示词扩展 |
| `metadata.seed` | number | 否 | 随机种子，按模型能力支持 |
| `metadata.camera_fixed` | boolean | 否 | 是否固定镜头，按模型能力支持 |
| `metadata.content` | array | 否 | 输入视频、音频等扩展素材 |

注意：

- 视频请求建议同时传 `prompt` 和 `input.prompt`。
- `seconds` 建议传字符串，例如 `"5"`。
- `metadata.duration` 建议传数字，例如 `5`。
- 如果同时传 `seconds` 和 `metadata.duration`，建议两者保持一致。
- 不同模型支持的扩展参数不同，实际效果以模型能力为准。

### 4.6 创建任务成功响应示例

```json
{
  "id": "task_xxxxxxxxxxxx",
  "task_id": "task_xxxxxxxxxxxx",
  "status": "RUNNING",
  "progress": 0
}
```

创建成功后，请保存 `id` 或 `task_id`，用于后续查询。

## 5. 查询视频任务

### 5.1 查询任务状态

```bash
curl "$BASE_URL/v1/videos/task_xxxxxxxxxxxx" \
  -H "Authorization: Bearer $API_KEY"
```

### 5.2 生成中响应示例

```json
{
  "id": "task_xxxxxxxxxxxx",
  "object": "video",
  "model": "seedance-2.0",
  "status": "in_progress",
  "progress": 30,
  "created_at": 1760000000,
  "metadata": {
    "url": ""
  }
}
```

### 5.3 完成响应示例

```json
{
  "id": "task_xxxxxxxxxxxx",
  "object": "video",
  "model": "seedance-2.0",
  "status": "completed",
  "progress": 100,
  "created_at": 1760000000,
  "completed_at": 1760000030,
  "metadata": {
    "url": "https://example.com/result.mp4"
  }
}
```

### 5.4 状态说明

不同接入层可能返回不同大小写或不同命名。建议客户端兼容以下状态：

| 含义 | 可能状态 |
| --- | --- |
| 排队中 | `queued`、`PENDING`、`SUBMITTED` |
| 生成中 | `in_progress`、`RUNNING`、`IN_PROGRESS` |
| 已完成 | `completed`、`SUCCEEDED`、`SUCCESS` |
| 失败 | `failed`、`FAILED`、`FAILURE` |

建议判断逻辑：

- `completed` / `SUCCEEDED` / `SUCCESS`：任务成功。
- `failed` / `FAILED` / `FAILURE`：任务失败。
- 其他状态继续轮询。

建议每 2 到 5 秒轮询一次，任务完成或失败后停止轮询。

## 6. 下载视频文件

视频任务完成后，可以通过两种方式获取视频。

### 6.1 使用 `metadata.url`

任务完成后，优先读取：

```text
metadata.url
```

如果 `metadata.url` 是一个公网可访问的视频地址，可以直接下载或播放。

如果 `metadata.url` 是类似下面的代理地址：

```text
https://你的服务域名/v1/videos/task_xxxxxxxxxxxx/content
```

则下载时必须携带 `Authorization` 请求头。

### 6.2 使用 `/content` 下载

```bash
curl -L "$BASE_URL/v1/videos/task_xxxxxxxxxxxx/content" \
  -H "Authorization: Bearer $API_KEY" \
  --output result.mp4
```

注意：

- `/content` 下载接口也需要鉴权。
- 不建议前端浏览器直接访问需要鉴权的 `/content` 地址。
- 如果前端需要播放视频，建议由你的后端携带 API Key 下载视频后，再转存到自己的对象存储或静态资源服务。
- 如果浏览器直接播放的是需要鉴权的 `/content` 地址，可能出现无法播放、黑屏或 401/403/502 等情况。

## 7. 下游 API / 网关对接说明

如果你使用 New API、One API、OpenAI 兼容网关或自建代理服务，把 70API 作为上游模型通道，请注意以下要求。

### 7.1 路由要求

下游服务应保持以下路径可用：

```text
POST /v1/images/generations
POST /v1/videos
GET  /v1/videos/{task_id}
GET  /v1/videos/{task_id}/content
```

不要把图片或视频请求转发到：

```text
/v1/chat/completions
```

### 7.2 请求体透传要求

图片和视频请求体包含非标准 OpenAI 字段，例如：

```text
input
parameters
metadata
seconds
image
images
```

因此，下游网关需要支持请求体透传，避免过滤、重写或丢弃这些字段。

尤其是视频请求，必须保留：

```json
{
  "prompt": "...",
  "input": {
    "prompt": "..."
  }
}
```

如果网关丢失 `input.prompt`，上游可能返回类似错误：

```text
Field required: input.prompt
```

### 7.3 鉴权转发

下游网关接收到用户请求后，需要：

1. 校验用户自己的 API Key。
2. 将请求转发给上游 70API。
3. 转发时使用上游 70API Key：

```http
Authorization: Bearer sk-上游密钥
Content-Type: application/json
```

不要把上游密钥暴露给终端用户。

### 7.4 视频任务与下载代理

视频生成是异步任务。下游网关需要正确处理：

- 创建任务响应中的 `id` / `task_id`。
- 查询任务状态。
- 完成后返回可下载的视频地址。
- 如果返回 `/content` 代理地址，应保证该地址能携带用户鉴权下载到真实视频文件。

建议 `/content` 代理实现逻辑：

1. 根据用户身份和 `task_id` 查询任务。
2. 确认任务属于当前用户。
3. 确认任务状态已完成。
4. 获取真实视频 URL。
5. 服务端下载真实视频流。
6. 将 `Content-Type: video/mp4` 等响应头转发给客户端。

## 8. 快速自测流程

### 8.1 测试图片生成

```bash
curl "$BASE_URL/v1/images/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "seedream-5.0",
    "input": {
      "messages": [
        {
          "role": "user",
          "content": [
            {
              "text": "一只透明玻璃杯放在木桌上，阳光从窗边照进来，真实摄影风格"
            }
          ]
        }
      ]
    },
    "parameters": {
      "size": "1024*1024",
      "n": 1,
      "watermark": false
    }
  }'
```

测试成功的判断标准：

- HTTP 状态码为 `200`。
- 响应中存在 `output.choices`。
- 能从 `output.choices[].message.content[]` 中读取到 `image` URL。

### 8.2 测试视频生成

创建任务：

```bash
curl "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "seedance-2.0",
    "prompt": "雨夜城市街道，一辆白色跑车缓慢驶过，电影感，真实光影",
    "input": {
      "prompt": "雨夜城市街道，一辆白色跑车缓慢驶过，电影感，真实光影"
    },
    "seconds": "5",
    "size": "1280x720",
    "metadata": {
      "ratio": "16:9",
      "resolution": "720p",
      "duration": 5,
      "watermark": false
    }
  }'
```

查询任务：

```bash
curl "$BASE_URL/v1/videos/task_xxxxxxxxxxxx" \
  -H "Authorization: Bearer $API_KEY"
```

下载视频：

```bash
curl -L "$BASE_URL/v1/videos/task_xxxxxxxxxxxx/content" \
  -H "Authorization: Bearer $API_KEY" \
  --output result.mp4
```

测试成功的判断标准：

- 创建任务响应中返回 `id` 或 `task_id`。
- 查询任务时状态从排队或生成中变为完成。
- 完成后 `metadata.url` 不为空。
- `/content` 下载接口返回视频文件。
- 下载的视频文件可以正常播放。

## 9. 常见问题

### 图片接口为什么没有任务 ID？

图片生成是同步返回结果。调用成功后直接在响应中读取图片 URL。

推荐读取：

```text
output.choices[].message.content[].image
```

### 视频接口为什么提交后没有立即返回视频？

视频生成是异步任务。提交接口只创建任务，真实视频需要等待生成完成后再查询结果。

### 视频请求为什么要同时传 `prompt` 和 `input.prompt`？

部分视频模型要求 `input.prompt` 存在。为了兼容不同模型和网关，建议始终同时传：

```json
{
  "prompt": "提示词",
  "input": {
    "prompt": "提示词"
  }
}
```

### 参考图、输入视频应该传本地文件还是 URL？

建议传公网可访问的 `https` URL。

不要传：

- 本地文件路径。
- 内网地址。
- 需要登录后才能访问的链接。
- 很快过期的临时 URL。

### 自定义参数放在哪里？

图片参数放在 `parameters` 中，例如：

```json
{
  "size": "1024*1024",
  "n": 1,
  "watermark": false
}
```

视频参数放在 `metadata` 中，例如：

```json
{
  "ratio": "16:9",
  "resolution": "720p",
  "duration": 5,
  "seed": 20260619,
  "watermark": false
}
```

### `seconds` 和 `duration` 用哪个？

建议两个都传，并保持一致：

```json
{
  "seconds": "5",
  "metadata": {
    "duration": 5
  }
}
```

其中：

- `seconds` 建议传字符串。
- `metadata.duration` 建议传数字。

### 为什么视频地址浏览器不能直接播放？

如果视频地址是 `/content` 代理地址，它通常需要 `Authorization` 鉴权。浏览器直接把该地址放进 `<video>` 标签时，无法自动携带 API Key，可能导致无法播放或黑屏。

建议做法：

- 后端携带 API Key 下载视频。
- 保存到自己的对象存储或静态资源服务。
- 前端播放你自己的公开视频地址。

### 生成结果会保存多久？

生成结果 URL 可能是临时地址。若需要长期访问，请在生成完成后尽快下载保存到自己的对象存储或静态资源服务。

建议按 24 小时内保存处理，不要依赖临时结果 URL 长期可用。

### 返回报错时怎么排查？

请优先检查：

- API Key 是否正确。
- 账户余额或额度是否充足。
- `model` 是否拼写正确。
- 图片模型是否调用 `/v1/images/generations`。
- 视频模型是否调用 `/v1/videos`。
- 视频请求是否同时传了 `prompt` 和 `input.prompt`。
- 下游网关是否开启请求体透传。
- 输入图片或视频 URL 是否公网可访问。
- 下载 `/content` 时是否携带 `Authorization`。
