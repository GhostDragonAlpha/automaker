import { Request, Response } from 'express';
import { AutoModeService } from '../../../services/auto-mode-service.js';
import { z } from 'zod';

const expandFeatureSchema = z.object({
    projectPath: z.string(),
    seedTitle: z.string(),
    depth: z.number().optional().default(1),
    domainContext: z.string().optional().default('General'),
    focusArea: z.string().optional().default('Structure'),
    externalContext: z.string().optional(),
});

export const createExpandFeatureHandler = (autoModeService: AutoModeService) => {
    return async (req: Request, res: Response) => {
        try {
            const { projectPath, seedTitle, depth, domainContext, focusArea, externalContext } = expandFeatureSchema.parse(req.body);

            const result = await autoModeService.expandKnowledgeGraph(projectPath, seedTitle, {
                depth,
                domainContext,
                focusArea,
                externalContext,
            });

            res.json(result);
        } catch (error) {
            console.error('Error expanding feature:', error);
            res.status(500).json({ error: 'Failed to expand feature' });
        }
    };
};
