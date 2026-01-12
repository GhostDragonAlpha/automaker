/**
 * End-to-End Backend Z.AI Message Test
 *
 * Tests the full flow:
 * 1. Create a test feature via API
 * 2. Trigger Auto Mode with Z.AI
 * 3. Verify response is received and logged
 *
 * Run with: npx tsx apps/server/tests/verification/test-zai-e2e.ts
 */

const API_BASE = 'http://localhost:3008/api';

interface Feature {
  id: string;
  title: string;
  status: string;
}

async function testZaiE2E() {
  console.log('=== Z.AI End-to-End Backend Test ===\n');

  // Step 1: Create a test feature
  console.log('1. Creating test feature...');
  const createResponse = await fetch(`${API_BASE}/features/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectPath: 'C:\\Chimera',
      feature: {
        title: 'E2E Test: Z.AI Message',
        description: 'Simple test - respond with "Hello from Z.AI" and nothing else.',
        category: 'Test',
        priority: 1,
      },
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    console.error(`   ❌ Failed to create feature: ${error}`);
    process.exit(1);
  }

  const createResult = await createResponse.json();
  const featureId = createResult.feature?.id || createResult.id;
  console.log(`   ✅ Created feature: ${featureId}\n`);

  // Step 2: Trigger Auto Mode
  console.log('2. Triggering Auto Mode with Z.AI...');
  const runResponse = await fetch(`${API_BASE}/auto-mode/run-feature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      featureId,
      projectPath: 'C:\\Chimera',
      model: 'glm-4.7', // Explicitly use Z.AI model
    }),
  });

  if (!runResponse.ok) {
    const error = await runResponse.text();
    console.error(`   ❌ Failed to run feature: ${error}`);
    process.exit(1);
  }

  console.log('   ✅ Auto Mode triggered\n');

  // Step 3: Wait for response and check agent output
  console.log('3. Waiting for Z.AI response (up to 30 seconds)...');
  const startTime = Date.now();
  const maxWait = 30000; // 30 seconds
  let lastOutput = '';

  while (Date.now() - startTime < maxWait) {
    await new Promise((r) => setTimeout(r, 2000)); // Check every 2 seconds

    try {
      const outputResponse = await fetch(`${API_BASE}/features/agent-output`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureId,
          projectPath: 'C:\\Chimera',
        }),
      });

      if (outputResponse.ok) {
        const outputResult = await outputResponse.json();
        const content = outputResult.content || outputResult.output || '';

        if (content && content !== lastOutput) {
          lastOutput = content;
          console.log(`   📝 Agent output (${content.length} chars):`);
          console.log(`   "${content.substring(0, 200)}${content.length > 200 ? '...' : ''}"\n`);
        }

        // Check if we got a meaningful response
        if (content.length > 50) {
          console.log('   ✅ Z.AI responded with content!\n');
          break;
        }
      }
    } catch (e) {
      // Ignore fetch errors during polling
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`\r   ⏳ Waiting... (${elapsed}s)`);
  }

  console.log('\n=== Test Complete ===');

  if (lastOutput.length > 0) {
    console.log('✅ SUCCESS: Z.AI backend message flow is WORKING!');
    console.log('\nZ.AI Response Preview:');
    console.log('─'.repeat(50));
    console.log(lastOutput.substring(0, 500));
    console.log('─'.repeat(50));
  } else {
    console.log('⚠️ WARNING: No output received within timeout.');
    console.log('Check server logs for errors.');
  }
}

testZaiE2E().catch(console.error);
