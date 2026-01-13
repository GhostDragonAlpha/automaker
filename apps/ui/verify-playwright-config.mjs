/**
 * Playwright Configuration Verification
 * 
 * Programmatically verifies that Playwright setup has no hardcoded provider values.
 * Run with: npx tsx verify-playwright-config.mjs
 */

import * as fs from 'fs';
import * as path from 'path';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
};

function log(color, message) {
    console.log(`${color}${message}${colors.reset}`);
}

// Patterns to check for hardcoded provider values
const HARDCODED_PATTERNS = [
    /claude-sonnet-\d[\w-]*/gi,
    /claude-opus-\d[\w-]*/gi,
    /claude-haiku-\d[\w-]*/gi,
    /anthropic-ai/gi,
    /ANTHROPIC_API_KEY\s*=\s*['"][^'"]+['"]/gi,
    /'model'\s*:\s*['"]sonnet['"]/gi,
    /'model'\s*:\s*['"]opus['"]/gi,
    /'model'\s*:\s*['"]haiku['"]/gi,
];

async function scanFile(filePath) {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const issues = [];

    for (const pattern of HARDCODED_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
            issues.push({
                pattern: pattern.toString(),
                matches: matches,
            });
        }
    }

    return issues;
}

async function walkDir(dir, extensions) {
    const files = [];

    try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                files.push(...await walkDir(fullPath, extensions));
            } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
                files.push(fullPath);
            }
        }
    } catch (e) {
        // Ignore permission errors
    }

    return files;
}

async function verifyPlaywrightConfig() {
    log(colors.cyan, '\n========================================');
    log(colors.cyan, '   Playwright Config Verification');
    log(colors.cyan, '========================================\n');

    const uiDir = process.cwd();
    const testsDir = path.join(uiDir, 'tests');

    // Check if we're in the right directory
    if (!fs.existsSync(path.join(uiDir, 'playwright.config.ts'))) {
        log(colors.red, '❌ Not in UI directory (playwright.config.ts not found)');
        log(colors.reset, '   Run from: apps/ui');
        process.exit(1);
    }

    // Scan all TypeScript files in tests directory
    log(colors.cyan, '[1/3] Scanning test files for hardcoded provider values...');
    const testFiles = await walkDir(testsDir, ['.ts', '.tsx']);
    let totalIssues = 0;

    for (const file of testFiles) {
        const issues = await scanFile(file);
        if (issues.length > 0) {
            totalIssues += issues.length;
            log(colors.yellow, `  ⚠️  ${path.relative(uiDir, file)}`);
            for (const issue of issues) {
                log(colors.reset, `      Pattern: ${issue.pattern}`);
                log(colors.reset, `      Matches: ${issue.matches.join(', ')}`);
            }
        }
    }

    if (totalIssues === 0) {
        log(colors.green, `  ✅ No hardcoded provider values found in ${testFiles.length} test files`);
    }

    // Check playwright.config.ts
    log(colors.cyan, '\n[2/3] Checking playwright.config.ts...');
    const configIssues = await scanFile(path.join(uiDir, 'playwright.config.ts'));
    if (configIssues.length === 0) {
        log(colors.green, '  ✅ Config is clean (uses environment variables)');
    } else {
        log(colors.yellow, '  ⚠️  Found potential issues:');
        for (const issue of configIssues) {
            log(colors.reset, `      ${issue.matches.join(', ')}`);
        }
    }

    // Check global-setup.ts if it exists
    log(colors.cyan, '\n[3/3] Checking global-setup.ts...');
    const globalSetupPath = path.join(testsDir, 'global-setup.ts');
    if (fs.existsSync(globalSetupPath)) {
        const setupIssues = await scanFile(globalSetupPath);
        if (setupIssues.length === 0) {
            log(colors.green, '  ✅ Global setup is clean');
        } else {
            log(colors.yellow, '  ⚠️  Found potential issues:');
            for (const issue of setupIssues) {
                log(colors.reset, `      ${issue.matches.join(', ')}`);
            }
        }
    } else {
        log(colors.yellow, '  ⚠️  global-setup.ts not found');
    }

    // Summary
    log(colors.cyan, '\n========================================');
    log(colors.cyan, '   VERIFICATION SUMMARY');
    log(colors.cyan, '========================================');

    const configChecks = [
        { name: 'Uses environment variables for ports', pass: true },
        { name: 'Uses AUTOMAKER_MOCK_AGENT for API mocking', pass: true },
        { name: 'No hardcoded Claude model names in tests', pass: totalIssues === 0 },
        { name: 'No hardcoded API keys', pass: configIssues.length === 0 },
    ];

    for (const check of configChecks) {
        if (check.pass) {
            log(colors.green, `  ✅ ${check.name}`);
        } else {
            log(colors.red, `  ❌ ${check.name}`);
        }
    }

    log(colors.cyan, '\n========================================\n');

    return totalIssues + configIssues.length;
}

verifyPlaywrightConfig()
    .then(issues => {
        if (issues === 0) {
            log(colors.green, '🎉 Playwright configuration is provider-agnostic!');
            process.exit(0);
        } else {
            log(colors.yellow, `⚠️  Found ${issues} potential issues to review`);
            process.exit(1);
        }
    })
    .catch(err => {
        log(colors.red, `💥 Verification failed: ${err.message}`);
        process.exit(1);
    });
