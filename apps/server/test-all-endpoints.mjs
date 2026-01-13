/**
 * Comprehensive API Endpoint Test
 * 
 * Tests all major API endpoints in the AutoMaker server.
 * Run with: $env:ZAI_API_KEY='YOUR_KEY'; npx tsx test-all-endpoints.mjs
 */

import 'dotenv/config';

const PORT = 3008; // API server port
const BASE_URL = `http://localhost:${PORT}`;
const PROJECT_PATH = 'C:\\Chimera\\tools\\AutoMaker';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    dim: '\x1b[2m',
};

function log(color, message) {
    console.log(`${color}${message}${colors.reset}`);
}

async function testEndpoint(name, method, path, body = null, expectStatus = [200, 201]) {
    const url = `${BASE_URL}${path}`;

    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(url, options);
        const isExpected = Array.isArray(expectStatus)
            ? expectStatus.includes(response.status)
            : response.status === expectStatus;

        if (isExpected) {
            log(colors.green, `  ✅ ${method} ${path} → ${response.status}`);
            return { pass: true, status: response.status };
        } else {
            log(colors.red, `  ❌ ${method} ${path} → ${response.status} (expected ${expectStatus})`);
            return { pass: false, status: response.status };
        }
    } catch (error) {
        log(colors.red, `  ❌ ${method} ${path} → ERROR: ${error.message}`);
        return { pass: false, error: error.message };
    }
}

async function runFullEndpointTest() {
    log(colors.cyan, '\n========================================');
    log(colors.cyan, '   Comprehensive API Endpoint Test');
    log(colors.cyan, `   Server: ${BASE_URL}`);
    log(colors.cyan, '========================================\n');

    const results = [];

    // ============ HEALTH ============
    log(colors.cyan, '[HEALTH]');
    results.push(await testEndpoint('Health', 'GET', '/api/health'));

    // ============ MODELS ============
    log(colors.cyan, '\n[MODELS]');
    results.push(await testEndpoint('Provider Status', 'GET', '/api/models/providers', null, [200, 401]));
    results.push(await testEndpoint('Available Models', 'GET', '/api/models', null, [200, 401]));
    results.push(await testEndpoint('Default Model', 'GET', '/api/models/default', null, [200, 401]));

    // ============ SETTINGS ============
    log(colors.cyan, '\n[SETTINGS]');
    results.push(await testEndpoint('Get Settings', 'GET', '/api/settings', null, [200, 401]));

    // ============ SETUP ============
    log(colors.cyan, '\n[SETUP]');
    results.push(await testEndpoint('Verify Auth', 'POST', '/api/setup/verify-claude-auth',
        { authMethod: 'api_key' }, [200, 400, 401]));
    results.push(await testEndpoint('GH Status', 'GET', '/api/setup/gh-status', null, [200, 401]));

    // ============ FEATURES ============
    log(colors.cyan, '\n[FEATURES]');
    results.push(await testEndpoint('List Features', 'GET',
        `/api/features?projectPath=${encodeURIComponent(PROJECT_PATH)}`, null, [200, 401]));

    // ============ AUTO-MODE ============
    log(colors.cyan, '\n[AUTO-MODE]');
    results.push(await testEndpoint('Auto-Mode Status', 'GET', '/api/auto-mode/status', null, [200, 401]));

    // ============ IDEATION ============
    log(colors.cyan, '\n[IDEATION]');
    results.push(await testEndpoint('Ideation Session', 'POST', '/api/ideation/session', {
        projectPath: PROJECT_PATH,
        feature: { id: 'test', title: 'Test', description: 'Test', status: 'todo' }
    }, [200, 400, 401, 500]));

    // ============ SESSIONS ============
    log(colors.cyan, '\n[SESSIONS]');
    results.push(await testEndpoint('List Sessions', 'GET', `/api/sessions?projectPath=${encodeURIComponent(PROJECT_PATH)}`, null, [200, 401]));

    // ============ FS ============
    log(colors.cyan, '\n[FILESYSTEM]');
    results.push(await testEndpoint('Read Dir', 'POST', '/api/fs/readdir',
        { path: PROJECT_PATH }, [200, 400, 401]));

    // ============ GIT ============
    log(colors.cyan, '\n[GIT]');
    results.push(await testEndpoint('Git Status', 'GET',
        `/api/git/status?projectPath=${encodeURIComponent(PROJECT_PATH)}`, null, [200, 401]));

    // ============ GITHUB ============
    log(colors.cyan, '\n[GITHUB]');
    results.push(await testEndpoint('GH Auth Check', 'GET', '/api/github/auth-check', null, [200, 401]));

    // ============ TEMPLATES ============
    log(colors.cyan, '\n[TEMPLATES]');
    results.push(await testEndpoint('List Templates', 'GET', '/api/templates', null, [200, 401]));

    // ============ MCP ============
    log(colors.cyan, '\n[MCP]');
    results.push(await testEndpoint('MCP Servers', 'GET', '/api/mcp/servers', null, [200, 401]));

    // ============ RUNNING AGENTS ============
    log(colors.cyan, '\n[RUNNING AGENTS]');
    results.push(await testEndpoint('Running Agents', 'GET', '/api/running-agents', null, [200, 401]));

    // ============ CONTEXT ============
    log(colors.cyan, '\n[CONTEXT]');
    results.push(await testEndpoint('Context Estimate', 'POST', '/api/context/estimate-tokens',
        { projectPath: PROJECT_PATH, text: 'test' }, [200, 400, 401]));

    // ============ APP-SPEC ============
    log(colors.cyan, '\n[APP-SPEC]');
    results.push(await testEndpoint('App Spec Status', 'GET',
        `/api/app-spec/status?projectPath=${encodeURIComponent(PROJECT_PATH)}`, null, [200, 401]));

    // ============ SUMMARY ============
    log(colors.cyan, '\n========================================');
    log(colors.cyan, '              RESULTS');
    log(colors.cyan, '========================================');

    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;

    log(colors.green, `  ✅ Passed: ${passed}`);
    if (failed > 0) log(colors.red, `  ❌ Failed: ${failed}`);
    log(colors.cyan, `  📊 Total:  ${results.length}`);

    const passRate = ((passed / results.length) * 100).toFixed(1);
    log(colors.cyan, `  📈 Pass Rate: ${passRate}%`);

    log(colors.cyan, '\n========================================\n');

    return { passed, failed, total: results.length };
}

runFullEndpointTest().catch(err => {
    log(colors.red, `💥 Test crashed: ${err.message}`);
    process.exit(1);
});
