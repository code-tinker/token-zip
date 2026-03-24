import { PricingConfig, TokenUsage, TokenZipStats, CostBreakdown } from './types';

export class PricingCalculator {
  constructor(
    private config: PricingConfig,
    private usdCnyRate: number,
  ) {}

  private toUSD(amount: number, currency: string): number {
    if (currency === 'USD') return amount;
    if (currency === 'CNY') return amount / this.usdCnyRate;
    return amount;
  }

  private toCNY(amount: number, currency: string): number {
    if (currency === 'CNY') return amount;
    if (currency === 'USD') return amount * this.usdCnyRate;
    return amount;
  }

  private calcModelCost(
    modelId: string,
    usage: TokenUsage,
  ): CostBreakdown | null {
    const pricing = this.findModel(modelId);
    if (!pricing) return null;

    const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPricePerMTok;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPricePerMTok;
    const amount = inputCost + outputCost;

    return {
      amount,
      currency: pricing.currency,
      amountUSD: this.toUSD(amount, pricing.currency),
    };
  }

  findModel(modelId: string) {
    const normalizedId = modelId.toLowerCase();
    if (this.config.models[normalizedId]) {
      return this.config.models[normalizedId];
    }
    for (const [key, val] of Object.entries(this.config.models)) {
      if (normalizedId.includes(key) || key.includes(normalizedId)) {
        return val;
      }
    }
    return null;
  }

  calculateStats(params: {
    originalInputTokens: number;
    originalOutputTokens: number;
    compressedInputTokens: number;
    compressedOutputTokens: number;
    compressionModelUsage: TokenUsage;
    decompressionModelUsage: TokenUsage;
    targetModelId: string;
    compressModelId: string;
  }): TokenZipStats {
    const inputRatio = params.originalInputTokens > 0
      ? 1 - params.compressedInputTokens / params.originalInputTokens
      : 0;
    const outputRatio = params.originalOutputTokens > 0
      ? 1 - params.compressedOutputTokens / params.originalOutputTokens
      : 0;

    const stats: TokenZipStats = {
      originalInputTokens: params.originalInputTokens,
      compressedInputTokens: params.compressedInputTokens,
      originalOutputTokens: params.originalOutputTokens,
      compressedOutputTokens: params.compressedOutputTokens,
      inputCompressionRatio: Math.round(inputRatio * 10000) / 100,
      outputCompressionRatio: Math.round(outputRatio * 10000) / 100,
      compressionModelUsage: params.compressionModelUsage,
      decompressionModelUsage: params.decompressionModelUsage,
    };

    const targetPricing = this.findModel(params.targetModelId);
    const compressPricing = this.findModel(params.compressModelId);

    if (targetPricing) {
      const costWithout = this.calcModelCost(params.targetModelId, {
        inputTokens: params.originalInputTokens,
        outputTokens: params.originalOutputTokens,
      })!;

      const costTargetCompressed = this.calcModelCost(params.targetModelId, {
        inputTokens: params.compressedInputTokens,
        outputTokens: params.compressedOutputTokens,
      })!;

      let compressCostUSD = 0;
      if (compressPricing) {
        const compCost = this.calcModelCost(params.compressModelId, params.compressionModelUsage);
        const decompCost = this.calcModelCost(params.compressModelId, params.decompressionModelUsage);
        compressCostUSD = (compCost?.amountUSD || 0) + (decompCost?.amountUSD || 0);
      }

      const totalCostWithZipUSD = costTargetCompressed.amountUSD + compressCostUSD;
      const savingsUSD = costWithout.amountUSD - totalCostWithZipUSD;
      const savingsPct = costWithout.amountUSD > 0
        ? (savingsUSD / costWithout.amountUSD) * 100
        : 0;

      stats.costWithoutZip = costWithout;
      stats.costWithZip = {
        amount: totalCostWithZipUSD * (targetPricing.currency === 'CNY' ? this.usdCnyRate : 1),
        currency: targetPricing.currency,
        amountUSD: totalCostWithZipUSD,
      };
      stats.savings = {
        amount: savingsUSD * (targetPricing.currency === 'CNY' ? this.usdCnyRate : 1),
        currency: targetPricing.currency,
        amountUSD: savingsUSD,
        percentage: Math.round(savingsPct * 100) / 100,
      };
    }

    return stats;
  }
}
