import { useCallback, useState, useMemo, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAppStore, Feature } from '@/store/app-store';
import { useBoardFeatures } from './board-view/hooks/use-board-features';
import { GraphView } from './graph-view/graph-view';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import {
    AddFeatureDialog,
    AgentOutputModal,
    CompletedFeaturesModal,
    DeleteCompletedFeatureDialog,
    EditFeatureDialog,
    FollowUpDialog,
    PlanApprovalDialog,
    SmartExpandDialog,
} from './board-view/dialogs';
import { useAutoMode } from '@/hooks/use-auto-mode';
import { useBoardActions } from './board-view/hooks/use-board-actions';
import { useFollowUpState } from './board-view/hooks/use-follow-up-state';
import { useWindowState } from '@/hooks/use-window-state';
import { useBoardPersistence } from './board-view/hooks/use-board-persistence';
import { getElectronAPI } from '@/lib/electron';
import { toast } from 'sonner';

export function WorldModelView() {
    const navigate = useNavigate();
    const {
        currentProject,
        specCreatingForProject,
        pendingPlanApproval,
        setPendingPlanApproval,
        updateFeature,
        getCurrentWorktree,
        getWorktrees,
        setWorktrees,
        setCurrentWorktree,
        aiProfiles,
        showProfilesOnly,
        defaultSkipTests,
    } = useAppStore();

    const {
        features: hookFeatures,
        persistedCategories,
        loadFeatures,
        saveCategory,
    } = useBoardFeatures({ currentProject });

    const [searchQuery, setSearchQuery] = useState('');
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
    const [spawnParentFeature, setSpawnParentFeature] = useState<Feature | null>(null);
    const [showOutputModal, setShowOutputModal] = useState(false);
    const [outputFeature, setOutputFeature] = useState<Feature | null>(null);
    const [showCompletedModal, setShowCompletedModal] = useState(false);
    const [deleteCompletedFeature, setDeleteCompletedFeature] = useState<Feature | null>(null);
    const [worktreeRefreshKey, setWorktreeRefreshKey] = useState(0);

    // Plan approval loading state
    const [isPlanApprovalLoading, setIsPlanApprovalLoading] = useState(false);

    // Smart Expand state
    const [showSmartExpand, setShowSmartExpand] = useState(false);
    const [smartExpandFeature, setSmartExpandFeature] = useState<Feature | null>(null);

    // handleRunSmartExpand is defined after useBoardActions (needs handleAddFeature)

    // Auto mode hook
    const autoMode = useAutoMode();
    // Get runningTasks from the hook (scoped to current project)
    const runningAutoTasks = autoMode.runningTasks;

    // Window state hook for compact dialog mode
    const { isMaximized } = useWindowState();

    // Follow-up state hook
    const {
        showFollowUpDialog,
        followUpFeature,
        followUpPrompt,
        followUpImagePaths,
        followUpPreviewMap,
        setShowFollowUpDialog,
        setFollowUpFeature,
        setFollowUpPrompt,
        setFollowUpImagePaths,
        setFollowUpPreviewMap,
        handleFollowUpDialogChange,
        handleSendFollowUp,
    } = useFollowUpState();

    // Use persistence hook
    const { persistFeatureCreate, persistFeatureUpdate, persistFeatureDelete } = useBoardPersistence({
        currentProject,
    });

    // Get unique categories from existing features AND persisted categories for autocomplete suggestions
    const categorySuggestions = useMemo(() => {
        const featureCategories = hookFeatures.map((f) => f.category).filter(Boolean);
        // Merge feature categories with persisted categories
        const allCategories = [...featureCategories, ...persistedCategories];
        return [...new Set(allCategories)].sort();
    }, [hookFeatures, persistedCategories]);

    // Branch suggestions logic (mirroring BoardView)
    const [branchSuggestions, setBranchSuggestions] = useState<string[]>([]);
    useEffect(() => {
        const fetchBranches = async () => {
            if (!currentProject) {
                setBranchSuggestions([]);
                return;
            }
            try {
                const api = getElectronAPI();
                if (!api?.worktree?.listBranches) {
                    setBranchSuggestions([]);
                    return;
                }
                const result = await api.worktree.listBranches(currentProject.path);
                if (result.success && result.result?.branches) {
                    const localBranches = result.result.branches
                        .filter((b) => !b.isRemote)
                        .map((b) => b.name);
                    setBranchSuggestions(localBranches);
                }
            } catch (error) {
                console.error('Error fetching branches:', error);
                setBranchSuggestions([]);
            }
        };
        fetchBranches();
    }, [currentProject, worktreeRefreshKey]);

    // Calculate unarchived card counts per branch
    const branchCardCounts = useMemo(() => {
        return hookFeatures.reduce(
            (counts, feature) => {
                if (feature.status !== 'completed') {
                    const branch = feature.branchName ?? 'main';
                    counts[branch] = (counts[branch] || 0) + 1;
                }
                return counts;
            },
            {} as Record<string, number>
        );
    }, [hookFeatures]);

    // Get in-progress features for keyboard shortcuts (needed before actions hook)
    const inProgressFeaturesForShortcuts = useMemo(() => {
        return hookFeatures.filter((f) => {
            const isRunning = runningAutoTasks.includes(f.id);
            return isRunning || f.status === 'in_progress';
        });
    }, [hookFeatures, runningAutoTasks]);

    // Get current worktree info (path) for filtering features
    const currentWorktreeInfo = currentProject ? getCurrentWorktree(currentProject.path) : null;
    const currentWorktreePath = currentWorktreeInfo?.path ?? null;
    const worktreesByProject = useAppStore((s) => s.worktreesByProject);
    // Stable empty array to avoid infinite loop in selector
    const EMPTY_WORKTREES: ReturnType<ReturnType<typeof useAppStore.getState>['getWorktrees']> = [];
    const worktrees = useMemo(
        () =>
            currentProject
                ? (worktreesByProject[currentProject.path] ?? EMPTY_WORKTREES)
                : EMPTY_WORKTREES,
        [currentProject, worktreesByProject]
    );

    // Get the branch for the currently selected worktree
    const selectedWorktree = useMemo(() => {
        if (currentWorktreePath === null) {
            // Primary worktree selected - find the main worktree
            return worktrees.find((w) => w.isMain);
        } else {
            // Specific worktree selected - find it by path
            return worktrees.find((w) => !w.isMain && w.path === currentWorktreePath);
        }
    }, [worktrees, currentWorktreePath]);

    const currentWorktreeBranch = selectedWorktree?.branch ?? null;
    const selectedWorktreeBranch =
        currentWorktreeBranch || worktrees.find((w) => w.isMain)?.branch || 'main';

    // Copied from BoardView: Extract all action handlers into the hook
    const {
        handleAddFeature,
        handleUpdateFeature,
        handleDeleteFeature,
        handleStartImplementation,
        handleResumeFeature,
        handleUnarchiveFeature,
        handleViewOutput,
        handleOutputModalNumberKeyPress,
        handleForceStopFeature,
    } = useBoardActions({
        currentProject,
        features: hookFeatures,
        runningAutoTasks,
        loadFeatures,
        persistFeatureCreate,
        persistFeatureUpdate,
        persistFeatureDelete,
        saveCategory,
        setEditingFeature,
        setShowOutputModal,
        setOutputFeature,
        followUpFeature,
        followUpPrompt,
        followUpImagePaths,
        setFollowUpFeature,
        setFollowUpPrompt,
        setFollowUpImagePaths,
        setFollowUpPreviewMap,
        setShowFollowUpDialog,
        inProgressFeaturesForShortcuts,
        outputFeature,
        projectPath: currentProject?.path || null,
        onWorktreeCreated: () => setWorktreeRefreshKey((k) => k + 1),
        onWorktreeAutoSelect: (newWorktree) => {
            if (!currentProject) return;
            // Check if worktree already exists in the store (by branch name)
            const currentWorktrees = getWorktrees(currentProject.path);
            const existingWorktree = currentWorktrees.find((w) => w.branch === newWorktree.branch);

            // Only add if it doesn't already exist (to avoid duplicates)
            if (!existingWorktree) {
                const newWorktreeInfo = {
                    path: newWorktree.path,
                    branch: newWorktree.branch,
                    isMain: false,
                    isCurrent: false,
                    hasWorktree: true,
                };
                setWorktrees(currentProject.path, [...currentWorktrees, newWorktreeInfo]);
            }
            // Select the worktree (whether it existed or was just added)
            setCurrentWorktree(currentProject.path, newWorktree.path, newWorktree.branch);
        },
        currentWorktreeBranch,
    });

    // Smart Expand handler - must be after useBoardActions since it needs handleAddFeature
    const handleRunSmartExpand = useCallback(
        async (seedFeature: Feature, options: any) => {
            try {
                const response = await fetch('http://localhost:3000/api/auto-mode/expand-feature', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        projectPath: currentProject?.path,
                        seedTitle: seedFeature.title,
                        depth: options.depth,
                        domainContext: options.domainContext,
                        focusArea: options.focusArea,
                        externalContext: options.externalContext,
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to expand feature');
                }

                const data = await response.json();
                const terms = data.terms || [];

                toast.success(`Expanded "${seedFeature.title}"`, {
                    description: `Generated ${terms.length} structural nodes based on ${options.domainContext}`,
                });

                // Create features for each term
                for (const term of terms) {
                    await handleAddFeature({
                        title: term.title,
                        description: `Generated via Smart Expand.\n\nRationale: ${term.rationale}\nContext: ${options.domainContext}`,
                        category: 'feature',
                        status: 'backlog',
                        steps: [],
                        phaseId: 'phase1',
                        // Link to parent
                        dependencies: [seedFeature.id],
                    });
                }
            } catch (error) {
                console.error('Smart Expand error:', error);
                toast.error('Failed to expand feature');
            }
        },
        [handleAddFeature, currentProject]
    );

    // Handler for "Make" button - creates a feature and immediately starts it
    const handleAddAndStartFeature = useCallback(
        async (featureData: Parameters<typeof handleAddFeature>[0]) => {
            // Capture existing feature IDs before adding
            const featuresBeforeIds = new Set(useAppStore.getState().features.map((f) => f.id));
            await handleAddFeature(featureData);

            // Find the newly created feature by looking for an ID that wasn't in the original set
            const latestFeatures = useAppStore.getState().features;
            const newFeature = latestFeatures.find((f) => !featuresBeforeIds.has(f.id));

            if (newFeature) {
                await handleStartImplementation(newFeature);
            } else {
                toast.error('Failed to auto-start feature', {
                    description: 'The feature was created but could not be started automatically.',
                });
            }
        },
        [handleAddFeature, handleStartImplementation]
    );

    // Plan approval handlers (mirroring BoardView)
    const pendingApprovalFeature = useMemo(() => {
        if (!pendingPlanApproval) return null;
        return hookFeatures.find((f) => f.id === pendingPlanApproval.featureId) || null;
    }, [pendingPlanApproval, hookFeatures]);

    const handlePlanApprove = useCallback(
        async (planContent: string) => {
            if (!pendingApprovalFeature || !currentProject) return;

            setIsPlanApprovalLoading(true);
            const featureId = pendingApprovalFeature.id;

            try {
                const api = getElectronAPI();
                // Server derives workDir from feature.branchName
                const result = await api.autoMode.approvePlan(
                    currentProject.path,
                    featureId,
                    planContent
                    // No worktreePath - server derives
                );

                if (result.success) {
                    toast.success('Plan approved, starting execution');
                    // Update feature status locally
                    updateFeature(featureId, {
                        status: 'in_progress',
                        planSpec: {
                            ...pendingApprovalFeature.planSpec,
                            status: 'approved',
                            content: planContent,
                            reviewedByUser: true,
                        },
                    });
                    // Reload features
                    loadFeatures();
                } else {
                    toast.error(`Failed to approve plan: ${result.error}`);
                }
            } catch (error) {
                console.error('Error approving plan:', error);
                toast.error('Error approving plan');
            } finally {
                setIsPlanApprovalLoading(false);
                setPendingPlanApproval(null);
            }
        },
        [pendingApprovalFeature, currentProject, updateFeature, loadFeatures, setPendingPlanApproval]
    );

    const handlePlanReject = useCallback(
        async (feedback: string) => {
            if (!pendingApprovalFeature || !currentProject) return;

            setIsPlanApprovalLoading(true);
            const featureId = pendingApprovalFeature.id;

            try {
                const api = getElectronAPI();
                // Server derives workDir from feature.branchName
                const result = await api.autoMode.rejectPlan(
                    currentProject.path,
                    featureId,
                    feedback
                    // No worktreePath - server derives
                );

                if (result.success) {
                    toast.success('Plan rejected, agent will regenerate');
                    // Update feature status locally
                    const currentFeature = hookFeatures.find((f) => f.id === featureId);
                    updateFeature(featureId, {
                        status: 'backlog',
                        planSpec: {
                            status: 'rejected',
                            content: pendingPlanApproval.planContent,
                            version: currentFeature?.planSpec?.version || 1,
                            reviewedByUser: true,
                        },
                    });
                    loadFeatures();
                } else {
                    toast.error(`Failed to reject plan: ${result.error}`);
                }
            } catch (error) {
                console.error('Error rejecting plan:', error);
                toast.error('Error rejecting plan');
            } finally {
                setIsPlanApprovalLoading(false);
                setPendingPlanApproval(null);
            }
        },
        [
            pendingApprovalFeature,
            currentProject,
            updateFeature,
            loadFeatures,
            setPendingPlanApproval,
            hookFeatures,
            pendingPlanApproval,
        ]
    );

    if (!currentProject) {
        return (
            <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
                <p>Please open a project to view the World Model.</p>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full flex-col overflow-hidden bg-background">
            <div className="flex items-center justify-between border-b px-4 py-2">
                <h2 className="text-lg font-semibold">World Model</h2>
                <Button onClick={() => setShowAddDialog(true)} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Feature
                </Button>
            </div>

            <GraphView
                features={hookFeatures}
                runningAutoTasks={runningAutoTasks}
                currentWorktreePath={currentWorktreePath}
                currentWorktreeBranch={currentWorktreeBranch}
                projectPath={currentProject.path}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                onEditFeature={(feature) => setEditingFeature(feature)}
                onViewOutput={handleViewOutput}
                onStartTask={handleStartImplementation}
                onStopTask={handleForceStopFeature}
                onResumeTask={handleResumeFeature}
                onDeleteTask={(feature) => handleDeleteFeature(feature.id)}
                onUpdateFeature={handleUpdateFeature}
                onSpawnTask={(feature) => {
                    setSpawnParentFeature(feature);
                    setShowAddDialog(true);
                }}
                onExpand={(feature) => {
                    setSmartExpandFeature(feature);
                    setShowSmartExpand(true);
                }}
            />

            {/* Add Feature Dialog */}
            <AddFeatureDialog
                open={showAddDialog}
                onOpenChange={(open) => {
                    setShowAddDialog(open);
                    if (!open) {
                        setSpawnParentFeature(null);
                    }
                }}
                onAdd={handleAddFeature}
                onAddAndStart={handleAddAndStartFeature}
                categorySuggestions={categorySuggestions}
                branchSuggestions={branchSuggestions}
                branchCardCounts={branchCardCounts}
                defaultSkipTests={defaultSkipTests}
                defaultBranch={selectedWorktreeBranch}
                currentBranch={currentWorktreeBranch || undefined}
                isMaximized={isMaximized}
                showProfilesOnly={showProfilesOnly}
                aiProfiles={aiProfiles}
                parentFeature={spawnParentFeature}
                allFeatures={hookFeatures}
            />

            {/* Edit Feature Dialog */}
            <EditFeatureDialog
                feature={editingFeature}
                onClose={() => setEditingFeature(null)}
                onUpdate={handleUpdateFeature}
                categorySuggestions={categorySuggestions}
                branchSuggestions={branchSuggestions}
                branchCardCounts={branchCardCounts}
                currentBranch={currentWorktreeBranch || undefined}
                isMaximized={isMaximized}
                showProfilesOnly={showProfilesOnly}
                aiProfiles={aiProfiles}
                allFeatures={hookFeatures}
            />

            {/* Smart Expand Dialog */}
            <SmartExpandDialog
                open={showSmartExpand}
                onOpenChange={(open) => {
                    setShowSmartExpand(open);
                    if (!open) setSmartExpandFeature(null);
                }}
                feature={smartExpandFeature}
                onExpand={handleRunSmartExpand}
            />

            {/* Agent Output Modal */}
            <AgentOutputModal
                open={showOutputModal}
                onClose={() => setShowOutputModal(false)}
                featureDescription={outputFeature?.description || ''}
                featureId={outputFeature?.id || ''}
                featureStatus={outputFeature?.status}
                onNumberKeyPress={handleOutputModalNumberKeyPress}
            />

            {/* Completed Features Modal */}
            <CompletedFeaturesModal
                open={showCompletedModal}
                onOpenChange={setShowCompletedModal}
                completedFeatures={hookFeatures.filter((f) => f.status === 'completed')}
                onUnarchive={handleUnarchiveFeature}
                onDelete={(feature) => setDeleteCompletedFeature(feature)}
            />

            {/* Delete Completed Feature Confirmation Dialog */}
            <DeleteCompletedFeatureDialog
                feature={deleteCompletedFeature}
                onClose={() => setDeleteCompletedFeature(null)}
                onConfirm={async () => {
                    if (deleteCompletedFeature) {
                        await handleDeleteFeature(deleteCompletedFeature.id);
                        setDeleteCompletedFeature(null);
                    }
                }}
            />

            {/* Follow-Up Prompt Dialog */}
            <FollowUpDialog
                open={showFollowUpDialog}
                onOpenChange={handleFollowUpDialogChange}
                feature={followUpFeature}
                prompt={followUpPrompt}
                imagePaths={followUpImagePaths}
                previewMap={followUpPreviewMap}
                onPromptChange={setFollowUpPrompt}
                onImagePathsChange={setFollowUpImagePaths}
                onPreviewMapChange={setFollowUpPreviewMap}
                onSend={handleSendFollowUp}
                isMaximized={isMaximized}
            />

            {/* Plan Approval Dialog */}
            <PlanApprovalDialog
                open={pendingPlanApproval !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingPlanApproval(null);
                    }
                }}
                feature={pendingApprovalFeature}
                planContent={pendingPlanApproval?.planContent || ''}
                onApprove={handlePlanApprove}
                onReject={handlePlanReject}
                isLoading={isPlanApprovalLoading}
            />
        </div>
    );
}
