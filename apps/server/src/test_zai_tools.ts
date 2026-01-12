import { ZaiTools } from './providers/zai-tools.js';
import * as path from 'path';
import * as fs from 'fs';

async function testZaiTools() {
  console.log('--- Testing Z.AI Tools ---');

  // Create a temp dir for testing
  const testDir = path.resolve('./temp_zai_test');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }

  const tools = new ZaiTools(testDir);

  try {
    // 1. Test Bash
    console.log('Testing Bash...');
    const echo = await tools.executeTool('Bash', { command: 'echo "Hello Z.AI"' });
    if (echo.includes('Hello Z.AI')) {
      console.log('✅ Bash Echo passed');
    } else {
      console.error('❌ Bash Echo failed:', echo);
    }

    // 2. Test Write File
    console.log('Testing Write File...');
    const writeRes = await tools.executeTool('Write', {
      path: 'test.txt',
      content: 'Z.AI was here',
    });
    console.log(writeRes);

    // 3. Test Read File
    console.log('Testing Read File...');
    const readContent = await tools.executeTool('Read', { path: 'test.txt' });
    if (readContent === 'Z.AI was here') {
      console.log('✅ Read File passed');
    } else {
      console.error('❌ Read File failed:', readContent);
    }

    // 4. Test Edit File
    console.log('Testing Edit File...');
    const editRes = await tools.executeTool('Edit', {
      path: 'test.txt',
      old_string: 'Z.AI',
      new_string: 'Agent',
    });
    const readEdited = await tools.executeTool('Read', { path: 'test.txt' });
    if (readEdited === 'Agent was here') {
      console.log('✅ Edit File passed');
    } else {
      console.error('❌ Edit File failed:', readEdited);
    }

    // 5. Test List Dir
    console.log('Testing ListDir...');
    const list = await tools.executeTool('ListDir', { path: '.' });
    if (list.includes('test.txt')) {
      console.log('✅ ListDir passed');
    } else {
      console.error('❌ ListDir failed:', list);
    }

    // 6. Test Glob
    console.log('Testing Glob...');
    const globRes = await tools.executeTool('Glob', { pattern: '*.txt' });
    if (globRes.includes('test.txt')) {
      console.log('✅ Glob passed');
    } else {
      console.error('❌ Glob failed:', globRes);
    }

    // 7. Test Grep
    console.log('Testing Grep...');
    const grepRes = await tools.executeTool('Grep', { pattern: 'Agent', path: '.' });
    if (grepRes.includes('test.txt') && grepRes.includes('Agent was here')) {
      console.log('✅ Grep passed');
    } else {
      console.error('❌ Grep failed:', grepRes);
    }
  } catch (err) {
    console.error('Test failed with error:', err);
  } finally {
    // Cleanup
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

testZaiTools().catch(console.error);
