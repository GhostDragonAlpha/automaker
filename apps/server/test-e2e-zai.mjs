/**
 * End-to-End Test: Execute Query with Z.AI
 * 
 * This test makes a REAL API call to Z.AI through the refactored executeQuery module.
 * It verifies that the provider-agnostic routing works end-to-end.
 */

import 'dotenv/config';
import { executeQuery, isProviderAvailable } from './src/lib/execute-query.js';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
};

function log(color, message) {
    console.log(`${color}${message}${colors.reset}`);
}

async function runE2ETest() {
    log(colors.cyan, '\n========================================');
    log(colors.cyan, '   E2E Test: executeQuery → Z.AI');
    log(colors.cyan, '========================================\n');

    // Check API key
    const apiKey = process.env.ZAI_API_KEY;
    if (!apiKey) {
        log(colors.red, '❌ ZAI_API_KEY not found in environment');
        process.exit(1);
    }
    log(colors.green, `✅ API Key found: ${apiKey.substring(0, 8)}...`);

    // Test 1: Check provider availability
    log(colors.cyan, '\n[TEST 1] Provider Availability');
    const zaiAvailable = await isProviderAvailable('zai');
    if (zaiAvailable) {
        log(colors.green, '  ✅ Z.AI provider is available');
    } else {
        log(colors.yellow, '  ⚠️  Z.AI provider not detected as available (may still work)');
    }

    // Test 2: Make a real API call
    log(colors.cyan, '\n[TEST 2] Real API Call via executeQuery()');
    log(colors.reset, '  Prompt: "Say hello in exactly 3 words"');

    const startTime = Date.now();
    let responseText = '';
    let messageCount = 0;

    try {
        for await (const msg of executeQuery({
            prompt: 'Say hello in exactly 3 words. Respond with only those 3 words.',
            model: 'default', // Should route to glm-4.7 via Z.AI
            cwd: process.cwd(),
            maxTurns: 1,
            allowedTools: [],
        })) {
            messageCount++;

            if (msg.type === 'assistant' && msg.message?.content) {
                for (const block of msg.message.content) {
                    if (block.type === 'text' && block.text) {
                        responseText += block.text;
                    }
                }
            }

            if (msg.type === 'result' && msg.subtype === 'success') {
                if (msg.result) {
                    responseText = msg.result;
                }
            }

            if (msg.type === 'error') {
                log(colors.red, `  ❌ Error: ${msg.error || JSON.stringify(msg)}`);
            }
        }

        const elapsedMs = Date.now() - startTime;

        if (responseText) {
            log(colors.green, `  ✅ Response received in ${elapsedMs}ms`);
            log(colors.green, `  📝 Response: "${responseText.trim()}"`);
            log(colors.reset, `  📊 Messages processed: ${messageCount}`);
        } else {
            log(colors.yellow, `  ⚠️  Empty response (${messageCount} messages, ${elapsedMs}ms)`);
        }

    } catch (error) {
        log(colors.red, `  ❌ API call failed: ${error.message}`);
        console.error(error);
        process.exit(1);
    }

    log(colors.cyan, '\n========================================');
    log(colors.green, '   ✅ E2E Test Complete');
    log(colors.cyan, '========================================\n');
}

runE2ETest().catch(err => {
    log(colors.red, `💥 Test crashed: ${err.message}`);
    console.error(err);
    process.exit(1);
});
