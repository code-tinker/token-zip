import { loadAppConfig, loadPricingConfig } from './config';
import { createClient } from './llm-client';
import { PricingCalculator } from './pricing';
import { TokenZipProxy } from './proxy';
import { createServer } from './server';

function main() {
  const config = loadAppConfig();
  const pricingConfig = loadPricingConfig();

  const compressClient = createClient(config.compress);
  const targetClient = createClient(config.target);
  const pricing = new PricingCalculator(pricingConfig, config.usdCnyRate);

  const proxy = new TokenZipProxy(
    compressClient,
    targetClient,
    pricing,
    config.target.model,
    config.compress.model,
  );

  const app = createServer(proxy, config.target.model);

  app.listen(config.port, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║              🗜️  Token-Zip 已启动                ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  端口:       ${String(config.port).padEnd(36)}║`);
    console.log(`║  压缩模型:   ${config.compress.model.padEnd(36)}║`);
    console.log(`║  目标模型:   ${config.target.model.padEnd(36)}║`);
    console.log(`║  汇率:       1 USD = ${config.usdCnyRate} CNY${' '.repeat(21)}║`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  API: http://localhost:${config.port}/v1/chat/completions`);
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');

    const targetPricing = pricing.findModel(config.target.model);
    const compressPricing = pricing.findModel(config.compress.model);
    if (targetPricing) {
      console.log(`  目标模型定价: ${targetPricing.inputPricePerMTok} ${targetPricing.currency}/MTok (输入) | ${targetPricing.outputPricePerMTok} ${targetPricing.currency}/MTok (输出)`);
    } else {
      console.log(`  ⚠ 目标模型 "${config.target.model}" 未在定价表中找到，费用计算不可用`);
    }
    if (compressPricing) {
      console.log(`  压缩模型定价: ${compressPricing.inputPricePerMTok} ${compressPricing.currency}/MTok (输入) | ${compressPricing.outputPricePerMTok} ${compressPricing.currency}/MTok (输出)`);
    } else {
      console.log(`  ⚠ 压缩模型 "${config.compress.model}" 未在定价表中找到`);
    }
    console.log('');
  });
}

main();
