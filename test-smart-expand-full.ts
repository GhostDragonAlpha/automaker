/**
 * Comprehensive Backend Test for Smart Expand Feature
 * Tests the entire flow: generateSubtasks -> create features -> verify dependencies
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3008';
const PROJECT_PATH = 'C:\\Chimera';
const API_KEY = '31efe178-15ef-45b9-a7e8-98bef9d2e9b7';

interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  suggestions?: T[];
  features?: T[];
}

interface AnalysisSuggestion {
  id: string;
  title: string;
  description: string;
  priority?: number;
}

interface Feature {
  id: string;
  title: string;
  description: string;
  status: string;
  category?: string;
  dependencies?: string[];
}

async function apiPost<T>(endpoint: string, body: any): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<T>;
}

// ============================================================
// TEST 1: Generate Subtasks API
// ============================================================
async function testGenerateSubtasks(): Promise<AnalysisSuggestion[]> {
  console.log('\n🧪 TEST 1: Generate Subtasks API');
  console.log('─'.repeat(50));

  const result = await apiPost<ApiResponse<AnalysisSuggestion>>('/api/ideation/tasks/generate', {
    projectPath: PROJECT_PATH,
    parentTask: 'Build a user authentication system with login, registration, and password reset',
    count: 5,
    context: {
      domainContext: 'Web Application Backend',
      focusArea: 'Security and UX',
    },
  });

  if (!result.success) {
    console.log('❌ FAILED:', result.error);
    return [];
  }

  console.log('✅ SUCCESS: Generated', result.suggestions?.length, 'subtasks');
  result.suggestions?.forEach((s, i) => {
    console.log(`   ${i + 1}. [${s.title}] - ${s.description?.substring(0, 60)}...`);
  });

  return result.suggestions || [];
}

// ============================================================
// TEST 2: List Features (to get a parent feature ID)
// ============================================================
async function testListFeatures(): Promise<Feature | null> {
  console.log('\n🧪 TEST 2: List Features API');
  console.log('─'.repeat(50));

  const result = await apiPost<ApiResponse<Feature>>('/api/features/list', {
    projectPath: PROJECT_PATH,
  });

  if (!result.success) {
    console.log('❌ FAILED:', result.error);
    return null;
  }

  const features = result.features || [];
  console.log('✅ SUCCESS: Found', features.length, 'features');

  // Find a backlog feature to use as parent
  const backlogFeature = features.find((f: Feature) => f.status === 'backlog');
  if (backlogFeature) {
    console.log('   Selected parent:', backlogFeature.title, `(${backlogFeature.id})`);
  } else {
    console.log('   ⚠️ No backlog features found to use as parent');
  }

  return backlogFeature || null;
}

// ============================================================
// TEST 3: Create Feature with Dependency
// ============================================================
async function testCreateFeatureWithDependency(parentId: string): Promise<string | null> {
  console.log('\n🧪 TEST 3: Create Feature with Dependency');
  console.log('─'.repeat(50));

  const testFeature = {
    title: `[TEST] Subtask ${Date.now()}`,
    description: 'This is a test subtask created by the backend verification script.',
    category: 'Testing',
    priority: 3,
    status: 'backlog',
    dependencies: [parentId],
  };

  console.log('   Creating feature with dependency on:', parentId);

  const result = await apiPost<ApiResponse & { feature?: Feature }>('/api/features/create', {
    projectPath: PROJECT_PATH,
    feature: testFeature,
  });

  if (!result.success) {
    console.log('❌ FAILED:', result.error);
    return null;
  }

  const createdId = result.feature?.id;
  console.log('✅ SUCCESS: Created feature', createdId);
  console.log('   Title:', testFeature.title);
  console.log('   Dependencies:', testFeature.dependencies);

  return createdId || null;
}

// ============================================================
// TEST 4: Verify Feature Has Dependency
// ============================================================
async function testVerifyDependency(
  featureId: string,
  expectedDependency: string
): Promise<boolean> {
  console.log('\n🧪 TEST 4: Verify Dependency Link');
  console.log('─'.repeat(50));

  const result = await apiPost<ApiResponse & { feature?: Feature }>('/api/features/get', {
    projectPath: PROJECT_PATH,
    featureId,
  });

  if (!result.success || !result.feature) {
    console.log('❌ FAILED: Could not fetch feature', result.error);
    return false;
  }

  const deps = result.feature.dependencies || [];
  const hasDependency = deps.includes(expectedDependency);

  if (hasDependency) {
    console.log('✅ SUCCESS: Feature has correct dependency');
    console.log('   Feature ID:', featureId);
    console.log('   Dependencies:', deps);
  } else {
    console.log('❌ FAILED: Dependency not found');
    console.log('   Expected:', expectedDependency);
    console.log('   Actual:', deps);
  }

  return hasDependency;
}

// ============================================================
// TEST 5: Clean up test feature
// ============================================================
async function testCleanup(featureId: string): Promise<void> {
  console.log('\n🧪 TEST 5: Cleanup (Delete Test Feature)');
  console.log('─'.repeat(50));

  const result = await apiPost<ApiResponse>('/api/features/delete', {
    projectPath: PROJECT_PATH,
    featureId,
  });

  if (result.success) {
    console.log('✅ SUCCESS: Deleted test feature', featureId);
  } else {
    console.log('⚠️ CLEANUP FAILED:', result.error);
  }
}

// ============================================================
// MAIN TEST RUNNER
// ============================================================
async function runTests() {
  console.log('\n' + '═'.repeat(60));
  console.log('  SMART EXPAND BACKEND VERIFICATION');
  console.log('  ' + new Date().toISOString());
  console.log('═'.repeat(60));

  let passed = 0;
  let failed = 0;

  try {
    // Test 1: Generate subtasks
    const suggestions = await testGenerateSubtasks();
    if (suggestions.length > 0) passed++;
    else failed++;

    // Test 2: List features to find a parent
    const parentFeature = await testListFeatures();
    if (parentFeature) passed++;
    else failed++;

    if (parentFeature) {
      // Test 3: Create feature with dependency
      const createdId = await testCreateFeatureWithDependency(parentFeature.id);
      if (createdId) {
        passed++;

        // Test 4: Verify dependency
        const verified = await testVerifyDependency(createdId, parentFeature.id);
        if (verified) passed++;
        else failed++;

        // Test 5: Cleanup
        await testCleanup(createdId);
        passed++;
      } else {
        failed += 2; // Skip tests 4 and 5
      }
    } else {
      console.log('\n⚠️ Skipping Tests 3-5: No parent feature available');
      failed += 3;
    }
  } catch (error) {
    console.log('\n❌ CRITICAL ERROR:', error);
    failed++;
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('  TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log('═'.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
