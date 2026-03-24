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
    console.log('║              🗜️  Token-Zip Started               ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Port:            ${String(config.port).padEnd(31)}║`);
    console.log(`║  Compress model:  ${config.compress.model.padEnd(31)}║`);
    console.log(`║  Target model:    ${config.target.model.padEnd(31)}║`);
    console.log(`║  Exchange rate:   1 USD = ${config.usdCnyRate} CNY${' '.repeat(16)}║`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  API: http://localhost:${config.port}/v1/chat/completions`);
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');

    const targetPricing = pricing.findModel(config.target.model);
    const compressPricing = pricing.findModel(config.compress.model);
    if (targetPricing) {
      console.log(`  Target pricing: ${targetPricing.inputPricePerMTok} ${targetPricing.currency}/MTok (input) | ${targetPricing.outputPricePerMTok} ${targetPricing.currency}/MTok (output)`);
    } else {
      console.log(`  Warning: Target model "${config.target.model}" not found in pricing table, cost calculation unavailable`);
    }
    if (compressPricing) {
      console.log(`  Compress pricing: ${compressPricing.inputPricePerMTok} ${compressPricing.currency}/MTok (input) | ${compressPricing.outputPricePerMTok} ${compressPricing.currency}/MTok (output)`);
    } else {
      console.log(`  Warning: Compress model "${config.compress.model}" not found in pricing table`);
    }
    console.log('');
  });
}

main();
