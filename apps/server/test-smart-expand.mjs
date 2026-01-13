
import { EventEmitter } from 'events';
import { IdeationService } from './src/services/ideation-service.ts';
import { ProviderFactory, registerProvider } from './src/providers/provider-factory.ts';
import { ZaiProvider } from './src/providers/zai-provider.ts';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Override key if provided in args
const argKey = process.argv.find(a => a.startsWith('ZAI_API_KEY='));
if (argKey) {
    process.env.ZAI_API_KEY = argKey.split('=')[1];
}

async function run() {
    console.log('🧪 Testing Smart Expand (Backend Logic)...');
    console.log('Checking Z.AI API Key:', process.env.ZAI_API_KEY ? 'Present (' + process.env.ZAI_API_KEY.substring(0, 4) + '...)' : 'MISSING');

    // Register providers manually
    registerProvider('zai', {
        factory: () => new ZaiProvider(),
        aliases: ['default', 'glm-4.7']
    });

    // Verify Z.AI provider
    try {
        const provider = ProviderFactory.getProviderByName('zai');
        console.log('✅ Z.AI Provider loaded');
    } catch (e) {
        console.error('❌ Failed to load Z.AI provider:', e.message);
        process.exit(1);
    }

    // Setup Ideation Service
    const events = new EventEmitter();
    events.on('ideation:subtasks', (data) => {
        console.log(`[Event] ${data.type}`, data.suggestions ? `(${data.suggestions.length} items)` : '');
    });

    const ideation = new IdeationService(events);

    // Test Smart Expand
    const task = "Create a responsive login page with email and password fields validation";
    console.log(`\n📋 Generating subtasks for: "${task}"...`);
    console.log('Using Model: default (Z.AI GLM-4.7)');

    try {
        const suggestions = await ideation.generateSubtasks(
            process.cwd(), // Use current dir as project path
            task,
            3 // Ask for 3 subtasks
        );

        console.log('\n✅ Smart Expand Successful!');
        console.log('Generated Subtasks:');
        suggestions.forEach((s, i) => {
            console.log(`\n${i + 1}. ${s.title}`);
            console.log(`   Priority: ${s.priority}`);
            console.log(`   Rationale: ${s.rational || s.rationale}`);
        });

    } catch (error) {
        console.error('\n❌ Smart Expand Failed:', error);
        // Log error details
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', error.response.data);
        }
        if (error.message && error.message.includes('401')) {
            console.error('⚠️  Auth Failure. Please check your ZAI_API_KEY.');
        }
    }
}

run().catch(console.error);
