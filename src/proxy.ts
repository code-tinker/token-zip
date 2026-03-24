import { encode } from 'gpt-tokenizer';
import { LLMClient } from './llm-client';
import { PricingCalculator } from './pricing';
import {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  TokenUsage,
  TokenZipStats,
  StreamChunk,
} from './types';
import {
  COMPRESS_SYSTEM_PROMPT,
  DECOMPRESS_SYSTEM_PROMPT,
  buildCompressionUserMessage,
  parseCompressedMessages,
  buildDecompressionUserMessage,
  injectTargetSystemPrompt,
} from './prompts';

export interface ProxyResult {
  content: string;
  stats: TokenZipStats;
}

export interface ProxyStreamResult {
  stream: AsyncGenerator<string>;
  getStats: () => Promise<TokenZipStats>;
}

function estimateTokens(text: string): number {
  try {
    return encode(text).length;
  } catch {
    return Math.ceil(text.length / 3);
  }
}

function estimateMessagesTokens(messages: ChatMessage[]): number {
  let total = 0;
  for (const m of messages) {
    total += estimateTokens(m.content) + 4; // role + formatting overhead
  }
  return total;
}

export class TokenZipProxy {
  constructor(
    private compressClient: LLMClient,
    private targetClient: LLMClient,
    private pricing: PricingCalculator,
    private targetModelId: string,
    private compressModelId: string,
  ) {}

