import OpenAI from 'openai';

const TOKEN_ZIP_URL = 'http://localhost:3000/v1/chat/completions';
const DIRECT_BASE_URL = process.env.DIRECT_BASE_URL || 'REDACTED_BASE_URL';
const DIRECT_API_KEY = process.env.DIRECT_API_KEY || 'REDACTED_API_KEY';
const DIRECT_MODEL = process.env.DIRECT_MODEL || 'claude-opus-4-6';

interface TestCase {
  name: string;
  category: string;
  messages: { role: string; content: string }[];
}

const TEST_CASES: TestCase[] = [
  {
    name: 'Code Explanation',
    category: 'Programming',
    messages: [
      {
        role: 'user',
        content:
          'Explain how a B+ tree works in databases, including its structure, insertion, deletion, and why it is preferred over binary search trees for disk-based storage. Include pseudocode for the search operation.',
      },
    ],
  },
  {
    name: 'System Design',
    category: 'Architecture',
    messages: [
      {
        role: 'system',
        content: 'You are a senior software architect with 20 years of experience designing large-scale distributed systems.',
      },
      {
        role: 'user',
        content:
          'Design a URL shortener service like bit.ly that handles 100 million URLs per day. Cover the API design, database schema, hashing strategy, caching layer, and how to handle analytics (click tracking, geographic distribution). Discuss trade-offs between consistency and availability.',
      },
    ],
  },
  {
    name: 'Technical Writing',
    category: 'Documentation',
    messages: [
      {
        role: 'user',
        content:
          'Write a comprehensive guide on Kubernetes pod scheduling, covering node selectors, affinity/anti-affinity rules, taints and tolerations, topology spread constraints, and priority-based preemption. Include YAML examples for each concept.',
      },
    ],
  },
  {
    name: 'Algorithm Analysis',
    category: 'CS Theory',
    messages: [
      {
        role: 'user',
        content:
          'Compare and contrast the following sorting algorithms in detail: quicksort, mergesort, heapsort, and timsort. For each, explain the algorithm, provide time and space complexity for best/average/worst cases, discuss stability, cache performance, and real-world usage. Which would you recommend for different scenarios?',
      },
    ],
  },
  {
    name: 'Debugging Assistance',
    category: 'Programming',
    messages: [
      {
        role: 'system',
        content: 'You are an expert Node.js developer who specializes in debugging performance issues.',
      },
      {
        role: 'user',
        content: `Our Express.js API has a memory leak. The RSS grows from 200MB to 2GB over 24 hours, then the process crashes with OOM. Here's what we know:
- The leak happens only under load (>100 req/s)
- We use PostgreSQL with pg-pool (pool size 20)
- Redis for caching with ioredis
- Winston for logging with daily rotate
- Multer for file uploads (files saved to S3)
- The app runs on Kubernetes with 4GB memory limit

What systematic approach would you use to identify and fix this leak? Cover tooling, diagnostic steps, common Node.js memory leak patterns, and specific things to check for each dependency listed above.`,
      },
    ],
  },
];

const directClient = new OpenAI({
  apiKey: DIRECT_API_KEY,
  baseURL: DIRECT_BASE_URL,
});

async function callDirect(tc: TestCase) {
  const start = Date.now();
  const resp = await directClient.chat.completions.create({
    model: DIRECT_MODEL,
    messages: tc.messages as any,
    max_tokens: 4096,
  });
  const elapsed = Date.now() - start;
  return {
    content: resp.choices[0]?.message?.content || '',
    inputTokens: resp.usage?.prompt_tokens || 0,
    outputTokens: resp.usage?.completion_tokens || 0,
    elapsed,
  };
}

async function callTokenZip(tc: TestCase) {
  const start = Date.now();
  const resp = await fetch(TOKEN_ZIP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: tc.messages, max_tokens: 4096 }),
  });
  const data = await resp.json() as any;
  const elapsed = Date.now() - start;
  return {
    content: data.choices?.[0]?.message?.content || '',
    stats: data.token_zip_stats,
    elapsed,
  };
}

