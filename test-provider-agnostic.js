/**
 * Provider-Agnostic Backend Test
 *
 * Tests all refactored functionality to ensure the executeQuery routing works correctly.
 * Run with: node --experimental-specifier-resolution=node test-provider-agnostic.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3020';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3020,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testEndpoint(name, method, path, body = null, expectSuccess = true) {
  try {
    log(colors.cyan, `\n[TEST] ${name}`);
    const { status, data } = await makeRequest(method, path, body);

    const isSuccess = expectSuccess ? status >= 200 && status < 300 : status >= 400;

    if (isSuccess) {
      log(colors.green, `  ✅ PASS (${status})`);
      if (data?.success !== undefined) {
        log(colors.reset, `     success: ${data.success}`);
      }
      return { pass: true, name, status, data };
    } else {
      log(colors.red, `  ❌ FAIL (${status})`);
      log(colors.reset, `     ${JSON.stringify(data).substring(0, 200)}`);
      return { pass: false, name, status, data };
    }
  } catch (error) {
    log(colors.red, `  ❌ ERROR: ${error.message}`);
    return { pass: false, name, error: error.message };
  }
}

async function runTests() {
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '  Provider-Agnostic Backend Test Suite');
  log(colors.cyan, '========================================\n');

  const results = [];

  // 1. Basic health check
  results.push(await testEndpoint('Server Health Check', 'GET', '/api/health'));

  // 2. Provider status check
  results.push(await testEndpoint('Provider Status', 'GET', '/api/models/providers'));

  // 3. Available models check
  results.push(await testEndpoint('Available Models', 'GET', '/api/models'));

  // 4. Settings check
  results.push(await testEndpoint('Global Settings', 'GET', '/api/settings'));

  // 5. Auth verification (uses executeQuery)
  results.push(
    await testEndpoint(
      'Auth Verification (executeQuery)',
      'POST',
      '/api/setup/verify-claude-auth',
      { authMethod: 'api_key' }
    )
  );

  // 6. Features list (basic CRUD test)
  results.push(
    await testEndpoint(
      'Features List',
      'GET',
      '/api/features?projectPath=' + encodeURIComponent('C:\\Chimera\\tools\\AutoMaker')
    )
  );

  // 7. Auto-mode status
  results.push(await testEndpoint('Auto-Mode Status', 'GET', '/api/auto-mode/status'));

  // 8. Ideation session (uses executeQuery via ideation service)
  results.push(
    await testEndpoint('Ideation API Reachability', 'POST', '/api/ideation/session', {
      projectPath: 'C:\\Chimera\\tools\\AutoMaker',
      feature: {
        id: 'test-feature',
        title: 'Test Feature',
        description: 'Test description',
        status: 'todo',
      },
    })
  );

  // Summary
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '              TEST RESULTS');
  log(colors.cyan, '========================================');

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  log(colors.green, `  Passed: ${passed}`);
  log(colors.red, `  Failed: ${failed}`);
  log(colors.cyan, `  Total:  ${results.length}`);

  // Show failed tests
  if (failed > 0) {
    log(colors.yellow, '\nFailed Tests:');
    results
      .filter((r) => !r.pass)
      .forEach((r) => {
        log(colors.red, `  - ${r.name}: ${r.error || r.status}`);
      });
  }

  log(colors.cyan, '\n========================================\n');

  return { passed, failed, total: results.length };
}

// Run tests
runTests()
  .then(({ passed, failed }) => {
    if (failed === 0) {
      log(colors.green, '🎉 All tests passed!');
      process.exit(0);
    } else {
      log(colors.yellow, `⚠️  ${failed} test(s) failed`);
      process.exit(1);
    }
  })
  .catch((err) => {
    log(colors.red, `💥 Test suite crashed: ${err.message}`);
    process.exit(1);
  });
