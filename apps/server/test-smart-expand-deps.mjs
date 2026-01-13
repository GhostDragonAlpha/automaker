/**
 * Test Smart Expand feature creation and dependency linking
 * Run with: npx tsx test-smart-expand-deps.mjs
 */

const BASE_URL = 'http://localhost:3021';
const PROJECT_PATH = 'C:\\Chimera';

async function testSmartExpand() {
    console.log('Testing Smart Expand feature creation with dependencies...\n');

    // Step 1: Get existing features
    console.log('1. Getting existing features...');
    const listRes = await fetch(`${BASE_URL}/api/features/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: PROJECT_PATH }),
    });
    const listData = await listRes.json();

    if (!listData.success) {
        console.error('Failed to list features:', listData.error);
        return;
    }

    console.log(`   Found ${listData.features?.length || 0} features`);

    // Pick a parent feature (first backlog feature)
    const parentFeature = listData.features?.find(f => f.status === 'backlog');
    if (!parentFeature) {
        console.log('   No backlog features found. Creating a test parent...');

        const createParentRes = await fetch(`${BASE_URL}/api/features/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectPath: PROJECT_PATH,
                feature: {
                    title: 'Test Parent Feature',
                    description: 'This is a test parent for Smart Expand testing',
                    category: 'Test',
                    status: 'backlog',
                    branchName: 'main',
                },
            }),
        });
        const parentData = await createParentRes.json();
        if (!parentData.success) {
            console.error('Failed to create parent:', parentData.error);
            return;
        }
        console.log(`   Created parent: ${parentData.feature.id}`);
        var testParentId = parentData.feature.id;
    } else {
        console.log(`   Using existing parent: ${parentFeature.id} - "${parentFeature.title}"`);
        var testParentId = parentFeature.id;
    }

    // Step 2: Create child features with dependencies (like SmartExpandDialog does)
    console.log('\n2. Creating child features with dependencies...');

    const childTasks = [
        { title: 'Child Task 1 - Backend', description: 'First subtask', priority: 2 },
        { title: 'Child Task 2 - Frontend', description: 'Second subtask', priority: 2 },
        { title: 'Child Task 3 - Tests', description: 'Third subtask', priority: 3 },
    ];

    let createdCount = 0;
    const createdIds = [];

    for (const task of childTasks) {
        const createRes = await fetch(`${BASE_URL}/api/features/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectPath: PROJECT_PATH,
                feature: {
                    title: task.title,
                    description: task.description,
                    category: 'Test',
                    priority: task.priority,
                    status: 'backlog',
                    dependencies: [testParentId],  // This is what SmartExpandDialog passes
                    branchName: 'main',
                },
            }),
        });

        const createData = await createRes.json();
        if (createData.success) {
            createdCount++;
            createdIds.push(createData.feature.id);
            console.log(`   ✓ Created: "${task.title}" (id: ${createData.feature.id})`);
            console.log(`     - dependencies: ${JSON.stringify(createData.feature.dependencies)}`);
        } else {
            console.log(`   ✗ Failed: "${task.title}" - ${createData.error}`);
        }
    }

    console.log(`\n   Created ${createdCount}/${childTasks.length} child features`);

    // Step 3: Verify dependencies were saved
    console.log('\n3. Verifying dependencies were saved...');

    const verifyRes = await fetch(`${BASE_URL}/api/features/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: PROJECT_PATH }),
    });
    const verifyData = await verifyRes.json();

    if (verifyData.success) {
        for (const childId of createdIds) {
            const child = verifyData.features?.find(f => f.id === childId);
            if (child) {
                const deps = child.dependencies || [];
                const hasDep = deps.includes(testParentId);
                console.log(`   ${hasDep ? '✓' : '✗'} "${child.title}" - dependencies: ${JSON.stringify(deps)}`);
            }
        }
    }

    // Step 4: Clean up test features
    console.log('\n4. Cleaning up test features...');

    for (const childId of createdIds) {
        await fetch(`${BASE_URL}/api/features/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectPath: PROJECT_PATH, featureId: childId }),
        });
    }

    // Delete parent if we created it
    if (testParentId && listData.features?.find(f => f.id === testParentId) === undefined) {
        await fetch(`${BASE_URL}/api/features/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectPath: PROJECT_PATH, featureId: testParentId }),
        });
    }

    console.log('   Done!\n');

    console.log('='.repeat(60));
    console.log('SUMMARY: If dependencies show correctly above, the backend is working.');
    console.log('If the graph doesn\'t update, the issue is in the frontend refresh mechanism.');
    console.log('='.repeat(60));
}

testSmartExpand().catch(console.error);