async function judgeQuality(
  question: string,
  directAnswer: string,
  zipAnswer: string,
): Promise<{ directScore: number; zipScore: number; reasoning: string }> {
  const resp = await directClient.chat.completions.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are an impartial judge. Rate the quality of two answers (A and B) to the same question on a scale of 1-10. Consider accuracy, completeness, clarity, and usefulness.

QUESTION:
${question}

ANSWER A (Direct):
${directAnswer.slice(0, 3000)}

ANSWER B (Token-Zip):
${zipAnswer.slice(0, 3000)}

Respond in this exact JSON format only, no other text:
{"directScore": <number>, "zipScore": <number>, "reasoning": "<brief explanation>"}`,
      },
    ],
  });

  const text = resp.choices[0]?.message?.content || '';
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return { directScore: 0, zipScore: 0, reasoning: 'Failed to parse judge response' };
}

async function main() {
  console.log('Token-Zip Benchmark');
  console.log('='.repeat(80));
  console.log(`Compress model: kimi-k2.5`);
  console.log(`Target model:   ${DIRECT_MODEL}`);
  console.log(`Judge model:    claude-sonnet-4-6`);
  console.log(`Test cases:     ${TEST_CASES.length}`);
  console.log('='.repeat(80));
  console.log();

  const results: any[] = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    console.log(`[${i + 1}/${TEST_CASES.length}] ${tc.name} (${tc.category})`);
    console.log('-'.repeat(60));

    console.log('  Running direct call...');
    const direct = await callDirect(tc);
    console.log(`  Direct: ${direct.elapsed}ms | ${direct.inputTokens} in / ${direct.outputTokens} out`);

    console.log('  Running Token-Zip call...');
    const zip = await callTokenZip(tc);
    console.log(`  Token-Zip: ${zip.elapsed}ms | stats: ${JSON.stringify(zip.stats?.savings || {})}`);

    console.log('  Judging quality...');
    const userQ = tc.messages.find(m => m.role === 'user')?.content || '';
    const judge = await judgeQuality(userQ, direct.content, zip.content);
    console.log(`  Scores: Direct=${judge.directScore}/10, Token-Zip=${judge.zipScore}/10`);
    console.log(`  Judge: ${judge.reasoning}`);
    console.log();

    results.push({
      name: tc.name,
      category: tc.category,
      direct: {
        inputTokens: direct.inputTokens,
        outputTokens: direct.outputTokens,
        elapsed: direct.elapsed,
      },
      zip: {
        inputTokens: zip.stats?.compressedInputTokens || 0,
        outputTokens: zip.stats?.compressedOutputTokens || 0,
        elapsed: zip.elapsed,
        originalInputTokens: zip.stats?.originalInputTokens || 0,
        originalOutputTokens: zip.stats?.originalOutputTokens || 0,
        inputCompressionRatio: zip.stats?.inputCompressionRatio || 0,
        outputCompressionRatio: zip.stats?.outputCompressionRatio || 0,
        costWithoutZip: zip.stats?.costWithoutZip?.amountUSD || 0,
        costWithZip: zip.stats?.costWithZip?.amountUSD || 0,
        savingsUSD: zip.stats?.savings?.amountUSD || 0,
        savingsPct: zip.stats?.savings?.percentage || 0,
      },
      quality: judge,
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  console.log('\n| Test Case | Category | Input Compression | Output Compression | Cost Saved | Direct Score | Zip Score |');
  console.log('|-----------|----------|------------------:|-------------------:|-----------:|-------------:|----------:|');
  for (const r of results) {
    console.log(
      `| ${r.name} | ${r.category} | ${r.zip.inputCompressionRatio}% | ${r.zip.outputCompressionRatio}% | ${r.zip.savingsPct}% ($${r.zip.savingsUSD.toFixed(4)}) | ${r.quality.directScore}/10 | ${r.quality.zipScore}/10 |`,
    );
  }

  const avgInputComp = results.reduce((s, r) => s + r.zip.inputCompressionRatio, 0) / results.length;
  const avgOutputComp = results.reduce((s, r) => s + r.zip.outputCompressionRatio, 0) / results.length;
  const avgSavings = results.reduce((s, r) => s + r.zip.savingsPct, 0) / results.length;
  const avgDirect = results.reduce((s, r) => s + r.quality.directScore, 0) / results.length;
  const avgZip = results.reduce((s, r) => s + r.quality.zipScore, 0) / results.length;
  const totalSaved = results.reduce((s, r) => s + r.zip.savingsUSD, 0);

  console.log(
    `| **Average** | | **${avgInputComp.toFixed(1)}%** | **${avgOutputComp.toFixed(1)}%** | **${avgSavings.toFixed(1)}%** ($${totalSaved.toFixed(4)}) | **${avgDirect.toFixed(1)}/10** | **${avgZip.toFixed(1)}/10** |`,
  );

  console.log('\n--- RAW JSON ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
