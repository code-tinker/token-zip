# Token-Zip 🗜️

Slash your LLM costs by 40–60 % using the extreme expressiveness of Classical Chinese (文言文) to compress tokens.

## How It Works

Classical Chinese can convey the same meaning as English using far fewer tokens. Token-Zip exploits this by translating your input into Classical Chinese before it reaches the expensive model, asking the model to respond in Classical Chinese as well, and then translating the response back to the original language.

```
User input (English / Chinese / ...)
    │
    ▼
┌─────────────────────────┐
│  Compression Model      │  ← Kimi K2.5 / DeepSeek / etc. (cheap & fast)
│  Translate → Classical  │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Target Model           │  ← Claude Opus / GPT-5 Pro / etc. (expensive)
│  Process & respond in   │
│  Classical Chinese      │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Compression Model      │
│  Translate → original   │
└─────────────────────────┘
    │
    ▼
User receives original-language response + savings report
```

## Quick Start

### 1. Install

```bash
git clone https://github.com/code-tinker/token-zip.git && cd token-zip
npm install
```

### 2. Configure

```bash
cp .env.example .env
# edit .env with your keys and model choices
```

Key environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `COMPRESS_MODEL` | Cheap model for compression / decompression | `kimi-k2.5` |
| `COMPRESS_API_KEY` | API key for the compression model | `sk-xxx` |
| `COMPRESS_BASE_URL` | API base URL for the compression model | `https://api.moonshot.cn/v1` |
| `COMPRESS_API_TYPE` | API protocol (`openai` or `anthropic`) | `openai` |
| `TARGET_MODEL` | Expensive target model | `claude-opus-4.6` |
| `TARGET_API_KEY` | API key for the target model | `sk-ant-xxx` |
| `TARGET_API_TYPE` | API protocol | `anthropic` |

### 3. Run

```bash
# Development
npm run dev

# Production
npm run build && npm start
```

### 4. Use

Token-Zip exposes a standard OpenAI Chat Completions endpoint — drop it in as a replacement for any OpenAI-compatible client:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Explain how TCP three-way handshake works"}
    ]
  }'
```

Streaming:

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

## Savings Report

After each request the console prints a detailed compression summary:

```
╔══════════════════════════════════════════╗
║       Token-Zip Compression Report      ║
╠══════════════════════════════════════════╣
║ Input tokens:      520 →     198  (saved 61.92%)
║ Output tokens:     830 →     295  (saved 64.46%)
║ Compression overhead: 680 tokens
║ Decompression overhead: 1125 tokens
╠──────────────────────────────────────────╣
║ Original cost:  $0.023350
║ Compressed cost: $0.009770
║ 💰 Saved: $0.013580 (58.16%)
╚══════════════════════════════════════════╝
```

Non-streaming responses also include a `token_zip_stats` field for programmatic access.

## Model Pricing

`config/pricing.json` ships with pricing data for 20+ models:

- **Anthropic**: Claude Opus 4.6/4.5, Sonnet 4.5/4, Haiku 3.5
- **OpenAI**: GPT-5/5-Pro/5-Nano, GPT-4.1 series, o3-pro, o4-mini
- **Google**: Gemini 2.5 Pro/Flash
- **Chinese models**: Kimi K2.5, DeepSeek V3/R1, Qwen series, GLM-4, Doubao

Add a new model by editing `config/pricing.json`:

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

## Supported API Protocols

| Type | Models | Notes |
|------|--------|-------|
| `openai` | Kimi, DeepSeek, Qwen, OpenAI, Gemini, etc. | OpenAI-compatible protocol |
| `anthropic` | Claude series | Anthropic native protocol |

## Benchmark

A benchmark script is included for A/B comparison (direct call vs. Token-Zip proxy):

```bash
export DIRECT_API_KEY="your-key"
export DIRECT_BASE_URL="https://api.anthropic.com/v1"
export DIRECT_MODEL="claude-opus-4-6"

npm run dev &       # start Token-Zip in background
bash benchmark.sh   # run the benchmark
```

## License

MIT
