"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useButtonSound } from "@/app/components/ButtonSound";
import { useVoiceRecognition } from "@/app/utils/useVoiceRecognition";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useAudioStore } from "@/app/store/useAudioStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import { Character } from "../types";
import {
  saveImageRecord,
  pollForImageResult,
  requestImageProcessing,
} from "@/utils/imagePolling";

// 한글 조합을 위한 유틸리티 함수들
const CHOSUNG = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];
const JUNGSUNG = [
  "ㅏ",
  "ㅐ",
  "ㅑ",
  "ㅒ",
  "ㅓ",
  "ㅔ",
  "ㅕ",
  "ㅖ",
  "ㅗ",
  "ㅘ",
  "ㅙ",
  "ㅚ",
  "ㅛ",
  "ㅜ",
  "ㅝ",
  "ㅞ",
  "ㅟ",
  "ㅠ",
  "ㅡ",
  "ㅢ",
  "ㅣ",
];
const JONGSUNG = [
  "",
  "ㄱ",
  "ㄲ",
  "ㄳ",
  "ㄴ",
  "ㄵ",
  "ㄶ",
  "ㄷ",
  "ㄹ",
  "ㄺ",
  "ㄻ",
  "ㄼ",
  "ㄽ",
  "ㄾ",
  "ㄿ",
  "ㅀ",
  "ㅁ",
  "ㅂ",
  "ㅄ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];

// 복합 모음 조합 규칙
const JUNGSUNG_COMBINATIONS: { [key: string]: string } = {
  ㅗㅏ: "ㅘ",
  ㅗㅐ: "ㅙ",
  ㅗㅣ: "ㅚ",
  ㅜㅓ: "ㅝ",
  ㅜㅔ: "ㅞ",
  ㅜㅣ: "ㅟ",
  ㅡㅣ: "ㅢ",
};

// 복합 자음 조합 규칙
const JONGSUNG_COMBINATIONS: { [key: string]: string } = {
  ㄱㅅ: "ㄳ",
  ㄴㅈ: "ㄵ",
  ㄴㅎ: "ㄶ",
  ㄹㄱ: "ㄺ",
  ㄹㅁ: "ㄻ",
  ㄹㅂ: "ㄼ",
  ㄹㅅ: "ㄽ",
  ㄹㅌ: "ㄾ",
  ㄹㅍ: "ㄿ",
  ㄹㅎ: "ㅀ",
  ㅂㅅ: "ㅄ",
};

// 문자가 한글인지 확인
const isHangul = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3;
};

// 문자가 자음인지 확인
const isChosung = (char: string): boolean => {
  return CHOSUNG.includes(char);
};

// 문자가 모음인지 확인
const isJungsung = (char: string): boolean => {
  return JUNGSUNG.includes(char);
};

// 한글 문자를 초성, 중성, 종성으로 분해
const decomposeHangul = (char: string): [number, number, number] => {
  const code = char.charCodeAt(0) - 0xac00;
  const chosung = Math.floor(code / 588);
  const jungsung = Math.floor((code % 588) / 28);
  const jongsung = code % 28;
  return [chosung, jungsung, jongsung];
};

// 초성, 중성, 종성을 조합하여 한글 문자 생성
const composeHangul = (
  chosung: number,
  jungsung: number,
  jongsung: number
): string => {
  const code = 0xac00 + chosung * 588 + jungsung * 28 + jongsung;
  return String.fromCharCode(code);
};

// 글자수에 따라 스페이스를 추가하는 함수
const formatRoleWithSpaces = (role: string): string => {
  if (!role) {
    return role;
  }

  const { length } = role;

  if (length === 2) {
    // 2글자면 가운데에 스페이스 2개
    return role[0] + "   " + role[1];
  } else if (length === 3) {
    // 3글자면 각 글자 사이에 스페이스 1개씩
    return role[0] + " " + role[1] + " " + role[2];
  } else {
    // 4글자 이상이면 스페이스 없음
    return role;
  }
};

