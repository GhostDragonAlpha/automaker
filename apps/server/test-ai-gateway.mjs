/**
 * Backend Test for AIGateway
 * 
 * Tests the AIGateway without requiring any UI interaction.
 * Run with: npx tsx apps/server/test-ai-gateway.mjs
 */

import { EventEmitter } from 'events';

// Set up environment
process.env.APPDATA = process.env.APPDATA || 'C:\\Users\\allen\\AppData\\Roaming';

// Register providers first
import { registerProvider } from './src/providers/provider-factory.js';
import { ZaiProvider } from './src/providers/zai-provider.js';

registerProvider('zai', {
    factory: () => new ZaiProvider(),
    aliases: ['zhipu', 'glm'],
    canHandleModel: (model) => {
        const lower = model.toLowerCase();
        return lower.includes('glm') || lower.includes('zai-') || lower.startsWith('zai:');
    },
    priority: 20,
});

// Now import and test AIGateway
const { AIGateway } = await import('./src/services/ai-gateway.js');

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║              AIGateway Backend Test                        ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Create gateway instance
const gateway = new AIGateway();

console.log('[Test] Initializing AIGateway...');
await gateway.init();
console.log('[Test] ✅ AIGateway initialized\n');

// Test 1: Check credential loading
console.log('[Test 1] Checking credential info...');
const zaiCred = gateway.getCredentialInfo('zai');
console.log(`  Z.AI: configured=${zaiCred.configured}, source=${zaiCred.source}, masked=${zaiCred.masked}`);
if (!zaiCred.configured) {
    console.log('[Test 1] ❌ Z.AI credentials not found');
    process.exit(1);
}
console.log('[Test 1] ✅ Credentials loaded correctly\n');

// Test 2: Execute a simple query
console.log('[Test 2] Testing aiGateway.execute() with Z.AI...');
const startTime = Date.now();

try {
    let responseText = '';
    let messageCount = 0;

    for await (const msg of gateway.execute({
        prompt: 'Say "Hello from AIGateway" and nothing else.',
        model: 'GLM-4.7',
        cwd: process.cwd(),
        maxTurns: 1,
    })) {
        messageCount++;
        if (msg.type === 'assistant' && msg.message?.content) {
            for (const block of msg.message.content) {
                if (block.type === 'text' && block.text) {
                    responseText += block.text;
                }
            }
        } else if (msg.type === 'result' && msg.subtype === 'success' && msg.result) {
            responseText = msg.result;
        }
    }

    const elapsed = Date.now() - startTime;
    console.log(`  Response: "${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}"`);
    console.log(`  Messages: ${messageCount}`);
    console.log(`  Time: ${elapsed}ms`);

    if (responseText.toLowerCase().includes('hello')) {
        console.log('[Test 2] ✅ Query executed successfully\n');
    } else {
        console.log('[Test 2] ⚠️ Response may not be as expected\n');
    }
} catch (error) {
    console.log(`[Test 2] ❌ Query failed: ${error.message}`);
    process.exit(1);
}

// Test 3: Test executeText convenience method
console.log('[Test 3] Testing aiGateway.executeText()...');
try {
    const text = await gateway.executeText({
        prompt: 'What is 2+2? Reply with just the number.',
        model: 'GLM-4.7',
    });

    console.log(`  Response: "${text.trim()}"`);
    if (text.includes('4')) {
        console.log('[Test 3] ✅ executeText works correctly\n');
    } else {
        console.log('[Test 3] ⚠️ Response may not be as expected\n');
    }
} catch (error) {
    console.log(`[Test 3] ❌ executeText failed: ${error.message}`);
}

// Test 4: Test provider availability check
console.log('[Test 4] Testing provider availability...');
const isZaiAvailable = await gateway.isProviderAvailable('zai');
console.log(`  Z.AI available: ${isZaiAvailable}`);
console.log('[Test 4] ✅ Provider check completed\n');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║              All Tests Completed!                          ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

process.exit(0);
