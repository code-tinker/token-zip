# Token-Zip 🗜️

Cut your LLM API costs by **~50 % on average (up to 72 %)** — with **virtually no quality loss in most scenarios** — by compressing tokens through Classical Chinese (文言文).

![Token-Zip Architecture](index.png)

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

We ran **54 diverse English prompts** across **14 categories** through **Claude Opus 4.6** both directly and via Token-Zip (compression model: **Kimi K2.5**). An independent **Claude Sonnet 4.6** judge scored both responses on a 1–10 scale for accuracy, completeness, clarity, and usefulness.

### Results by Category

| Category | Cases | Avg Cost Saved | Direct Score | Zip Score |
|----------|------:|---------------:|:------------:|:---------:|
| Programming | 5 | 27.6 % | 7.2 | **8.0** |
| Architecture | 3 | 21.7 % | 7.3 | 7.3 |
| Business & Strategy | 6 | 51.5 % | **8.0** | 7.0 |
| Finance & Economics | 5 | 45.5 % | 7.0 | **7.6** |
| Science & Technology | 5 | 56.0 % | 6.8 | **7.8** |
| Education & Learning | 4 | 59.7 % | **8.3** | 7.0 |
| Healthcare & Medicine | 4 | 57.4 % | 7.3 | **8.0** |
| Law & Policy | 4 | 59.8 % | 7.3 | **8.3** |
| Marketing & Communications | 4 | 50.9 % | 7.5 | 7.3 |
| Philosophy & Ethics | 3 | 65.5 % | 6.7 | **7.3** |
| History & Social Science | 4 | 64.6 % | 7.3 | 6.8 |
| Creative & Writing | 4 | 53.6 % | 7.0 | **7.8** |
| Mathematics & CS Theory | 3 | 50.6 % | 7.0 | **8.0** |
| **Overall (54 cases)** | **54** | **50.9 %** | **7.3** | **7.6** |

### Top 10 Highest Savings

| Test Case | Category | Cost Saved | Direct | Zip |
|-----------|----------|------------|:------:|:---:|
| Employment Law | Law | 72.4 % | 7 | 6 |
| Cold War Analysis | History | 71.9 % | 6 | **7** |
| Teaching Philosophy | Education | 67.5 % | 7 | **8** |
| Learning Science | Education | 66.3 % | 9 | 7 |
| Ethics of AI | Philosophy | 70.3 % | 7 | **8** |
| Justice Theory | Philosophy | 65.1 % | 7 | 6 |
| Industrial Revolution | History | 65.8 % | **8** | 6 |
| Neuroscience of Memory | Science | 63.3 % | 6 | **8** |
| Urbanization Trends | Social Science | 62.8 % | **8** | 6 |
| Product Launch Plan | Marketing | 61.1 % | **8** | 7 |

### Key Takeaways

- **Quality actually improves on average.** Across 55 tests, Token-Zip scored **7.6 / 10** vs direct's **7.3 / 10** — a slight *positive* delta. The compression step forces the model to be more concise and focused, which often helps.
- **Average 51 % cost savings** across all 54 prompts. Non-technical content (humanities, law, science, healthcare) saves the most (57–66 %), while code-heavy content saves less (22–28 %) due to untranslatable syntax.
- **Best for natural-language-heavy content.** Philosophy (66 %), history (65 %), law (60 %), education (60 %), healthcare (57 %), and science (56 %) all exceed 55 % savings.
- **Honest about where it struggles.** Programming saves ~28 % on average — still meaningful but lower than prose-heavy domains. Content with lots of code blocks or YAML compresses less effectively.
- **Compression cost is negligible.** Kimi K2.5 costs ~$0.55 / MTok (input) — roughly 1/9th of Claude Opus input pricing.

### Run It Yourself

```bash
npm run dev &                              # start Token-Zip
CONCURRENCY=3 npx tsx run-benchmark.ts     # run the full 54-case benchmark (~50 min)
```

> **Note:** Savings depend on prompt length, content type, and model combination. All numbers above are real measurements from actual API calls, not theoretical estimates. Your results may vary.

## Security

To report a security vulnerability, **do not open a public GitHub Issue**. Please email us at:

**[it-security@yingmi.cn](mailto:it-security@yingmi.cn)**

See [SECURITY.md](SECURITY.md) for our full security policy and response timeline.

## License

This project is licensed under the **MIT License** — see [LICENSE.txt](LICENSE.txt) for the full text.

Copyright (c) 2026 Yingmi Inc. (https://www.yingmi.cn)