// 한글 조합 처리 함수
const processKoreanInput = (currentText: string, newChar: string): string => {
  if (!currentText) {
    return newChar;
  }

  const lastChar = currentText[currentText.length - 1];
  const beforeText = currentText.slice(0, -1);

  // 마지막 문자가 한글이 아닌 경우
  if (!isHangul(lastChar) && !isChosung(lastChar) && !isJungsung(lastChar)) {
    return currentText + newChar;
  }

  // 새 입력이 자음인 경우
  if (isChosung(newChar)) {
    // 마지막 문자가 완성된 한글인 경우
    if (isHangul(lastChar)) {
      const [cho, jung, jong] = decomposeHangul(lastChar);

      if (jong === 0) {
        // 종성이 없는 경우 종성 추가
        const newJongsungIndex = JONGSUNG.indexOf(newChar);
        if (newJongsungIndex !== -1) {
          return beforeText + composeHangul(cho, jung, newJongsungIndex);
        }
      } else {
        // 이미 종성이 있는 경우
        const currentJong = JONGSUNG[jong];
        const combinationKey = currentJong + newChar;
        const combinedJong = JONGSUNG_COMBINATIONS[combinationKey];

        if (combinedJong) {
          // 복합 종성 조합 가능한 경우
          const newJongsungIndex = JONGSUNG.indexOf(combinedJong);
          if (newJongsungIndex !== -1) {
            return beforeText + composeHangul(cho, jung, newJongsungIndex);
          }
        } else {
          // 복합 종성 조합이 불가능한 경우, 종성을 분리하여 새로운 글자 시작
          const newLastChar = composeHangul(cho, jung, 0);
          return beforeText + newLastChar + newChar;
        }
      }
    }

    // 마지막 문자가 미완성 자음인 경우 그대로 추가
    return currentText + newChar;
  }

  // 새 입력이 모음인 경우
  if (isJungsung(newChar)) {
    // 마지막 문자가 자음인 경우 (초성)
    if (isChosung(lastChar)) {
      const chosungIndex = CHOSUNG.indexOf(lastChar);
      const jungsungIndex = JUNGSUNG.indexOf(newChar);
      if (chosungIndex !== -1 && jungsungIndex !== -1) {
        return beforeText + composeHangul(chosungIndex, jungsungIndex, 0);
      }
    }

    // 마지막 문자가 완성된 한글인 경우
    if (isHangul(lastChar)) {
      const [cho, jung, jong] = decomposeHangul(lastChar);

      // 종성이 있는 경우, 종성을 초성으로 하는 새 글자 시작
      if (jong > 0) {
        const jongChar = JONGSUNG[jong];
        const newChosungIndex = CHOSUNG.indexOf(jongChar);
        const newJungsungIndex = JUNGSUNG.indexOf(newChar);

        if (newChosungIndex !== -1 && newJungsungIndex !== -1) {
          const newLastChar = composeHangul(cho, jung, 0);
          const newChar2 = composeHangul(newChosungIndex, newJungsungIndex, 0);
          return beforeText + newLastChar + newChar2;
        }
      } else {
        // 복합 모음 조합 시도
        const currentJung = JUNGSUNG[jung];
        const combinationKey = currentJung + newChar;
        const combinedJung = JUNGSUNG_COMBINATIONS[combinationKey];

        if (combinedJung) {
          const newJungsungIndex = JUNGSUNG.indexOf(combinedJung);
          if (newJungsungIndex !== -1) {
            return beforeText + composeHangul(cho, newJungsungIndex, jong);
          }
        }
      }
    }

    return currentText + newChar;
  }

  // 새 입력이 일반 문자인 경우
  return currentText + newChar;
};

interface CharacterInteractionProps {
  character: Character | null;
  characterId: string;
  existingImage?: string;
}

