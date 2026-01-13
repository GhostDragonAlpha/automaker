/**
 * Test Universal Gateway (Vercel AI SDK)
 * 
 * Run: npx tsx apps/server/test-universal-gateway.mjs
 */

// Setup environment
process.env.APPDATA = process.env.APPDATA || 'C:\\Users\\allen\\AppData\\Roaming';

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║         Universal Gateway (Vercel AI SDK) Test            ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const { universalGateway } = await import('./src/services/universal-gateway.js');

// Initialize
console.log('[Test] Initializing...');
await universalGateway.init();

const providers = universalGateway.getAvailableProviders();
console.log(`[Test] Available providers: ${providers.join(', ')}\n`);

// Test Z.AI
if (providers.includes('zai')) {
    console.log('[Test 1] Testing Z.AI (GLM-4.7)...');
    const start = Date.now();

    try {
        const result = await universalGateway.generateText({
            prompt: 'What is 2+2? Reply with just the number.',
            model: 'glm-4.7',
        });

        console.log(`  Response: "${result.trim().slice(0, 50)}"`);
        console.log(`  Time: ${Date.now() - start}ms`);
        console.log('[Test 1] ✅ Z.AI works!\n');
    } catch (err) {
        console.log(`[Test 1] ❌ Z.AI failed: ${err.message}\n`);
    }
}

// Test Anthropic if available
if (providers.includes('anthropic')) {
    console.log('[Test 2] Testing Anthropic (Claude)...');
    const start = Date.now();

    try {
        const result = await universalGateway.generateText({
            prompt: 'What is 3+3? Reply with just the number.',
            model: 'claude-3-5-sonnet-20241022',
        });

        console.log(`  Response: "${result.trim().slice(0, 50)}"`);
        console.log(`  Time: ${Date.now() - start}ms`);
        console.log('[Test 2] ✅ Anthropic works!\n');
    } catch (err) {
        console.log(`[Test 2] ❌ Anthropic failed: ${err.message}\n`);
    }
}

// Test streaming
if (providers.includes('zai')) {
    console.log('[Test 3] Testing streaming (Z.AI)...');
    const start = Date.now();

    try {
        let fullText = '';
        for await (const chunk of universalGateway.streamText({
            prompt: 'Count from 1 to 5.',
            model: 'glm-4.7',
        })) {
            fullText += chunk;
            process.stdout.write('.');
        }

        console.log(`\n  Response: "${fullText.trim().slice(0, 80)}"`);
        console.log(`  Time: ${Date.now() - start}ms`);
        console.log('[Test 3] ✅ Streaming works!\n');
    } catch (err) {
        console.log(`\n[Test 3] ❌ Streaming failed: ${err.message}\n`);
    }
}

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║                    Tests Complete                         ║');
console.log('╚════════════════════════════════════════════════════════════╝');

process.exit(0);
