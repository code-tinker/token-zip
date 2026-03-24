# Token-Zip 🗜️

利用文言文的极致表达力压缩 LLM Token，大幅降低顶尖大模型的使用成本。

## 原理

中文（尤其是文言文）用极少的字符就能表达英语需要大量词汇才能传达的含义。Token-Zip 利用这一特性，在请求昂贵模型前先将内容"压缩"为文言文，并要求模型以文言文回复，最后再"解压"回原始语言。

```
用户输入 (English/中文/...)
    │
    ▼
┌──────────────────┐
│ 压缩模型 (便宜)   │  ← Kimi K2.5 / DeepSeek 等
│ 翻译为文言文       │
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ 目标模型 (昂贵)   │  ← Claude Opus / GPT-5 Pro 等
│ 以文言文处理和回复  │
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ 压缩模型 (便宜)   │
│ 翻译回原始语言     │
└──────────────────┘
    │
    ▼
用户收到原始语言回复 + 节省报告
```

## 快速开始

### 1. 安装

```bash
git clone <repo-url> && cd token-zip
npm install
```

### 2. 配置

复制并编辑环境变量：

```bash
cp .env.example .env
```

主要配置项：

| 变量 | 说明 | 示例 |
|------|------|------|
| `COMPRESS_MODEL` | 压缩/解压用的便宜模型 | `kimi-k2.5` |
| `COMPRESS_API_KEY` | 压缩模型 API Key | `sk-xxx` |
| `COMPRESS_BASE_URL` | 压缩模型 API 地址 | `https://api.moonshot.cn/v1` |
| `COMPRESS_API_TYPE` | API 类型 | `openai` |
| `TARGET_MODEL` | 目标昂贵模型 | `claude-opus-4.6` |
| `TARGET_API_KEY` | 目标模型 API Key | `sk-ant-xxx` |
| `TARGET_API_TYPE` | API 类型 | `anthropic` |

### 3. 运行

```bash
# 开发模式
npm run dev

# 生产模式
npm run build && npm start
```

### 4. 使用

Token-Zip 暴露标准的 OpenAI Chat Completions API，可直接替换任何使用 OpenAI 协议的客户端：

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Explain how TCP three-way handshake works"}
    ]
  }'
```

流式输出：

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Explain how TCP three-way handshake works"}
    ],
    "stream": true
  }'
```

## 节省报告

每次请求完成后，控制台会输出详细的压缩统计：

```
╔══════════════════════════════════════════╗
║         Token-Zip 压缩统计报告           ║
╠══════════════════════════════════════════╣
║ 输入 tokens:     520 →     198  (节省 61.92%)
║ 输出 tokens:     830 →     295  (节省 64.46%)
║ 压缩模型开销: 680 tokens
║ 解压模型开销: 1125 tokens
╠──────────────────────────────────────────╣
║ 原始费用: $0.023350
║ 压缩后费用: $0.009770
║ 💰 节省: $0.013580 (58.16%)
╚══════════════════════════════════════════╝
```

非流式响应中还会包含 `token_zip_stats` 字段，供程序化读取。

## 模型定价配置

`config/pricing.json` 内置了主流模型的定价数据：

- **Anthropic**: Claude Opus 4.6/4.5, Sonnet 4.5/4, Haiku 3.5
- **OpenAI**: GPT-5/5-Pro/5-Nano, GPT-4.1 系列, o3-pro, o4-mini
- **Google**: Gemini 2.5 Pro/Flash
- **国产模型**: Kimi K2.5, DeepSeek V3/R1, Qwen 系列, GLM-4, 豆包

如需添加新模型，编辑 `config/pricing.json`：

```json
{
  "your-model-id": {
    "displayName": "Your Model",
    "provider": "provider-name",
    "currency": "USD",
    "inputPricePerMTok": 1.00,
    "outputPricePerMTok": 5.00
  }
}
```

## 支持的 API 类型

| 类型 | 适用模型 | 说明 |
|------|---------|------|
| `openai` | Kimi, DeepSeek, Qwen, OpenAI, Gemini 等 | OpenAI 兼容协议 |
| `anthropic` | Claude 系列 | Anthropic 原生协议 |

## License

MIT
