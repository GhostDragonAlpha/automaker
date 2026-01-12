/**
 * Diagnostic Test: ZaiTools Write Persistence
 *
 * Tests whether ZaiTools.executeWriteFile correctly writes to disk.
 * Run with: npx tsx apps/server/src/diagnostics/test-write-persistence.ts
 */

import path from 'path';
import fs from 'fs/promises';
import { ZaiTools } from '../providers/zai-tools.js';

async function testWritePersistence() {
  const testDir = process.cwd();
  const testFilePath = path.join(testDir, 'test-write-persistence-output.txt');
  const testContent = `Test file created at ${new Date().toISOString()}\nIf you see this, ZaiTools.Write is working correctly.`;

  console.log('=== ZaiTools Write Persistence Test ===\n');
  console.log(`Working directory: ${testDir}`);
  console.log(`Test file path: ${testFilePath}\n`);

  const zaiTools = new ZaiTools(testDir);

  // Test 1: Write via executeTool
  console.log('1. Testing executeTool("Write", {...})...');
  const result = await zaiTools.executeTool('Write', {
    path: testFilePath,
    content: testContent,
  });
  console.log(`   Result: ${result}`);

  // Test 2: Verify file exists
  console.log('\n2. Verifying file exists on disk...');
  try {
    const stat = await fs.stat(testFilePath);
    console.log(`   ✅ File exists! Size: ${stat.size} bytes`);
  } catch (error) {
    console.log(`   ❌ File does NOT exist: ${(error as Error).message}`);
    console.log('   This confirms the Write tool is BROKEN.');
    process.exit(1);
  }

  // Test 3: Read content back
  console.log('\n3. Reading content back...');
  try {
    const readContent = await fs.readFile(testFilePath, 'utf-8');
    if (readContent === testContent) {
      console.log('   ✅ Content matches exactly!');
    } else {
      console.log('   ⚠️ Content differs:');
      console.log(`   Expected: ${testContent.substring(0, 50)}...`);
      console.log(`   Got: ${readContent.substring(0, 50)}...`);
    }
  } catch (error) {
    console.log(`   ❌ Failed to read: ${(error as Error).message}`);
  }

  // Cleanup
  console.log('\n4. Cleaning up test file...');
  try {
    await fs.unlink(testFilePath);
    console.log('   ✅ Test file removed.');
  } catch {
    console.log('   ⚠️ Could not remove test file (non-critical).');
  }

  console.log('\n=== Test Complete ===');
  console.log('If you see ✅ for steps 1-3, ZaiTools.Write is working correctly.');
  console.log('The issue must be in how auto-mode-service invokes it during feature execution.\n');
}

testWritePersistence().catch(console.error);
