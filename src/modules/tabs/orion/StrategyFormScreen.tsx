'use client';

import { useRef, useState } from 'react';
import { processStrategyPhoto } from '@/modules/tabs/orion/imageUtils';
import { type StrategyDraft } from '@/modules/tabs/orion/shared';

interface StrategyFormScreenProps {
  draft: StrategyDraft;
  onChangeDraft: (updater: (prev: StrategyDraft) => StrategyDraft) => void;
  isSubmitting: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: () => void;
  onDelete?: () => void;
}

function PencilIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 3.487a2.1 2.1 0 113.02 2.915L8.64 18.273l-4.14.824.86-4.01L16.862 3.487z" />
    </svg>
  );
}

export default function StrategyFormScreen({
  draft,
  onChangeDraft,
  isSubmitting,
  error,
  submitLabel,
  onSubmit,
  onDelete,
}: StrategyFormScreenProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsProcessingPhoto(true);
    setPhotoError(null);
    try {
      const processed = await processStrategyPhoto(file);
      onChangeDraft((prev) => ({ ...prev, photoUrl: processed }));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Image processing error');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  return (
    <div className="mt-4 flex min-h-[calc(100dvh-220px)] flex-col">
      <div className="flex items-start gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingPhoto}
            className="h-24 w-24 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-800 disabled:opacity-60"
            aria-label="Upload strategy image"
          >
            {draft.photoUrl ? (
              <img src={draft.photoUrl} alt="Strategy logo" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">
                {isProcessingPhoto ? 'Processing...' : 'Upload'}
              </div>
            )}
          </button>
          {draft.photoUrl && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-zinc-200"
              aria-label="Edit photo"
            >
              <PencilIcon />
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <label htmlFor="strategy-form-name" className="text-sm text-zinc-300">Name</label>
          <input
            id="strategy-form-name"
            type="text"
            value={draft.name}
            onChange={(e) => onChangeDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="My breakout strategy"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500"
          />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.svg"
        onChange={handleUpload}
        className="hidden"
      />

      <div className="mt-4 space-y-1.5">
        <label htmlFor="strategy-form-description" className="text-sm text-zinc-300">Description</label>
        <textarea
          id="strategy-form-description"
          value={draft.description}
          onChange={(e) => onChangeDraft((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Describe what this strategy does"
          rows={4}
          className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500"
        />
      </div>

      {(error || photoError) && (
        <div className="mt-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error || photoError}
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting || isProcessingPhoto || !draft.name.trim()}
        className="mt-auto w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? 'Saving...' : submitLabel}
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={isSubmitting}
          className="mt-2 w-full rounded-lg border border-red-900 bg-red-950/40 px-4 py-2.5 text-sm font-semibold text-red-300 disabled:opacity-50"
        >
          Delete Strategy
        </button>
      )}
    </div>
  );
}
