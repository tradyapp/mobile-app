'use client';

import OrionExecutionSymbolDrawer from '@/modules/tabs/orion/OrionExecutionSymbolDrawer';
import OrionNodesCanvas from '@/modules/tabs/orion/OrionNodesCanvas';
import OrionDeleteDialogs from '@/modules/tabs/orion/OrionDeleteDialogs';
import OrionNodesHeader from '@/modules/tabs/orion/OrionNodesHeader';
import OrionNodeInspectorPanel from '@/modules/tabs/orion/OrionNodeInspectorPanel';
import OrionReferenceDrawer, { type OrionReferenceSourceItem } from '@/modules/tabs/orion/OrionReferenceDrawer';
import NodeTypesDrawer from '@/modules/tabs/orion/NodeTypesDrawer';
import { NodeSettingsDrawer, VersionNameDialog } from '@/modules/tabs/orion/NodeSettingsDrawer';

interface NodesEditorLayoutProps {
  model: any;
}

export default function NodesEditorLayout({ model }: NodesEditorLayoutProps) {
  return (
    <div className="relative z-[220] flex h-[100dvh] flex-col overflow-hidden bg-zinc-950">
      {model.executionToast && (
        <div
          className="pointer-events-none absolute left-1/2 top-[max(12px,env(safe-area-inset-top))] z-[260] w-[min(92vw,460px)] -translate-x-1/2"
          style={model.safeHorizontalInsetStyle}
        >
          <div className="pointer-events-auto rounded-2xl border border-zinc-700/80 bg-zinc-900/95 px-3 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800">
                {model.executionToast.nodeIconUrl ? (
                  <img
                    src={model.executionToast.nodeIconUrl}
                    alt={model.executionToast.nodeLabel}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-zinc-300">
                    {model.executionToast.nodeLabel.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-zinc-100">{model.executionToast.nodeLabel}</p>
                <p className="mt-0.5 line-clamp-2 text-[13px] font-medium text-emerald-300">{model.executionToast.message}</p>
              </div>
              <button
                type="button"
                onClick={model.onDismissExecutionToast}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-300"
                aria-label="Close execution toast"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <OrionNodesHeader
          strategyName={model.strategyName}
          strategyPhotoUrl={model.strategyPhotoUrl}
          strategyInitials={model.strategyInitials}
          subtitle={model.subtitle}
          executionStatusText={model.executionStatusText}
          executionStatusTone={model.executionStatusTone}
          safeHorizontalInsetStyle={model.safeHorizontalInsetStyle}
          onClose={model.onClose}
          onOpenSettings={model.onOpenSettings}
        />

        <div
          className="min-h-0 flex-1 overflow-hidden pb-4 pt-4"
          style={model.safeCanvasInsetStyle}
        >
          {model.nodeMapError && (
            <div className="mb-3 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {model.nodeMapError}
            </div>
          )}
          {model.saveError && (
            <div className="mb-3 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {model.saveError}
            </div>
          )}
          {model.selectedNodeForEditor ? (
            <OrionNodeInspectorPanel
              nodeLabel={model.nodeEditorData?.label ?? 'Node'}
              nodeTypeKey={model.nodeEditorData?.nodeTypeKey ?? 'custom-node'}
              nodeTypeVersion={typeof model.nodeEditorData?.nodeTypeVersion === 'number' ? model.nodeEditorData.nodeTypeVersion : null}
              isPreviewMode={model.isPreviewMode}
              isUpstreamExecuting={model.isUpstreamExecutingForNode}
              onBack={model.onBackFromNodeEditor}
              onRunUpstream={model.onRunUpstream}
              nodeDetailsPanel={model.nodeDetailsPanel}
              nodeDetailsPanelItems={model.nodeDetailsPanelItems}
              onNodeDetailsPanelChange={model.onNodeDetailsPanelChange}
              panelFields={model.panelFields}
              timezoneOptions={model.timezoneOptions}
              onSetAttributeFieldValue={model.onSetAttributeFieldValue}
              onToggleAttributeMultiOption={model.onToggleAttributeMultiOption}
              onOpenReference={model.onOpenReference}
              onClearReference={model.onClearReference}
              selectedNodeExecutionTrace={model.selectedNodeExecutionTrace}
            />
          ) : (
            <OrionNodesCanvas
              nodes={model.nodes}
              edges={model.edges}
              nodeTypes={model.nodeTypes}
              isPreviewMode={model.isPreviewMode}
              hasSelection={model.hasSelection}
              selectedExecutionSymbol={model.selectedExecutionSymbol}
              trackedSymbolsCount={model.trackedSymbolsCount}
              onNodesChange={model.onNodesChange}
              onEdgesChange={model.onEdgesChange}
              onConnect={model.onConnect}
              onNodeClick={model.onNodeClick}
              onNodeDoubleClick={model.onNodeDoubleClick}
              onSelectionChange={model.onSelectionChange}
              onOpenExecutionSymbolDrawer={model.onOpenExecutionSymbolDrawer}
              onDeleteSelectionRequest={model.onDeleteSelectionRequest}
            />
          )}
        </div>
        {model.isPreviewMode ? (
          <div className="absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-[230] -translate-x-1/2">
            <button
              type="button"
              onClick={model.onEditPreviewAsDraft}
              className="rounded-full border border-zinc-600 bg-zinc-800/95 px-5 py-2 text-sm font-medium text-zinc-100 shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
            >
              Editar
            </button>
          </div>
        ) : !model.selectedNodeForEditor ? (
          <div className="absolute bottom-[max(32px,env(safe-area-inset-bottom))] right-[max(20px,env(safe-area-inset-right))] z-[230] flex items-center gap-3">
            <button
              type="button"
              onClick={model.onRunLocalExecution}
              disabled={model.isLocalExecutionRunning || !model.selectedExecutionTicker}
              className="flex h-11 items-center gap-2 rounded-full border border-emerald-600 bg-emerald-950/70 px-4 text-sm font-semibold text-emerald-300 shadow-[0_8px_20px_rgba(16,185,129,0.25)] disabled:opacity-60"
              aria-label="Run local simulation"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              {model.isLocalExecutionRunning ? 'Running...' : 'Play'}
            </button>
            <button
              type="button"
              onClick={model.onOpenNodeTypesDrawer}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-3xl font-light text-zinc-950 shadow-[0_10px_25px_rgba(16,185,129,0.35)]"
              aria-label="Add node"
            >
              +
            </button>
          </div>
        ) : null}
      </div>

      <OrionExecutionSymbolDrawer
        isOpen={model.isExecutionSymbolDrawerOpen}
        onOpenChange={model.onExecutionSymbolDrawerOpenChange}
        search={model.executionSymbolSearch}
        onSearchChange={model.onExecutionSymbolSearchChange}
        filter={model.executionSymbolFilter}
        onFilterChange={model.onExecutionSymbolFilterChange}
        trackedSymbols={model.trackedSymbols}
        filteredSymbols={model.filteredExecutionSymbols}
        selectedExecutionTicker={model.selectedExecutionTicker}
        onSelectSymbol={model.onSelectExecutionSymbol}
      />

      <OrionReferenceDrawer
        isOpen={model.isReferenceDrawerOpen}
        onOpenChange={model.onReferenceDrawerOpenChange}
        activeFieldName={model.activeReferenceFieldName}
        referenceSearch={model.referenceSearch}
        onReferenceSearchChange={model.onReferenceSearchChange}
        isReferenceSourcesLoading={model.isReferenceSourcesLoading}
        referenceSourcesError={model.referenceSourcesError}
        currentNodeReferenceSourcesCount={model.currentNodeReferenceSourcesCount}
        isUpstreamExecutingForNode={model.isUpstreamExecutingForNode}
        isPreviewMode={model.isPreviewMode}
        onRunUpstreamNow={model.onRunUpstreamNow}
        filteredReferenceSources={model.filteredReferenceSources as OrionReferenceSourceItem[]}
        onPickReference={model.onPickReference}
      />

      <NodeTypesDrawer
        isOpen={model.isNodeTypesDrawerOpen}
        onOpenChange={model.onNodeTypesDrawerOpenChange}
        isNodeTypesLoading={model.isNodeTypesLoading}
        nodeTypesError={model.nodeTypesError}
        availableNodeTypes={model.availableNodeTypes}
        nodeTypeGroups={model.nodeTypeGroups}
        onRetryLoadNodeTypes={model.onRetryLoadNodeTypes}
        onAddNodeFromType={model.onAddNodeFromType}
      />

      <NodeSettingsDrawer
        isOpen={model.isSettingsDrawerOpen}
        onOpenChange={model.onSettingsDrawerOpenChange}
        settingsPanel={model.settingsPanel}
        onSettingsPanelChange={model.onSettingsPanelChange}
        isPreviewMode={model.isPreviewMode}
        isPublishingVersion={model.isPublishingVersion}
        previewVersion={model.previewVersion}
        onActivateButtonClick={model.onActivateButtonClick}
        onOpenVersions={model.onOpenVersions}
        isNodeVersionsLoading={model.isNodeVersionsLoading}
        nodeVersions={model.nodeVersions}
        onEnterPreviewVersion={model.onEnterPreviewVersion}
        nodeVersionsError={model.nodeVersionsError}
        isLive={model.isLive}
        onToggleLive={model.onToggleLive}
        onOpenBacktesting={model.onOpenBacktesting}
        isOwner={model.isOwner}
        trackedSymbols={model.trackedSymbols}
        availableSymbols={model.availableSymbols}
        isSymbolsLoading={model.isSymbolsLoading}
        isSymbolsSaving={model.isSymbolsSaving}
        symbolsError={model.symbolsError}
        onOpenSymbols={model.onOpenSymbols}
        onOpenSymbolsLibrary={model.onOpenSymbolsLibrary}
        onRetryLoadSymbols={model.onRetryLoadSymbols}
        onToggleSymbol={model.onToggleSymbol}
        strategyName={model.strategyName}
        isDeletingStrategy={model.isDeletingStrategy}
        onDeleteStrategyRequest={model.onDeleteStrategyRequest}
      />

      <VersionNameDialog
        isOpen={model.isVersionNameDialogOpen}
        versionNameInput={model.versionNameInput}
        onVersionNameInputChange={model.onVersionNameInputChange}
        onClose={model.onCloseVersionNameDialog}
        onConfirm={model.onConfirmVersionNameDialog}
        isPublishingVersion={model.isPublishingVersion}
      />

      <OrionDeleteDialogs
        isDeleteSelectionDialogOpen={model.isDeleteSelectionDialogOpen}
        onCloseDeleteSelectionDialog={model.onCloseDeleteSelectionDialog}
        onConfirmDeleteSelection={model.onConfirmDeleteSelection}
        isDeleteStrategyDialogOpen={model.isDeleteStrategyDialogOpen}
        isDeletingStrategy={model.isDeletingStrategy}
        strategyName={model.strategyName}
        deleteStrategyConfirmInput={model.deleteStrategyConfirmInput}
        deleteStrategyError={model.deleteStrategyError}
        onDeleteStrategyConfirmInputChange={model.onDeleteStrategyConfirmInputChange}
        onCloseDeleteStrategyDialog={model.onCloseDeleteStrategyDialog}
        onConfirmDeleteStrategy={model.onConfirmDeleteStrategy}
      />
    </div>
  );
}
