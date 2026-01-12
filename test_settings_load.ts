import path from 'path';
import { SettingsService } from './apps/server/src/services/settings-service.ts';

// Mock path for compilation if needed or just use ts-node
// We'll use a simple script that mimics the server startup logic

const DATA_DIR = path.resolve('./apps/server/data');
console.log(`Using DATA_DIR: ${DATA_DIR}`);

async function testSettingsLoad(filename: string) {
  console.log(`\n--- Testing ${filename} ---`);
  const service = new SettingsService(DATA_DIR, filename);
  const settings = await service.getGlobalSettings();

  console.log(`Loaded settings from: ${filename}`);
  console.log(`Enhancement Model: ${JSON.stringify(settings.phaseModels?.enhancementModel)}`);
  console.log(`Legacy Validation Model: ${settings.validationModel}`);
  console.log(`Z.AI Default: ${settings.zaiDefaultModel}`);

  if (filename.includes('zai') && settings.zaiDefaultModel === 'GLM-4.7') {
    console.log('SUCCESS: Z.AI settings loaded correct default.');
  } else if (filename.includes('claude') && settings.enhancementModel === 'sonnet') {
    console.log('SUCCESS: Claude settings loaded correct default.');
  } else {
    console.log('WARNING: Unexpected values loaded.');
  }
}

async function run() {
  await testSettingsLoad('settings.zai.json');
  await testSettingsLoad('settings.claude.json');
}

run().catch(console.error);
