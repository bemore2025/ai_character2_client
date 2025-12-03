'use client';

import { useEffect, useRef } from "react";
import { useAudioStore } from "@/app/store/useAudioStore";

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isMuted, isIntroPlaying } = useAudioStore();
  const normalVolume = 0.7;
  const reducedVolume = 0.4; // 절반으로 줄인 볼륨

  useEffect(() => {
    // 오디오 요소 생성
    if (!audioRef.current) {
      audioRef.current = new Audio("/bgm1.mp3");
      audioRef.current.loop = true;
      audioRef.current.volume = normalVolume;
    }

    // 컴포넌트 마운트 시 음악 재생
    const playMusic = async () => {
      try {
        if (audioRef.current) {
          await audioRef.current.play();
        }
      } catch (error) {
        console.log("자동 재생이 차단되었습니다. 사용자 상호작용이 필요합니다.");
      }
    };

    playMusic();

    // 컴포넌트 언마운트 시 음악 정지
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  // isMuted와 isIntroPlaying 상태에 따라 음악 볼륨 처리
  useEffect(() => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = 0;
      } else if (isIntroPlaying) {
        audioRef.current.volume = reducedVolume; // Intro 음악 재생 중일 때 볼륨 절반으로 감소
      } else {
        audioRef.current.volume = normalVolume;
      }
    }
  }, [isMuted, isIntroPlaying, normalVolume, reducedVolume]);

  // UI를 렌더링하지 않는 컴포넌트
  return null;
} 