export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ChatResponse {
  content: string;
  usage: TokenUsage;
}

export interface StreamChunk {
  content: string;
  usage?: TokenUsage;
}

export interface ModelPricing {
  displayName: string;
  provider: string;
  currency: 'USD' | 'CNY';
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  cachedInputPricePerMTok?: number;
}

export interface PricingConfig {
  exchangeRates: { USD_CNY: number };
  models: Record<string, ModelPricing>;
}

export interface CostBreakdown {
  amount: number;
  currency: string;
  amountUSD: number;
}

export interface TokenZipStats {
  originalInputTokens: number;
  compressedInputTokens: number;
  originalOutputTokens: number;
  compressedOutputTokens: number;
  inputCompressionRatio: number;
  outputCompressionRatio: number;
  compressionModelUsage: TokenUsage;
  decompressionModelUsage: TokenUsage;
  costWithoutZip?: CostBreakdown;
  costWithZip?: CostBreakdown;
  savings?: {
    amount: number;
    currency: string;
    amountUSD: number;
    percentage: number;
  };
}

export type ApiType = 'openai' | 'anthropic';

export interface ModelConfig {
  apiType: ApiType;
  model: string;
  apiKey: string;
  baseUrl: string;
}

export interface AppConfig {
  port: number;
  compress: ModelConfig;
  target: ModelConfig;
  usdCnyRate: number;
  logLevel: string;
}

export interface OpenAIChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: 'assistant'; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  token_zip_stats?: TokenZipStats;
}