export default function CharacterInteraction({
  character,
  characterId,
  existingImage,
}: CharacterInteractionProps) {
  const router = useRouter();
  const [isMicActive, setIsMicActive] = useState(false);
  const [situation, setSituation] = useState("");
  const [showPromptContent, setShowPromptContent] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFaceSwapping, setIsFaceSwapping] = useState(false);
  const [modalInput, setModalInput] = useState("");
  const [isKeyboardPressed, setIsKeyboardPressed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { playSound } = useButtonSound();
  const { setMuted } = useAudioStore();
  const {
    isRecording,
    transcript,
    isProcessing,
    timeLeft,
    toggleRecording,
    setTranscript,
  } = useVoiceRecognition();

  // existingImage가 있으면 자동으로 페이스 스왑 진행
  useEffect(() => {
    const processExistingImage = async () => {
      if (!existingImage || isFaceSwapping || !characterId) {
        return;
      }

      setIsFaceSwapping(true);

      try {
        // 1. image 테이블에 job_id 저장
        const saveResult = await saveImageRecord(existingImage);

        if (!saveResult.success || !saveResult.jobId) {
          toast({
            title: "이미지 저장 실패",
            description: saveResult.error || "이미지 저장에 실패했습니다.",
          });
          setIsFaceSwapping(false);
          return;
        }

        // 2. AWS API에 이미지 처리 요청 (초기 생성이므로 regenerationCount = 2)
        const awsResult = await requestImageProcessing(
          existingImage,
          characterId,
          "재생성", // situation은 재생성으로 설정
          saveResult.jobId,
          2 // 초기 생성
        );

        if (!awsResult.success) {
          toast({
            title: "이미지 처리 요청 실패",
            description: awsResult.error || "이미지 처리 요청에 실패했습니다.",
          });
          setIsFaceSwapping(false);
          return;
        }

        // 3. 결과 대기
        const pollingResult = await pollForImageResult(saveResult.jobId, {
          maxAttempts: 60,
          intervalMs: 5000,
        });

        if (pollingResult.success && pollingResult.data?.result) {
          const resultData = pollingResult.data.result;

          let backgroundImageUrl = "";

          if (resultData.background_removed_image_url) {
            backgroundImageUrl = resultData.background_removed_image_url;
          } else if (resultData.result_image_url) {
            backgroundImageUrl = resultData.result_image_url;
          }

          if (backgroundImageUrl) {
            router.push(
              `/complete?character=${characterId}&backgroundImage=${encodeURIComponent(
                backgroundImageUrl
              )}&jobId=${saveResult.jobId}`
            );
          } else {
            toast({
              title: "이미지 URL을 찾을 수 없습니다",
              description: "생성된 이미지 URL을 찾을 수 없습니다.",
            });
            setIsFaceSwapping(false);
          }
        } else {
          toast({
            title: "이미지 생성 실패",
            description: "이미지 생성에 실패했습니다.",
          });
          setIsFaceSwapping(false);
        }
      } catch (error) {
        toast({
          title: "오류 발생",
          description:
            error instanceof Error
              ? error.message
              : "알 수 없는 오류가 발생했습니다.",
        });
        setIsFaceSwapping(false);
      }
    };

    processExistingImage();
  }, [existingImage, characterId, isFaceSwapping, router]);

  // 음성 인식 결과를 상황 설명으로 설정 (녹음이 끝났을 때만)
  useEffect(() => {
    if (transcript && !isRecording) {
      setSituation(transcript);
      setShowPromptContent(true);
    }
  }, [transcript, isRecording]);

  // 음성 인식 상태에 따라 배경 음악 음소거 처리
  useEffect(() => {
    setMuted(isRecording);
  }, [isRecording, setMuted]);

  // 모달이 열릴 때 텍스트 영역에 포커스하여 시스템 키보드 띄우기
  useEffect(() => {
    if (isModalOpen && textareaRef.current) {
      // 약간의 지연 후 포커스 (모달 애니메이션 완료 후)
      setTimeout(() => {
        textareaRef.current?.focus();
        // 모바일에서 키보드를 강제로 띄우기 위한 추가 처리
        textareaRef.current?.click();
      }, 100);
    }
  }, [isModalOpen]);

  // 마이크 아이콘 클릭 처리
  const handleMicClick = () => {
    playSound();
    setIsMicActive(!isMicActive);

    if (!isRecording) {
      setShowPromptContent(false);
      toggleRecording();
      toast({
        title: "녹음 시작",
        description: "말씀해주세요. 음성을 인식합니다.",
      });
    } else {
      toggleRecording();
      toast({
        title: "녹음 중지",
        description: "음성 인식을 중지했습니다.",
      });
      // 녹음이 완전히 중지되면 useEffect에서 자동으로 처리됨
    }
  };

  // 키보드 버튼 클릭 처리
  const handleKeyboardClick = () => {
    playSound();
    setModalInput(situation);
    setIsKeyboardPressed(true);
    setIsModalOpen(true);
  };

  // 모달에서 확인 버튼 클릭 처리
  const handleModalConfirm = () => {
    setSituation(modalInput);
    setShowPromptContent(true);
    setIsModalOpen(false);
    setIsKeyboardPressed(false);
    toast({
      title: "입력 완료",
      description: "상황이 설정되었습니다.",
    });
  };

  // 모달에서 취소 버튼 클릭 처리
  const handleModalCancel = () => {
    setModalInput("");
    setIsModalOpen(false);
    setIsKeyboardPressed(false);
  };

  // 입력완료 버튼 클릭 처리
  const handleCompleteClick = () => {
    if (!situation.trim()) {
      toast({
        title: "입력 필요",
        description: "상황을 입력해주세요.",
      });
      return;
    }

    playSound();
    setTimeout(() => {
      router.push(
        `/camera?character=${characterId}&situation=${encodeURIComponent(
          situation
        )}`
      );
    }, 300);
  };

  // 캐릭터 정보가 없거나 이미지 처리 중이면 로딩 표시
  if (!character || isFaceSwapping) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-8">
        <Loader2 className="w-40 h-40 animate-spin text-[#481F0E]" />
        {isFaceSwapping && (
          <div className="text-[64px] text-[#481F0E] font-bold">
            이미지 생성 중...
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* 캐릭터 정보 표시 */}
      <div className="flex flex-col items-center justify-center z-30 mt-[300px]">
        <div
          className="text-[260px] font-bold text-center text-[#481F0E]"
          style={{ fontFamily: "MuseumClassic, serif" }}
        >
          {formatRoleWithSpaces(character.role || "")}
        </div>
        <div
          style={{ whiteSpace: "pre-line", fontFamily: "MuseumClassic, serif" }}
          className="text-[80px] font-bold text-center text-[#481F0E]"
        >
          {character.description}
        </div>
      </div>

      {/* 캐릭터 이미지 */}
      <div className="relative w-[1100px] h-[1650px]">
        <Image
          src={character.picture_character || `/detail${character.order}.png`}
          alt="role"
          fill
          className="object-contain z-0"
          priority
          unoptimized
        />
      </div>

      {/* 상황 입력 프롬프트 */}
      <div className="prompt flex flex-col items-center justify-center z-30 border-[25px] border-[#D3B582] rounded-[60px] w-[1666px] h-[390px] relative">
        {isRecording ? (
          <div className="flex flex-col items-center justify-center w-full h-full gap-8">
            <div className="flex flex-col items-center gap-4">
              {transcript && (
                <div className="text-[79px] font-bold text-center text-[#481F0E]">
                  {transcript}
                </div>
              )}
              <div className="text-[48px] font-bold text-[#481F0E]/70">
                남은 시간: {timeLeft}초
              </div>
            </div>
          </div>
        ) : showPromptContent ? (
          <>
            {!situation ? (
              <>
                <div className="text-[79px] font-bold text-center text-[#481F0E]">
                  캐릭터에 어떤 상황을 설정하고 싶으신가요?
                </div>
                <div
                  className="text-[72px] font-bold text-center text-[#481F0E]/50"
                  style={{ letterSpacing: "-0.03em" }}
                >
                  예: {character?.prompt}
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div
                  className="text-[79px] font-bold text-center text-[#481F0E]"
                  style={{ letterSpacing: "-0.03em" }}
                >
                  {situation}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full gap-8">
            <Loader2 className="w-40 h-40 animate-spin text-[#481F0E]" />
          </div>
        )}
      </div>

      {/* 상호작용 버튼들 */}
      <div className="flex items-center justify-center z-30 flex-row mb-[358px] mt-[191px] gap-8">
        {/* 마이크 버튼 */}
        <div
          className="relative w-[387px] h-[281px] cursor-pointer"
          onClick={handleMicClick}
        >
          <Image
            src={isRecording ? "/mic2.png" : "/mic.png"}
            fill
            alt="mic"
            className="object-contain"
          />
        </div>

        {/* 입력완료 버튼 */}
        <div>
          <Button
            onClick={handleCompleteClick}
            disabled={!situation.trim()}
            className={`w-[899px] h-[281px] text-[128px] font-bold z-20 rounded-[60px] border-5 ${
              situation.trim()
                ? "text-[#451F0D] bg-[#E4BE50] border-[#471F0D] hover:bg-[#D4AE40]"
                : "text-[#451F0D]/50 bg-[#E4BE50]/50 border-[#471F0D]/50 cursor-not-allowed"
            }`}
          >
            시작하기
          </Button>
        </div>

        {/* 키보드 버튼과 모달 */}
        <Dialog
          open={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) {
              setIsKeyboardPressed(false);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              onClick={handleKeyboardClick}
              className="relative w-[387px] h-[281px] p-0 bg-transparent hover:bg-transparent border-none"
            >
              <Image
                src={isKeyboardPressed ? "/keyboard2.png" : "/keyboard.png"}
                fill
                alt="keyboard"
                className="object-contain"
              />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[1800px] px-[100px]  max-h-[1200px] bg-[#F5E6D3] border-[#D3B582] border-4">
            <DialogHeader>
              <DialogTitle className="text-[120px] font-bold text-[#481F0E] text-center mb-8">
                상황 입력
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-12 py-8">
              {/* 텍스트 입력 영역 */}
              <Textarea
                ref={textareaRef}
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
                placeholder="캐릭터에 설정할 상황을 입력해주세요."
                className="min-h-[400px] bg-white border-[#D3B582] border-4 text-[#481F0E] placeholder:text-[#481F0E]/50 resize-none"
                style={{
                  fontSize: "85px",
                  lineHeight: "1.4",
                  padding: "32px",
                }}
                autoFocus
                // 키오스크/터치 디바이스에서 가상 키보드를 띄우기 위한 속성들
                inputMode="text"
                enterKeyHint="done"
              />

              {/* 버튼 영역 */}
              <div className="flex justify-center gap-12">
                <Button
                  onClick={handleModalCancel}
                  variant="outline"
                  className="w-[200px] h-[100px] text-[60px] font-bold text-[#481F0E] bg-white border-[#D3B582] border-4 hover:bg-[#F5E6D3]"
                  style={{ fontFamily: "Noto Sans KR, serif" }}
                >
                  취소
                </Button>
                <Button
                  onClick={handleModalConfirm}
                  className="w-[200px] h-[100px] text-[60px] font-bold text-[#451F0D] bg-[#E4BE50] border-[#471F0D] border-4 hover:bg-[#D4AE40]"
                  style={{ fontFamily: "Noto Sans KR, serif" }}
                >
                  확인
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
