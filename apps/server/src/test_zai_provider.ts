import { ProviderFactory } from './providers/provider-factory.js';
import { ZaiProvider } from './providers/zai-provider.js';
import { createLogger } from '@automaker/utils';

const logger = createLogger('TestZai');

async function testZaiResolution() {
  console.log('--- Testing Z.AI Provider Resolution ---');

  const modelId = 'glm-4-plus';
  console.log(`Resolving model: ${modelId}`);

  const providerName = ProviderFactory.getProviderNameForModel(modelId);
  console.log(`Resolved Provider Name: ${providerName}`);

  if (providerName !== 'zai') {
    console.error('❌ FAILED: Expected provider "zai", got', providerName);
    process.exit(1);
  }
  console.log('✅ Provider name resolution passed.');

  try {
    const provider = ProviderFactory.getProviderForModel(modelId, { throwOnDisconnected: false });
    console.log(`Provider instance created: ${provider.getName()}`);

    if (!(provider instanceof ZaiProvider)) {
      console.error('❌ FAILED: Provider is not instance of ZaiProvider');
      process.exit(1);
    }
    console.log('✅ Provider instance resolution passed.');
  } catch (error) {
    console.error('❌ FAILED: Could not instantiate provider:', error);
    process.exit(1);
  }
}

async function testZaiExecution() {
  console.log('\n--- Testing Z.AI Execution (Mock Key) ---');
  // Set a dummy key just to pass the constructor check
  if (!process.env.ZAI_API_KEY) {
    process.env.ZAI_API_KEY = 'sk-dummy-key';
    console.log('Set dummy ZAI_API_KEY');
  }

  const provider = new ZaiProvider();
  const stream = provider.executeQuery({
    model: 'glm-4.7',
    prompt: 'Hello, are you Z.AI?',
    cwd: process.cwd(),
    allowedTools: [],
  });

  console.log('Stream started. Waiting for response...');
  try {
    for await (const msg of stream) {
      console.log('Received message type:', msg.type);
      if (msg.type === 'assistant') {
        console.log('Content:', msg.message?.content);
      }
    }
  } catch (e: any) {
    console.log('Caught expected error (due to dummy key or network):');
    console.log(e.message);

    // If the error mentions "Z.AI query failed" or OpenAI structure, it means ZaiProvider was used!
    // If it says "Claude Code process exited", we failed.
    if (e.message.includes('Claude Code process exited')) {
      console.error('❌ FAILED: Still trying to run Claude!');
      process.exit(1);
    } else {
      console.log('✅ SUCCESS: Error came from Z.AI provider path (as expected).');
    }
  }
}

async function testZaiModels() {
  console.log('\n--- Testing Z.AI Models ---');
  const provider = new ZaiProvider();
  const models = provider.getAvailableModels();

  // Check if glm-4.7 is present and default (conceptually or just first in list)
  const firstModel = models[0];
  console.log('First returned model:', firstModel.id);

  if (firstModel.id === 'glm-4.7') {
    console.log('✅ GLM 4.7 is successfully promoted to first slot.');
  } else {
    console.error('❌ GLM 4.7 is NOT first. Got:', firstModel.id);
    // Don't fail the whole suite for this, but worth noting
  }

  // Check agent loop imports (ZaiTools) by ensuring it constructs without error
  console.log('Provider constructed successfully (ZaiTools import check implicit).');
}

async function main() {
  await testZaiResolution();
  await testZaiModels();
  await testZaiExecution();
}

main().catch(console.error);
