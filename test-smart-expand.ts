// test-smart-expand.ts
import fetch from 'node-fetch'; // Standard fetch might be available in Node 18+, but using robust import

const API_URL = 'http://localhost:3000/api/ideation/tasks/generate';
const PROJECT_PATH = 'C:\\Chimera\\tools\\AutoMaker'; // Self-hosting test

async function testSmartExpand() {
  console.log('Testing Smart Expand API...');
  console.log(`Target: ${API_URL}`);

  const payload = {
    projectPath: PROJECT_PATH,
    parentTask: 'Build a Secure Login System',
    count: 3,
    context: {
      domainContext: 'Web Application Security',
      focusArea: 'Authentication & Authorization',
      externalContext: 'Must support MFA and OAuth2 providers (Google, GitHub).',
      subspecTemplate: 'Tasks must include "Security Audit" tag.',
    },
  };

  try {
    const start = Date.now();
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const duration = Date.now() - start;
    console.log(`Response received in ${duration}ms. Status: ${response.status}`);

    const data = await response.json();

    if (data.success) {
      console.log('✅ SUCCESS: Generated Subtasks:');
      data.suggestions.forEach((task: any, index: number) => {
        console.log(`\n[${index + 1}] ${task.title} (${task.priority})`);
        console.log(`    ${task.description}`);
      });
    } else {
      console.error('❌ FAILURE:', data.error);
    }
  } catch (error) {
    console.error('❌ NETWORK ERROR:', error);
  }
}

testSmartExpand();
