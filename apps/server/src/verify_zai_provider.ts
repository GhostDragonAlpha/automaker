import { config } from 'dotenv';
config({ path: 'c:/Chimera/tools/AutoMaker/.env', override: true });
import { ZaiProvider } from './providers/zai-provider.js';
import * as path from 'path';

// ...

async function main() {
  console.log('--- Verifying Z.AI Provider (Live) ---');
  console.log('API Key available:', !!process.env.ZAI_API_KEY);
  console.log(
    'API Key start:',
    process.env.ZAI_API_KEY ? process.env.ZAI_API_KEY.substring(0, 5) : 'None'
  );

  const provider = new ZaiProvider();

  // Setup test cwd
  const testCwd = path.resolve('./temp_zai_verify_live');
  const fs = await import('fs');
  if (!fs.existsSync(testCwd)) {
    fs.mkdirSync(testCwd);
  }

  // Cleanup previous file if exists
  const targetFile = path.join(testCwd, 'live_test_file.txt');
  if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);

  // Mock stream definitions (unused in live mode)
  const mockStream = (async function* () {})();

  const mockClient = {
    chat: {
      completions: {
        create: async (params: any) => {
          return mockStream;
        },
      },
    },
  };

  // Inject mock client - DISABLED FOR LIVE TEST
  // (provider as any).client = mockClient;

  const options = {
    prompt: 'Create a file named live_test_file.txt with content "Live Success".',
    model: 'GLM-4.7',
    allowedTools: ['Write'],
    cwd: testCwd,
    conversationHistory: [],
  };

  console.log('Executing provider loop...');
  try {
    const stream = provider.executeQuery(options as any);

    for await (const chunk of stream) {
      if (chunk.type === 'assistant') {
        const msg = chunk.message;
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          msg.content.forEach((c) => {
            if (c.type === 'text') console.log('UI Text:', c.text);
            if (c.type === 'tool_use') console.log('UI Tool Use:', c.name, c.input);
          });
        }
      } else if (chunk.type === 'result') {
        console.log('UI Final Result:', chunk.result);
      } else if (chunk.type === 'error') {
        console.error('UI Error:', chunk.error);
      }
    }

    // Verify file on disk
    if (fs.existsSync(targetFile)) {
      const content = fs.readFileSync(targetFile, 'utf-8');
      console.log('✅ File check: Found with content:', content);
      if (content.includes('Live Success')) {
        console.log('✅ LIVE VERIFICATION PASSED');
      } else {
        console.log('⚠️ File content differs from expected but file exists.');
      }
    } else {
      console.error('❌ File check: File NOT found.');
    }
  } catch (e) {
    console.error('Test Failed:', e);
  }
}

main();