  async process(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ProxyResult> {
    const totalStart = Date.now();
    console.log(`\n[token-zip] ${'='.repeat(60)}`);
    console.log(`[token-zip] New request | ${messages.length} message(s)`);
    console.log(`[token-zip] ${'='.repeat(60)}`);
    console.log(`[token-zip] Original input:`);
    for (const m of messages) {
      const preview = m.content.length > 200 ? m.content.slice(0, 200) + '...' : m.content;
      console.log(`[token-zip]   [${m.role}] ${preview}`);
    }

    // Step 1: Compress
    const t1 = Date.now();
    const { compressedMessages, usage: compressUsage } = await this.compress(messages);
    const t1End = Date.now();
    console.log(`\n[token-zip] ── Step 1/3 Compress ── ${t1End - t1}ms | API: ${compressUsage.inputTokens} in / ${compressUsage.outputTokens} out`);
    console.log(`[token-zip] Compressed result:`);
    for (const m of compressedMessages) {
      const preview = m.content.length > 300 ? m.content.slice(0, 300) + '...' : m.content;
      console.log(`[token-zip]   [${m.role}] ${preview}`);
    }

    // Step 2: Call target model with compressed messages
    const t2 = Date.now();
    const targetMessages = injectTargetSystemPrompt(compressedMessages);
    const targetResponse = await this.targetClient.chat(targetMessages, options);
    const t2End = Date.now();
    console.log(`\n[token-zip] ── Step 2/3 Target model ── ${t2End - t2}ms | ${targetResponse.usage.inputTokens} in / ${targetResponse.usage.outputTokens} out`);
    console.log(`[token-zip] Classical Chinese response (first 500 chars):`);
    console.log(targetResponse.content.slice(0, 500));
    if (targetResponse.content.length > 500) console.log('  ...(truncated)');

    // Step 3: Decompress
    const t3 = Date.now();
    const { content: decompressed, usage: decompressUsage } = await this.decompress(
      messages,
      targetResponse.content,
    );
    const t3End = Date.now();
    console.log(`\n[token-zip] ── Step 3/3 Decompress ── ${t3End - t3}ms | ${decompressUsage.inputTokens} in / ${decompressUsage.outputTokens} out`);
    console.log(`[token-zip] Final response (first 500 chars):`);
    console.log(decompressed.slice(0, 500));
    if (decompressed.length > 500) console.log('  ...(truncated)');
    console.log(`\n[token-zip] Total time: ${t3End - totalStart}ms`);

    // Estimate original tokens on the target model using char-to-token ratio
    // derived from the target model's own response (most accurate available proxy)
    const targetCharsPerToken = targetResponse.content.length / targetResponse.usage.outputTokens;
    const originalOutputTokens = Math.round(decompressed.length / targetCharsPerToken);
    const originalInputTokens = Math.round(
      messages.reduce((s, m) => s + m.content.length, 0) / targetCharsPerToken,
    ) + messages.length * 4;

    const stats = this.pricing.calculateStats({
      originalInputTokens,
      originalOutputTokens,
      compressedInputTokens: targetResponse.usage.inputTokens,
      compressedOutputTokens: targetResponse.usage.outputTokens,
      compressionModelUsage: compressUsage,
      decompressionModelUsage: decompressUsage,
      targetModelId: this.targetModelId,
      compressModelId: this.compressModelId,
    });

    this.logStats(stats);

    return { content: decompressed, stats };
  }

  async processStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ProxyStreamResult> {
    const originalInputTokens = estimateMessagesTokens(messages);

    // Step 1: Compress (non-streaming)
    const { compressedMessages, usage: compressUsage } = await this.compress(messages);

    // Step 2: Call target model (non-streaming, need full response for decompression)
    const targetMessages = injectTargetSystemPrompt(compressedMessages);
    const targetResponse = await this.targetClient.chat(targetMessages, options);

    // Step 3: Decompress (streaming)
    const decompMessages: ChatMessage[] = [
      { role: 'system', content: DECOMPRESS_SYSTEM_PROMPT },
      { role: 'user', content: buildDecompressionUserMessage(messages, targetResponse.content) },
    ];

    let decompressUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
    let fullContent = '';
    let statsResolved: (stats: TokenZipStats) => void;
    const statsPromise = new Promise<TokenZipStats>(resolve => {
      statsResolved = resolve;
    });

    const self = this;
    async function* streamGen(): AsyncGenerator<string> {
      const gen = self.compressClient.chatStream(decompMessages, { temperature: 0.3 });

      for await (const chunk of gen) {
        if (chunk.content) {
          fullContent += chunk.content;
          yield chunk.content;
        }
        if (chunk.usage) {
          decompressUsage = chunk.usage;
        }
      }

      const originalOutputTokens = estimateTokens(fullContent);
      const stats = self.pricing.calculateStats({
        originalInputTokens,
        originalOutputTokens,
        compressedInputTokens: targetResponse.usage.inputTokens,
        compressedOutputTokens: targetResponse.usage.outputTokens,
        compressionModelUsage: compressUsage,
        decompressionModelUsage: decompressUsage,
        targetModelId: self.targetModelId,
        compressModelId: self.compressModelId,
      });

      self.logStats(stats);
      statsResolved!(stats);
    }

    return {
      stream: streamGen(),
      getStats: () => statsPromise,
    };
  }

  private async compress(
    messages: ChatMessage[],
  ): Promise<{ compressedMessages: ChatMessage[]; usage: TokenUsage }> {
    const userContent = buildCompressionUserMessage(messages);
    const estimatedInputTokens = estimateTokens(userContent);

    const compressMessages: ChatMessage[] = [
      { role: 'system', content: COMPRESS_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ];

    try {
      const response = await this.compressClient.chat(compressMessages, {
        temperature: 0.2,
        maxTokens: Math.max(estimatedInputTokens * 2, 1024),
      });

      const compressedMessages = parseCompressedMessages(response.content, messages);

      return { compressedMessages, usage: response.usage };
    } catch (err) {
      console.error('[token-zip] Compression failed, using original messages:', err);
      return {
        compressedMessages: messages,
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    }
  }

  private async decompress(
    originalMessages: ChatMessage[],
    classicalResponse: string,
  ): Promise<ChatResponse> {
    const decompMessages: ChatMessage[] = [
      { role: 'system', content: DECOMPRESS_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildDecompressionUserMessage(originalMessages, classicalResponse),
      },
    ];

    try {
      return await this.compressClient.chat(decompMessages, { temperature: 0.3 });
    } catch (err) {
      console.error('[token-zip] Decompression failed, returning raw response:', err);
      return {
        content: classicalResponse,
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    }
  }

  private logStats(stats: TokenZipStats): void {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║       Token-Zip Compression Report      ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║ Input tokens:  ${String(stats.originalInputTokens).padStart(7)} → ${String(stats.compressedInputTokens).padStart(7)}  (saved ${stats.inputCompressionRatio}%)`);
    console.log(`║ Output tokens: ${String(stats.originalOutputTokens).padStart(7)} → ${String(stats.compressedOutputTokens).padStart(7)}  (saved ${stats.outputCompressionRatio}%)`);
    console.log(`║ Compression overhead: ${stats.compressionModelUsage.inputTokens + stats.compressionModelUsage.outputTokens} tokens`);
    console.log(`║ Decompression overhead: ${stats.decompressionModelUsage.inputTokens + stats.decompressionModelUsage.outputTokens} tokens`);

    if (stats.savings) {
      console.log('╠──────────────────────────────────────────╣');
      const { costWithoutZip, costWithZip, savings } = stats;
      if (costWithoutZip && costWithZip) {
        console.log(`║ Original cost:   $${costWithoutZip.amountUSD.toFixed(6)}`);
        console.log(`║ Compressed cost: $${costWithZip.amountUSD.toFixed(6)}`);
      }
      console.log(`║ Saved: $${savings.amountUSD.toFixed(6)} (${savings.percentage}%)`);
    }
    console.log('╚══════════════════════════════════════════╝\n');
  }
}
