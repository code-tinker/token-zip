import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ChatMessage, ChatOptions, ChatResponse, StreamChunk, ModelConfig } from './types';

export interface LLMClient {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<StreamChunk>;
}

class OpenAICompatClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(config: ModelConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
    this.model = config.model;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.3,
      ...(options?.maxTokens && { max_tokens: options.maxTokens }),
      ...(options?.topP !== undefined && { top_p: options.topP }),
    });

    return {
      content: response.choices[0]?.message?.content || '',
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
    };
  }

  async *chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.3,
      stream: true,
      stream_options: { include_usage: true },
      ...(options?.maxTokens && { max_tokens: options.maxTokens }),
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield { content };
      }
      if (chunk.usage) {
        yield {
          content: '',
          usage: {
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
          },
        };
      }
    }
  }
}

class AnthropicClient implements LLMClient {
  private client: Anthropic;
  private model: string;

  constructor(config: ModelConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.baseUrl && { baseURL: config.baseUrl }),
    });
    this.model = config.model;
  }

  private splitSystem(messages: ChatMessage[]): {
    system: string | undefined;
    rest: Array<{ role: 'user' | 'assistant'; content: string }>;
  } {
    const systemMsg = messages.find(m => m.role === 'system');
    const rest = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    return { system: systemMsg?.content, rest };
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const { system, rest } = this.splitSystem(messages);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options?.maxTokens || 8192,
      ...(system && { system }),
      messages: rest,
      temperature: options?.temperature ?? 0.3,
    });

    const content = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map(c => c.text)
      .join('');

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  async *chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<StreamChunk> {
    const { system, rest } = this.splitSystem(messages);

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: options?.maxTokens || 8192,
      ...(system && { system }),
      messages: rest,
      temperature: options?.temperature ?? 0.3,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield { content: event.delta.text };
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      content: '',
      usage: {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      },
    };
  }
}

export function createClient(config: ModelConfig): LLMClient {
  if (config.apiType === 'anthropic') {
    return new AnthropicClient(config);
  }
  return new OpenAICompatClient(config);
}
