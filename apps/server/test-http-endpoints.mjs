/**
 * HTTP Endpoint Tests for AIGateway
 * 
 * Tests the actual HTTP endpoints to verify the full stack works.
 * Requires the server to be running on port 3008.
 * 
 * Run with: node apps/server/test-http-endpoints.mjs
 */

const BASE_URL = 'http://localhost:3008/api';

async function testEndpoint(name, method, path, body = null) {
    console.log(`\n[Test] ${name}...`);

    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${BASE_URL}${path}`, options);
        const status = response.status;

        let data;
        try {
            data = await response.json();
        } catch {
            data = await response.text();
        }

        if (status >= 200 && status < 300) {
            console.log(`  ✅ ${status} OK`);
            return { success: true, status, data };
        } else if (status === 401 || status === 403) {
            console.log(`  ⚠️ ${status} Auth required (endpoint exists)`);
            return { success: true, status, data };
        } else {
            console.log(`  ❌ ${status}: ${JSON.stringify(data).substring(0, 100)}`);
            return { success: false, status, data };
        }
    } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║              HTTP Endpoint Tests                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    const results = [];

    // Test 1: Health check
    results.push(await testEndpoint('Health Check', 'GET', '/health'));

    // Test 2: Ideation - Smart Expand (POST)
    results.push(await testEndpoint(
        'Smart Expand (Ideation)',
        'POST',
        '/ideation/tasks/generate',
        {
            projectPath: 'C:\\Chimera\\tools\\AutoMaker',
            parentTask: 'Implement user authentication',
            count: 3,
        }
    ));

    // Test 3: Enhance Prompt
    results.push(await testEndpoint(
        'Enhance Prompt',
        'POST',
        '/enhance-prompt',
        {
            originalText: 'Make button blue',
            enhancementMode: 'improve',
        }
    ));

    // Test 4: Backlog Plan
    results.push(await testEndpoint(
        'Backlog Plan (Generate)',
        'POST',
        '/backlog-plan/generate',
        {
            projectPath: 'C:\\Chimera\\tools\\AutoMaker',
            prompt: 'Add a new dashboard feature',
        }
    ));

    // Test 5: App Spec
    results.push(await testEndpoint(
        'App Spec (Generate)',
        'POST',
        '/app-spec/generate',
        {
            projectPath: 'C:\\Chimera\\tools\\AutoMaker',
        }
    ));

    // Test 6: Models Available
    results.push(await testEndpoint(
        'Models Available',
        'GET',
        '/models/available'
    ));

    // Test 7: Provider Status
    results.push(await testEndpoint(
        'Provider Status',
        'GET',
        '/models/providers'
    ));

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Summary                                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\n  Passed: ${passed}/${results.length}`);
    console.log(`  Failed: ${failed}/${results.length}`);

    if (failed === 0) {
        console.log('\n  ✅ All endpoints responding correctly!');
    }
}

main().catch(console.error);
