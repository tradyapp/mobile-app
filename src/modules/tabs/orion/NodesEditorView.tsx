'use client';

import NodesEditorLayout from '@/modules/tabs/orion/NodesEditorLayout';
import useNodesEditorController from '@/modules/tabs/orion/useNodesEditorController';

interface NodesViewProps {
  strategyId: string;
  strategyName: string;
  strategyPhotoUrl?: string | null;
  isOwner: boolean;
  onDeleted?: (strategyId: string) => void;
  onClose: () => void;
}

function NodesView({ strategyId, strategyName, strategyPhotoUrl = null, isOwner, onDeleted, onClose }: NodesViewProps) {
  const model = useNodesEditorController({
    strategyId,
    strategyName,
    strategyPhotoUrl,
    isOwner,
    onDeleted,
    onClose,
  });

  return <NodesEditorLayout model={model} />;
}

export default NodesView;
