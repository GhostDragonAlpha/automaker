/**
 * Generate features from existing app_spec.txt
 *
 * Model is configurable via phaseModels.featureGenerationModel in settings
 * (defaults to Sonnet for balanced speed and quality).
 */

import { executeQuery } from '../../lib/execute-query.js';
import * as secureFs from '../../lib/secure-fs.js';
import type { EventEmitter } from '../../lib/events.js';
import { createLogger } from '@automaker/utils';
import { DEFAULT_PHASE_MODELS, isCursorModel, stripProviderPrefix } from '@automaker/types';
import { resolvePhaseModel } from '@automaker/model-resolver';
import { aiGateway } from '../../services/ai-gateway.js';
import { parseAndCreateFeatures } from './parse-and-create-features.js';
import { getAppSpecPath } from '@automaker/platform';
import type { SettingsService } from '../../services/settings-service.js';
import { getAutoLoadClaudeMdSetting } from '../../lib/settings-helpers.js';

const logger = createLogger('SpecRegeneration');

const DEFAULT_MAX_FEATURES = 50;

export async function generateFeaturesFromSpec(
  projectPath: string,
  events: EventEmitter,
  abortController: AbortController,
  maxFeatures?: number,
  settingsService?: SettingsService
): Promise<void> {
  const featureCount = maxFeatures ?? DEFAULT_MAX_FEATURES;
  logger.debug('========== generateFeaturesFromSpec() started ==========');
  logger.debug('projectPath:', projectPath);
  logger.debug('maxFeatures:', featureCount);

  // Read existing spec from .automaker directory
  const specPath = getAppSpecPath(projectPath);
  let spec: string;

  logger.debug('Reading spec from:', specPath);

  try {
    spec = (await secureFs.readFile(specPath, 'utf-8')) as string;
    logger.info(`Spec loaded successfully (${spec.length} chars)`);
    logger.info(`Spec preview (first 500 chars): ${spec.substring(0, 500)}`);
    logger.info(`Spec preview (last 500 chars): ${spec.substring(spec.length - 500)}`);
  } catch (readError) {
    logger.error('❌ Failed to read spec file:', readError);
    events.emit('spec-regeneration:event', {
      type: 'spec_regeneration_error',
      error: 'No project spec found. Generate spec first.',
      projectPath: projectPath,
    });
    return;
  }

  const prompt = `Based on this project specification:

${spec}

Generate a prioritized list of implementable features. For each feature provide:

1. **id**: A unique lowercase-hyphenated identifier
2. **category**: Functional category (e.g., "Core", "UI", "API", "Authentication", "Database")
3. **title**: Short descriptive title
4. **description**: What this feature does (2-3 sentences)
5. **priority**: 1 (high), 2 (medium), or 3 (low)
6. **complexity**: "simple", "moderate", or "complex"
7. **dependencies**: Array of feature IDs this depends on (can be empty)

Format as JSON:
{
  "features": [
    {
      "id": "feature-id",
      "category": "Feature Category",
      "title": "Feature Title",
      "description": "What it does",
      "priority": 1,
      "complexity": "moderate",
      "dependencies": []
    }
  ]
}

Generate ${featureCount} features that build on each other logically.

IMPORTANT: Do not ask for clarification. The specification is provided above. Generate the JSON immediately.`;

  logger.info('========== PROMPT BEING SENT ==========');
  logger.info(`Prompt length: ${prompt.length} chars`);
  logger.info(`Prompt preview (first 1000 chars):\n${prompt.substring(0, 1000)}`);
  logger.info('========== END PROMPT PREVIEW ==========');

  events.emit('spec-regeneration:event', {
    type: 'spec_regeneration_progress',
    content: 'Analyzing spec and generating features...\n',
    projectPath: projectPath,
  });

  // Load autoLoadClaudeMd setting
  const autoLoadClaudeMd = await getAutoLoadClaudeMdSetting(
    projectPath,
    settingsService,
    '[FeatureGeneration]'
  );

  // Get model from phase settings
  const settings = await settingsService?.getGlobalSettings();
  const phaseModelEntry =
    settings?.phaseModels?.featureGenerationModel || DEFAULT_PHASE_MODELS.featureGenerationModel;
  const { model, thinkingLevel } = resolvePhaseModel(phaseModelEntry);

  logger.info('Using model:', model);

  let responseText = '';
  let messageCount = 0;

  // Route to appropriate provider based on model type
  if (isCursorModel(model)) {
    // Use Cursor provider for Cursor models
    logger.info('[FeatureGeneration] Using Cursor provider');

    // Add explicit instructions for Cursor to return JSON in response
    const cursorPrompt = `${prompt}

CRITICAL INSTRUCTIONS:
1. DO NOT write any files. Return the JSON in your response only.
2. Respond with ONLY a JSON object - no explanations, no markdown, just raw JSON.
3. Your entire response should be valid JSON starting with { and ending with }. No text before or after.`;

    // Use AIGateway for parallel-safe, provider-agnostic execution
    for await (const msg of aiGateway.execute({
      prompt: cursorPrompt,
      model,
      cwd: projectPath,
      maxTurns: 250,
      allowedTools: ['Read', 'Glob', 'Grep'],
      abortController,
      readOnly: true, // Feature generation only reads code, doesn't write
    })) {
      messageCount++;

      if (msg.type === 'assistant' && msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === 'text' && block.text) {
            responseText += block.text;
            logger.debug(`Feature text block received (${block.text.length} chars)`);
            events.emit('spec-regeneration:event', {
              type: 'spec_regeneration_progress',
              content: block.text,
              projectPath: projectPath,
            });
          }
        }
      } else if (msg.type === 'result' && msg.subtype === 'success' && msg.result) {
        // Use result if it's a final accumulated message
        if (msg.result.length > responseText.length) {
          responseText = msg.result;
        }
      }
    }
  } else {
    // Use default provider via executeQuery (provider-agnostic)
    logger.info('[FeatureGeneration] Using executeQuery for model:', model);

    // Add explicit JSON response instructions to the prompt
    const structuredPrompt = `${prompt}

CRITICAL INSTRUCTIONS:
1. DO NOT write any files. Return the JSON in your response only.
2. Respond with ONLY a JSON object - no explanations, no markdown, just raw JSON.
3. Your entire response should be valid JSON starting with { and ending with }. No text before or after.`;

    logger.info('Calling executeQuery() for features...');

    try {
      for await (const msg of executeQuery({
        prompt: structuredPrompt,
        model,
        cwd: projectPath,
        maxTurns: 250,
        allowedTools: ['Read', 'Glob', 'Grep'],
        abortController,
        readOnly: true,
      })) {
        messageCount++;
        logger.debug(
          `Feature stream message #${messageCount}:`,
          JSON.stringify({ type: msg.type, subtype: (msg as any).subtype }, null, 2)
        );

        if (msg.type === 'assistant' && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === 'text' && block.text) {
              responseText += block.text;
              logger.debug(`Feature text block received (${block.text.length} chars)`);
              events.emit('spec-regeneration:event', {
                type: 'spec_regeneration_progress',
                content: block.text,
                projectPath: projectPath,
              });
            }
          }
        } else if (msg.type === 'result' && (msg as any).subtype === 'success') {
          logger.debug('Received success result for features');
          responseText = (msg as any).result || responseText;
        } else if ((msg as { type: string }).type === 'error') {
          logger.error('❌ Received error message from feature stream:');
          logger.error('Error message:', JSON.stringify(msg, null, 2));
        }
      }
    } catch (streamError) {
      logger.error('❌ Error while iterating feature stream:');
      logger.error('Stream error:', streamError);
      throw streamError;
    }
  }

  logger.info(`Feature stream complete. Total messages: ${messageCount}`);
  logger.info(`Feature response length: ${responseText.length} chars`);
  logger.info('========== FULL RESPONSE TEXT ==========');
  logger.info(responseText);
  logger.info('========== END RESPONSE TEXT ==========');

  await parseAndCreateFeatures(projectPath, responseText, events);

  logger.debug('========== generateFeaturesFromSpec() completed ==========');
}
