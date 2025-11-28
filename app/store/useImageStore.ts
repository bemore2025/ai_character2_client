import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ImageState {
  characterId: string | null;
  situation: string | null;
  backgroundRemovedImageUrl: string | null;
  jobId: string | null;
  refreshCount: number;
  setImageData: (data: {
    characterId: string;
    situation: string;
    backgroundRemovedImageUrl: string;
    jobId: string;
  }) => void;
  clearImageData: () => void;
  decrementRefreshCount: () => void;
  resetRefreshCount: () => void;
}

export const useImageStore = create<ImageState>()(
  persist(
    (set) => ({
      characterId: null,
      situation: null,
      backgroundRemovedImageUrl: null,
      jobId: null,
      refreshCount: 2,
      setImageData: (data) => set({
        characterId: data.characterId,
        situation: data.situation,
        backgroundRemovedImageUrl: data.backgroundRemovedImageUrl,
        jobId: data.jobId,
        refreshCount: 2, // 새 이미지 저장 시 카운트 리셋
      }),
      clearImageData: () => set({
        characterId: null,
        situation: null,
        backgroundRemovedImageUrl: null,
        jobId: null,
        refreshCount: 2,
      }),
      decrementRefreshCount: () => set((state) => ({
        refreshCount: Math.max(0, state.refreshCount - 1)
      })),
      resetRefreshCount: () => set({ refreshCount: 2 }),
    }),
    {
      name: 'image-storage',
    }
  )
);
