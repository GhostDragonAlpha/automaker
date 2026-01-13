import { IdeationService } from './apps/server/src/services/ideation-service';
import { EventEmitter } from './apps/server/src/lib/events';
import { ProviderFactory } from './apps/server/src/providers/provider-factory';

// Mock Dependencies
const mockEvents = {
  emit: () => {},
  subscribe: () => () => {},
} as unknown as EventEmitter;

const mockSettingsService = {
  getGlobalSettings: async () => ({}),
  getProjectSettings: async () => ({}),
} as any;

const mockFeatureLoader = {
  exists: async () => true,
} as any;

// Mock Provider
const mockProvider = {
  executeQuery: (options: any) => {
    // Return a stream that yields a valid JSON response
    return {
      async *[Symbol.asyncIterator]() {
        yield { type: 'text', content: '[' };
        yield {
          type: 'text',
          content:
            '{"id": "sub-1", "title": "Mock Subtask 1", "description": "Desc 1", "priority": "high"},',
        };
        yield {
          type: 'text',
          content:
            '{"id": "sub-2", "title": "Mock Subtask 2", "description": "Desc 2", "priority": "medium"}',
        };
        yield { type: 'text', content: ']' };
      },
    };
  },
};

// Patch ProviderFactory
ProviderFactory.getProviderForModel = () => mockProvider as any;
ProviderFactory.getProviderNameForModel = () => 'mock-provider';

// Test Runner
async function runTest() {
  console.log('🧪 Testing IdeationService Logic with Mock Provider...');

  const service = new IdeationService(mockEvents, mockSettingsService, mockFeatureLoader);

  try {
    const suggestions = await service.generateSubtasks('C:\\Chimera', 'Parent Task', 2);

    console.log(`\n✅ Success! Generated ${suggestions.length} suggestions.`);
    suggestions.forEach((s) => console.log(`   - ${s.title} (${s.priority})`));

    if (suggestions.length === 2 && suggestions[0].title === 'Mock Subtask 1') {
      console.log('\n✨ VERIFICATION PASSED: Logic handles JSON response correctly.');
      process.exit(0);
    } else {
      console.error('\n❌ FAILED: Unexpected output format.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ CRASHED:', error);
    process.exit(1);
  }
}

runTest();
