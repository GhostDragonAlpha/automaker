/**
 * Simple verification that the executeQuery module loads and resolves correctly.
 * Tests the provider routing without making actual API calls.
 */

import { ProviderFactory } from './src/providers/provider-factory.js';
import { resolveModelString } from '@automaker/model-resolver';

console.log('========================================');
console.log('  Execute Query Module Verification');
console.log('========================================\n');

// Test 1: Model resolution
console.log('[TEST 1] Model Resolution');
try {
    const resolved = resolveModelString('default');
    console.log(`  ✅ "default" resolves to: ${resolved}`);
} catch (e) {
    console.log(`  ❌ Failed: ${e.message}`);
}

// Test 2: Provider routing
console.log('\n[TEST 2] Provider Routing');
try {
    const providerName = ProviderFactory.getProviderForModelName('glm-4.5-flash');
    console.log(`  ✅ "glm-4.5-flash" routes to provider: ${providerName}`);
} catch (e) {
    console.log(`  ❌ Failed: ${e.message}`);
}

// Test 3: Provider instance retrieval
console.log('\n[TEST 3] Provider Instance Retrieval');
try {
    const registeredProviders = ProviderFactory.getRegisteredProviderNames();
    console.log(`  ✅ Registered providers: ${registeredProviders.join(', ')}`);

    for (const name of registeredProviders) {
        const provider = ProviderFactory.getProviderByName(name);
        if (provider) {
            console.log(`     - ${name}: ${provider.getName()}`);
        }
    }
} catch (e) {
    console.log(`  ❌ Failed: ${e.message}`);
}

// Test 4: Import the execute-query module
console.log('\n[TEST 4] Execute Query Module Import');
try {
    const { executeQuery, executeTextQuery, isProviderAvailable } = await import('./src/lib/execute-query.js');
    console.log(`  ✅ executeQuery: ${typeof executeQuery}`);
    console.log(`  ✅ executeTextQuery: ${typeof executeTextQuery}`);
    console.log(`  ✅ isProviderAvailable: ${typeof isProviderAvailable}`);
} catch (e) {
    console.log(`  ❌ Failed: ${e.message}`);
}

console.log('\n========================================');
console.log('  Verification Complete');
console.log('========================================\n');
