/**
 * Parallel Execution Test for AIGateway
 * 
 * Tests that multiple AI calls can run simultaneously through the gateway.
 * Run with: npx tsx apps/server/test-parallel.mjs
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
console.log('║          AIGateway Parallel Execution Test                 ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Create gateway instance
const gateway = new AIGateway();
await gateway.init();
console.log('[Test] ✅ AIGateway initialized\n');

// Define 3 parallel tasks
const tasks = [
    { id: 'Task-1', prompt: 'What is 1+1? Reply with just the number.' },
    { id: 'Task-2', prompt: 'What is 2+2? Reply with just the number.' },
    { id: 'Task-3', prompt: 'What is 3+3? Reply with just the number.' },
];

console.log('[Test] Starting 3 parallel AI calls...\n');
const startTime = Date.now();

// Execute all tasks in parallel
const promises = tasks.map(async (task) => {
    console.log(`  [${task.id}] Started`);
    const taskStart = Date.now();

    try {
        const text = await gateway.executeText({
            prompt: task.prompt,
            model: 'GLM-4.7',
        });

        const elapsed = Date.now() - taskStart;
        const answer = text.match(/\d+/)?.[0] || text.trim().slice(-10);
        console.log(`  [${task.id}] Completed in ${elapsed}ms - Answer: ${answer}`);
        return { id: task.id, success: true, elapsed, answer };
    } catch (error) {
        console.log(`  [${task.id}] Failed: ${error.message}`);
        return { id: task.id, success: false, error: error.message };
    }
});

// Wait for all tasks to complete
const results = await Promise.all(promises);
const totalElapsed = Date.now() - startTime;

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║                    Results                                 ║');
console.log('╚════════════════════════════════════════════════════════════╝');

const passed = results.filter(r => r.success).length;
console.log(`\n  Tasks completed: ${passed}/${results.length}`);
console.log(`  Total time: ${totalElapsed}ms`);

// Calculate if parallel execution was faster than sequential
const avgTaskTime = results.reduce((sum, r) => sum + (r.elapsed || 0), 0) / results.length;
const sequentialTime = avgTaskTime * results.length;
const speedup = (sequentialTime / totalElapsed).toFixed(2);

console.log(`  Avg single task: ${Math.round(avgTaskTime)}ms`);
console.log(`  Estimated sequential: ${Math.round(sequentialTime)}ms`);
console.log(`  Speedup: ${speedup}x`);

if (passed === results.length && parseFloat(speedup) > 1.5) {
    console.log('\n  ✅ Parallel execution working correctly!');
} else if (passed === results.length) {
    console.log('\n  ⚠️ Tasks completed but minimal speedup (API rate limiting?)');
} else {
    console.log('\n  ❌ Some tasks failed');
}

process.exit(0);
