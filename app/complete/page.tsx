"use client";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense, useRef, useCallback } from "react";
import QRCodeComponent from "@/components/QRCode";
import { useButtonSound } from "@/app/components/ButtonSound";
import domtoimage from "dom-to-image-more";
import { toast } from "@/components/ui/use-toast";
import { MessageResponse, Character, CharacterResponse } from "./types";
import { IoMdRefresh } from "react-icons/io";
import { useImageStore } from "@/app/store/useImageStore";
import { saveImageRecord, pollForImageResult, requestImageProcessing } from "@/utils/imagePolling";
import Lottie from "lottie-react";
import loaderAnimation from "@/public/loader.json";

function CompletePageContent() {
  const router = useRouter();
  const {
    characterId: storedCharacterId,
    situation: storedSituation,
    backgroundRemovedImageUrl: storedImageUrl,
    refreshCount,
    decrementRefreshCount
  } = useImageStore();
  const [isMicActive, setIsMicActive] = useState(false);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [showCharacter, setShowCharacter] = useState(false);
  const [skill1Value, setSkill1Value] = useState(0);
  const [skill2Value, setSkill2Value] = useState(0);
  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState(""); // QR 코드에 표시될 URL
  const [uploadUrl, setUploadUrl] = useState(""); // presigned 업로드 URL
  const [uploadToken, setUploadToken] = useState(""); // 업로드 토큰
  const [filePath, setFilePath] = useState(""); // 파일 경로 추가
  const [isImageUploadComplete, setIsImageUploadComplete] = useState(false); // 단일 상태로 변경
  const [isQrReady, setIsQrReady] = useState(false); // QR 코드 준비 상태 추가
  const [showQrInCard, setShowQrInCard] = useState(false); // 포토카드에 QR 표시 여부
  const [debugInfo, setDebugInfo] = useState<string[]>([]); // 디버깅 정보
  const [isPrinting, setIsPrinting] = useState(false); // 출력 상태 추가
  const [randomMessage, setRandomMessage] = useState<string>(""); // 랜덤 메시지 상태
  const { playSound } = useButtonSound();
  const searchParams = useSearchParams();
  const characterId = searchParams.get("character");
  const situationParam = searchParams.get("situation");
  const imageParam = searchParams.get("image");
  const resultImageParam = searchParams.get("resultImage");
  const backgroundImageParam = searchParams.get("backgroundImage");
  const [backgroundRemovedImageUrl, setBackgroundRemovedImageUrl] =
    useState<string>("");
  const photoCardRef = useRef<HTMLDivElement>(null);
  const fullScreenRef = useRef<HTMLDivElement>(null);

  // 랜덤 메시지 가져오기 함수
  const fetchRandomMessage = async () => {
    try {
      const response = await fetch("/api/messages/random");
      if (response.ok) {
        const data: MessageResponse = await response.json();
        setRandomMessage(data.message);
      }
    } catch (error) {
      // 에러 발생 시 기본 메시지 유지
      setRandomMessage("경상좌수영 수군 출전 준비 완료!");
    }
  };

  // Character 데이터 가져오기 함수
  const fetchCharacter = async (characterId: string) => {
    try {
      const response = await fetch(`/api/characters/${characterId}`);
      if (response.ok) {
        const data: CharacterResponse = await response.json();
        setCharacter(data.character);

        // 스킬 값 설정 (min과 max 사이의 랜덤 값)
        if (data.character.ability1_min && data.character.ability1_max) {
          const randomSkill1 = Math.floor(
            Math.random() *
              (data.character.ability1_max - data.character.ability1_min + 1) +
              data.character.ability1_min
          );
          setSkill1Value(randomSkill1);
        }

        if (data.character.ability2_min && data.character.ability2_max) {
          const randomSkill2 = Math.floor(
            Math.random() *
              (data.character.ability2_max - data.character.ability2_min + 1) +
              data.character.ability2_min
          );
          setSkill2Value(randomSkill2);
        }
      } else {
        // API 실패 시 기본값 설정
        setSkill1Value(Math.floor(Math.random() * 201 + 100));
        setSkill2Value(Math.floor(Math.random() * 201 + 100));
      }
    } catch (error) {
      // 에러 발생 시 기본값 설정
      setSkill1Value(Math.floor(Math.random() * 201 + 100));
      setSkill2Value(Math.floor(Math.random() * 201 + 100));
    }
  };

  // 출력 상태를 localStorage에서 확인하고 복원
  useEffect(() => {
    const printingState = localStorage.getItem("isPrinting");
    const printingStartTime = localStorage.getItem("printingStartTime");

    if (printingState === "true" && printingStartTime) {
      const startTime = parseInt(printingStartTime);
      const currentTime = Date.now();
      const elapsedTime = currentTime - startTime;

      // 60초가 지나지 않았다면 출력 상태 유지
      if (elapsedTime < 60000) {
        setIsPrinting(true);

        // 남은 시간만큼 타이머 설정
        const remainingTime = 60000 - elapsedTime;
        setTimeout(() => {
          setIsPrinting(false);
          localStorage.removeItem("isPrinting");
          localStorage.removeItem("printingStartTime");
        }, remainingTime);
      } else {
        // 60초가 지났다면 상태 정리
        localStorage.removeItem("isPrinting");
        localStorage.removeItem("printingStartTime");
      }
    }
  }, []);

  // 디버깅 정보 추가 함수
  const addDebugInfo = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const debugMessage = `[${timestamp}] ${message}`;
    console.log(debugMessage);
    setDebugInfo((prev) => [...prev.slice(-4), debugMessage]); // 최근 5개만 유지
  }, []);

  // 컴포넌트 마운트 시 캐릭터 정보 로드
  useEffect(() => {
    if (characterId) {
      fetchCharacter(characterId);
    } else {
      // characterId가 없는 경우 기본값 설정
      setSkill1Value(Math.floor(Math.random() * 201 + 100));
      setSkill2Value(Math.floor(Math.random() * 201 + 100));
    }
  }, [characterId]);

  // 랜덤 메시지 로드
  useEffect(() => {
    fetchRandomMessage();
  }, []);

  // 이미지 파라미터에서 background_removed_image_url 설정
  useEffect(() => {
    // backgroundImageParam이 있으면 직접 사용 (새로운 방식)
    if (backgroundImageParam) {
      const decodedUrl = decodeURIComponent(backgroundImageParam);
      addDebugInfo(`background_removed_image_url 직접 사용: ${decodedUrl}`);
      setBackgroundRemovedImageUrl(decodedUrl);
    }
    // 기존 resultImageParam 처리 (하위 호환성)
    else if (resultImageParam) {
      try {
        // resultImageParam이 JSON 문자열인 경우 파싱
        const apiResponse = JSON.parse(decodeURIComponent(resultImageParam));
        console.log("apiResponse:", apiResponse);

        // API 응답 구조에 따라 background_removed_image_url 추출
        let backgroundImageUrl = "";

        if (
          apiResponse.result &&
          apiResponse.result.background_removed_image_url
        ) {
          // camera 페이지에서 { result: resultData } 형태로 넘어온 경우
          backgroundImageUrl = apiResponse.result.background_removed_image_url;
          addDebugInfo(
            `background_removed_image_url 추출 (nested): ${backgroundImageUrl}`
          );
        } else if (apiResponse.background_removed_image_url) {
          // API 응답이 직접 넘어온 경우
          backgroundImageUrl = apiResponse.background_removed_image_url;
          addDebugInfo(
            `background_removed_image_url 추출 (direct): ${backgroundImageUrl}`
          );
        }

        if (backgroundImageUrl) {
          setBackgroundRemovedImageUrl(backgroundImageUrl);
        } else {
          addDebugInfo(`background_removed_image_url을 찾을 수 없음`);
          // 대안으로 result_image_url 시도
          if (apiResponse.result && apiResponse.result.result_image_url) {
            setBackgroundRemovedImageUrl(apiResponse.result.result_image_url);
            addDebugInfo(
              `대안으로 result_image_url 사용: ${apiResponse.result.result_image_url}`
            );
          } else if (apiResponse.result_image_url) {
            setBackgroundRemovedImageUrl(apiResponse.result_image_url);
            addDebugInfo(
              `대안으로 result_image_url 사용 (direct): ${apiResponse.result_image_url}`
            );
          }
        }
      } catch (error) {
        // JSON 파싱 실패 시 원본 URL을 그대로 사용
        addDebugInfo(`JSON 파싱 실패, 원본 URL 사용: ${resultImageParam}`);
        setBackgroundRemovedImageUrl(resultImageParam);
      }
    }
  }, [backgroundImageParam, resultImageParam, addDebugInfo]);

  // 이미지 파라미터가 있으면 QR 코드 URL 업데이트 및 상태 설정
  useEffect(() => {
    if (imageParam) {
      addDebugInfo(`이미지 파라미터 감지: ${imageParam}`);
      setQrCodeUrl(imageParam);
      setShowQrInCard(true);
    } else if (backgroundImageParam || resultImageParam) {
      addDebugInfo(
        `배경 이미지 또는 결과 이미지 파라미터 감지: ${
          backgroundImageParam || resultImageParam
        }`
      );
      // backgroundImageParam 또는 resultImageParam이 있어도 QR 코드 URL은 설정하지 않음 (새로 생성해야 함)
      setShowQrInCard(true);
      // isImageUploadComplete를 true로 설정하지 않음 - 새로운 포토카드를 업로드해야 함
    }
  }, [imageParam, backgroundImageParam, resultImageParam]);

  // 페이지 로드 시 이미지가 아직 캡처되지 않았고 이미지 파라미터도 없는 경우 자동으로 프로세스 시작
  useEffect(() => {
    const autoStart = async () => {
      // 이미 프로세스가 시작되었거나 이미지 파라미터가 있는 경우 실행하지 않음
      // backgroundImageParam 또는 resultImageParam이 있는 경우에는 새로운 포토카드를 생성해야 하므로 프로세스 실행
      if (isImageUploadComplete || imageParam) {
        return;
      }

      addDebugInfo("자동 프로세스 시작 준비");
      // 렌더링이 완전히 끝난 후 실행하기 위해 충분한 지연 추가
      const timer = setTimeout(() => {
        addDebugInfo("자동 프로세스 시작");
        generatePresignedUrlAndCapture();
      }, 2000);

      return () => clearTimeout(timer);
    };

    // DOM이 준비된 후 실행
    // backgroundImageParam 또는 resultImageParam이 있어도 새로운 포토카드를 생성해야 하므로 조건에서 제외
    if (photoCardRef.current && !isImageUploadComplete && !imageParam) {
      autoStart();
    }
  }, [isImageUploadComplete, imageParam]); // backgroundImageParam, resultImageParam 의존성 제거

  // 2단계: 이미지 캡처 및 업로드
  const captureAndUploadImage = useCallback(async () => {
    try {
      addDebugInfo("이미지 캡처 시작");
      setIsLoading(true);

      // photo-card 요소만 캡처
      const targetElement = photoCardRef.current;

      if (!targetElement) {
        addDebugInfo("캡처 대상 요소를 찾을 수 없음");
        return;
      }

      // 렌더링이 완전히 끝날 때까지 대기
      await new Promise((resolve) => setTimeout(resolve, 1000));

      addDebugInfo("Canvas 변환 시작");
      // dom-to-image를 사용해서 이미지 생성
      const dataUrl = await domtoimage.toPng(targetElement, {
        bgcolor: "#F9D5AA",
        width: 1594,
        height: 2543,
        quality: 1.0,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          width: "1594px",
          height: "2543px",
        },
      });

      addDebugInfo("이미지 변환 완료, 업로드 준비");

      // DataURL을 Blob으로 변환
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // 파일 객체 생성
      const file = new File([blob], "photo-card.png", { type: "image/png" });

      // FormData 생성
      const formData = new FormData();
      formData.append("file", file);
      formData.append("uploadUrl", uploadUrl);

      addDebugInfo(
        `업로드 시작 - 파일 크기: ${file.size} bytes, 업로드 URL 길이: ${uploadUrl.length}`
      );

      // presigned URL을 사용해서 이미지 업로드 (재시도 로직 추가)
      let uploadResult;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          const uploadResponse = await fetch(
            "https://u90nizmnql.execute-api.ap-northeast-2.amazonaws.com/upload-with-presigned",
            {
              method: "POST",
              body: formData,
            }
          );

          addDebugInfo(
            `업로드 시도 ${retryCount + 1}: 응답 상태 ${uploadResponse.status}`
          );

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            addDebugInfo(`업로드 응답 에러: ${errorText}`);
          }

          uploadResult = await uploadResponse.json();

          if (uploadResult.success) {
            addDebugInfo("이미지 업로드 성공");
            return;
          } else {
            addDebugInfo(
              `업로드 실패 (시도 ${retryCount + 1}): ${uploadResult.error}`
            );
          }

          break;
        } catch (networkError) {
          retryCount++;
          addDebugInfo(
            `업로드 네트워크 에러 (시도 ${retryCount}): ${
              networkError instanceof Error
                ? networkError.message
                : "Unknown error"
            }`
          );

          if (retryCount < maxRetries) {
            addDebugInfo(`${2000 * retryCount}ms 후 재시도...`);
            await new Promise((resolve) =>
              setTimeout(resolve, 2000 * retryCount)
            );
          }
        }
      }

      if (!uploadResult?.success) {
        addDebugInfo(`모든 업로드 시도 실패 (${maxRetries}회)`);
        // 실패해도 일단 완료 상태로 설정 (사용자 경험을 위해)
        setIsImageUploadComplete(true);
      }
    } catch (error) {
      addDebugInfo(
        `이미지 캡처 및 업로드 에러: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      // 에러가 발생해도 완료 상태로 설정 (사용자 경험을 위해)
    } finally {
      setIsLoading(false);
      setIsImageUploadComplete(true);
    }
  }, [uploadUrl, addDebugInfo]);

  // QR 코드가 준비된 후 이미지 캡처 및 업로드
  useEffect(() => {
    // 이미 완료된 경우 실행하지 않음
    if (isImageUploadComplete) {
      return;
    }
    console.log("qrCodeUrl:", qrCodeUrl);

    if (qrCodeUrl) {
      addDebugInfo(
        `QR 코드 준비 완료, 이미지 캡처 시작 - isLoading: ${isLoading}`
      );

      captureAndUploadImage();
    }
  }, [qrCodeUrl]); // captureAndUploadImage 의존성 제거

  // QR 코드 준비 완료 콜백
  const handleQrReady = () => {
    addDebugInfo("QR 코드 렌더링 완료");
    setIsQrReady(true);

    // 대체 트리거: useEffect가 실행되지 않는 경우를 대비해 직접 호출
    if (!isImageUploadComplete && qrCodeUrl) {
      setTimeout(() => {
        addDebugInfo("대체 트리거 실행 - 직접 이미지 캡처 호출");
        captureAndUploadImage();
      }, 2000);
    }
  };

  // QR 코드 URL이 변경될 때 준비 상태 초기화
  useEffect(() => {
    if (qrCodeUrl) {
      setIsQrReady(false);
      addDebugInfo(`QR 코드 URL 설정: ${qrCodeUrl.substring(0, 50)}...`);
    }
  }, [qrCodeUrl]);

  // 1단계: presigned URL 생성 및 QR 코드 설정
  const generatePresignedUrlAndCapture = async () => {
    try {
      addDebugInfo("presigned URL 생성 시작");
      setIsLoading(true);

      // presigned URL 생성 요청
      const response = await fetch("/api/generate-presigned-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      addDebugInfo(`API 응답 상태: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        addDebugInfo(`API 응답 에러: ${errorText}`);
        return;
      }

      const result = await response.json();

      if (result.success) {
        addDebugInfo(
          `presigned URL 생성 성공: ${result.publicUrl.substring(0, 50)}...`
        );

        // 상태 업데이트
        setQrCodeUrl(result.publicUrl);
        setUploadUrl(result.uploadUrl);
        setUploadToken(result.token);
        setFilePath(result.filePath);
        setShowQrInCard(true);

        // URL 파라미터에 이미지 URL 추가
        const currentUrl = window.location.href;
        const url = new URL(currentUrl);
        url.searchParams.set("image", result.publicUrl);

        // 현재 페이지를 새 URL로 대체
        window.history.replaceState({}, "", url.toString());

        addDebugInfo("QR 코드 렌더링 대기 중");
      } else {
        addDebugInfo(`presigned URL 생성 에러: ${result.error}`);
      }
    } catch (error) {
      addDebugInfo(
        `presigned URL 생성 네트워크 에러: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransform = () => {
    playSound();

    // 출력 상태를 즉시 설정하고 localStorage에 저장
    setIsPrinting(true);
    const startTime = Date.now();
    localStorage.setItem("isPrinting", "true");
    localStorage.setItem("printingStartTime", startTime.toString());

    // 상태 업데이트가 확실히 반영된 후 프린트 실행
    setTimeout(() => {
      handlePrint();
    }, 100);

    // 60초 후 출력 상태 해제
    setTimeout(() => {
      setIsPrinting(false);
      localStorage.removeItem("isPrinting");
      localStorage.removeItem("printingStartTime");
    }, 60000);
  };

  const handleGoHome = () => {
    playSound();
    setTimeout(() => {
      router.push("/");
    }, 300);
  };

  const handleRegenerate = async () => {
    playSound();

    console.log('=== Regenerate 시작 ===');
    console.log('storedCharacterId:', storedCharacterId);
    console.log('storedImageUrl:', storedImageUrl);
    console.log('storedSituation:', storedSituation);
    console.log('refreshCount:', refreshCount);

    if (!storedCharacterId || !storedImageUrl) {
      console.log('저장된 정보 없음');
      toast({
        title: "재생성 불가",
        description: "저장된 이미지 정보가 없습니다.",
      });
      return;
    }

    if (refreshCount <= 0) {
      console.log('재생성 횟수 초과');
      toast({
        title: "재생성 불가",
        description: "재생성 횟수를 모두 사용했습니다.",
      });
      return;
    }

    setIsRegenerating(true);
    console.log('재생성 상태 설정 완료');

    try {
      // 1. image 테이블에 job_id 저장
      console.log('1. saveImageRecord 호출');
      const saveResult = await saveImageRecord(storedImageUrl);
      console.log('saveResult:', saveResult);

      if (!saveResult.success || !saveResult.jobId) {
        console.log('이미지 저장 실패');
        toast({
          title: "이미지 저장 실패",
          description: saveResult.error || "이미지 저장에 실패했습니다.",
        });
        setIsRegenerating(false);
        return;
      }

      // 2. AWS API에 이미지 처리 요청
      console.log('2. requestImageProcessing 호출');
      const awsResult = await requestImageProcessing(
        storedImageUrl,
        storedCharacterId,
        storedSituation || "재생성",
        saveResult.jobId
      );
      console.log('awsResult:', awsResult);

      if (!awsResult.success) {
        console.log('AWS API 요청 실패');
        toast({
          title: "이미지 처리 요청 실패",
          description: awsResult.error || "이미지 처리 요청에 실패했습니다.",
        });
        setIsRegenerating(false);
        return;
      }

      // 3. 결과 대기
      console.log('3. pollForImageResult 시작');
      const pollingResult = await pollForImageResult(
        saveResult.jobId,
        {
          maxAttempts: 60,
          intervalMs: 5000,
        }
      );
      console.log('pollingResult:', pollingResult);

      if (pollingResult.success && pollingResult.data?.result) {
        const resultData = pollingResult.data.result;
        console.log('4. 결과 데이터:', resultData);

        let backgroundImageUrl = '';

        if (resultData.background_removed_image_url) {
          backgroundImageUrl = resultData.background_removed_image_url;
        } else if (resultData.result_image_url) {
          backgroundImageUrl = resultData.result_image_url;
        }

        console.log('backgroundImageUrl:', backgroundImageUrl);

        if (backgroundImageUrl) {
          console.log('5. 새로운 이미지 설정');
          // 새로운 이미지로 페이지 리로드
          setBackgroundRemovedImageUrl(backgroundImageUrl);
          // QR 코드도 새로 생성해야 하므로 초기화
          setIsImageUploadComplete(false);
          // presigned URL 새로 생성
          console.log('6. presigned URL 생성 시작');
          await generatePresignedUrlAndCapture();

          // 재생성 성공 시 카운트 감소
          decrementRefreshCount();
          console.log('재생성 카운트 감소됨:', refreshCount - 1);

          toast({
            title: "재생성 완료",
            description: "새로운 이미지가 생성되었습니다.",
          });
        } else {
          console.log('이미지 URL 없음');
          toast({
            title: "이미지 URL을 찾을 수 없습니다",
            description: "생성된 이미지 URL을 찾을 수 없습니다.",
          });
        }
      } else {
        console.log('polling 실패:', pollingResult);
        toast({
          title: "이미지 생성 실패",
          description: "이미지 생성에 실패했습니다.",
        });
      }
    } catch (error) {
      console.error('재생성 에러:', error);
      toast({
        title: "오류 발생",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      });
    } finally {
      console.log('재생성 완료');
      setIsRegenerating(false);
    }
  };

  // 모든 프로세스가 완료되었는지 확인
  const isAllProcessComplete = isImageUploadComplete;

  useEffect(() => {
    if (isCountingDown && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isCountingDown && countdown === 0) {
      setShowCharacter(true);
      setTimeout(() => {
        router.push("/complete");
      }, 2000); // 캐릭터를 2초간 보여준 후 이동
    }
  }, [isCountingDown, countdown, router]);

  // 디버깅을 위한 상태 표시
  const getStatusMessage = () => {
    return isImageUploadComplete ? "완료!" : "이미지 업로드중...";
  };

  // 이미지 다운로드 기능 추가 - html2canvas 개선된 버전
  const handleDownloadImage = async () => {
    try {
      playSound();

      const targetElement = photoCardRef.current;
      if (!targetElement) {
        toast({
          title: "오류",
          description: "이미지를 생성할 수 없습니다.",
          variant: "destructive",
        });
        return;
      }

      // 폰트 로딩과 렌더링이 완전히 끝날 때까지 충분히 대기
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 추가로 폰트 로딩 완료 확인
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // 추가 대기 시간
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // dom-to-image를 사용해서 보이는 그대로 이미지 생성
      const dataUrl = await domtoimage.toPng(targetElement, {
        bgcolor: "#F9D5AA",
        width: 1594,
        height: 2543,
        quality: 1.0,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          width: "1594px",
          height: "2543px",
        },
        filter: (node) => {
          // 불필요한 요소 제외
          const element = node as Element;
          if (element.tagName === "SCRIPT" || element.tagName === "STYLE") {
            return false;
          }
          // img 요소의 경우 border 스타일 제거
          if (element.tagName === "IMG") {
            const imgElement = element as HTMLImageElement;
            if (imgElement.style) {
              imgElement.style.border = "none";
              imgElement.style.outline = "none";
              imgElement.style.boxShadow = "none";
            }
          }
          return true;
        },
      });

      // DataURL을 Blob으로 변환
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // 다운로드 링크 생성
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `포토카드_${
        character?.role || "character"
      }_${new Date().getTime()}.png`;
      link.href = url;

      // 다운로드 실행
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // URL 정리
      URL.revokeObjectURL(url);

      toast({
        title: "다운로드 완료",
        description: "포토카드 이미지가 다운로드되었습니다.",
      });
    } catch (error) {
      toast({
        title: "오류",
        description: "이미지 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 프린트 기능 추가 - 양면 인쇄
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      return;
    }

    if (!qrCodeUrl) {
      return;
    }

    // 양면 인쇄용 HTML 생성
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>포토카드 양면 출력</title>
          <meta charset="utf-8">
          <style>
            @page {
              size: 245px 386px;
              margin: 0;
              padding: 0;
            }
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              background: white;
              font-family: Arial, sans-serif;
            }
            
            .print-container {
              width: 100%;
              height: 100%;
            }
            
            .print-page {
              width: 245px;
              height: 386px;
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              page-break-after: always;
              page-break-inside: avoid;
              box-sizing: border-box;
              position: relative;
              overflow: hidden;
              background: white;
            }
            
            .print-page:last-child {
              page-break-after: avoid;
            }
            
            .card-image {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
              object-fit: cover;
              border: none;
              outline: none;
              display: block;
            }
            
            .card-image.back {
              transform: scaleX(-1) scaleY(-1);
            }
            
            .page-info {
              position: absolute;
              top: 5px;
              right: 5px;
              font-size: 12px;
              color: #666;
              background: rgba(255,255,255,0.9);
              padding: 3px 8px;
              border-radius: 4px;
              z-index: 10;
            }
            
            /* 인쇄 시 스타일 */
            @media print {
              .page-info {
                display: none !important;
              }
              
              html, body {
                width: 100% !important;
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
                overflow: visible !important;
              }
              
              .print-container {
                width: 100% !important;
                height: auto !important;
              }
              
              .print-page {
                width: 245px !important;
                height: 386px !important;
                margin: 0 !important;
                padding: 0 !important;
                page-break-after: always !important;
                page-break-inside: avoid !important;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
              }
              
              .print-page:last-child {
                page-break-after: auto !important;
              }
              
              .card-image {
                width: 100% !important;
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                object-fit: cover !important;
                max-width: none !important;
                max-height: none !important;
              }
            }
            
            /* 화면에서만 보이는 안내 메시지 */
            @media screen {
              .print-instruction {
                position: fixed;
                top: 20px;
                left: 20px;
                background: #007bff;
                color: white;
                padding: 15px;
                border-radius: 8px;
                font-size: 14px;
                max-width: 350px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 1000;
                line-height: 1.4;
              }
              
              .print-instruction h3 {
                margin: 0 0 10px 0;
                font-size: 16px;
                font-weight: bold;
              }
              
              .print-instruction ul {
                margin: 0;
                padding-left: 20px;
              }
              
              .print-instruction li {
                margin-bottom: 5px;
              }
            }
          </style>
        </head>
        <body>          
          <div class="print-container">
            <!-- 첫 번째 페이지 (앞면) -->
            <div class="print-page">
              <div class="page-info">앞면 - Page 1</div>
              <img src="${qrCodeUrl}" alt="포토카드 앞면" class="card-image" crossorigin="anonymous" />
            </div>
            
            <!-- 두 번째 페이지 (뒷면) -->
            <div class="print-page">
              <div class="page-info">뒷면 - Page 2</div>
              <img src="/print_front.jpg" alt="포토카드 뒷면" class="card-image back" crossorigin="anonymous" />
            </div>
          </div>
          
          <script>
            // 모든 이미지가 로드된 후 자동 인쇄 실행
            let loadedCount = 0;
            const images = document.querySelectorAll('img');
            const totalImages = images.length;
            
            function checkAllLoaded() {
              loadedCount++;
              console.log('이미지 로드됨:', loadedCount + '/' + totalImages);
              
              if (loadedCount === totalImages) {
                console.log('모든 이미지 로드 완료, 인쇄 시작');
                setTimeout(() => {
                  window.print();
                }, 1000);
              }
            }
            
            images.forEach((img, index) => {
              if (img.complete && img.naturalHeight !== 0) {
                console.log('이미지 ' + (index + 1) + ' 이미 로드됨');
                checkAllLoaded();
              } else {
                img.onload = () => {
                  console.log('이미지 ' + (index + 1) + ' 로드 완료');
                  checkAllLoaded();
                };
                img.onerror = () => {
                  console.log('이미지 ' + (index + 1) + ' 로드 실패');
                  checkAllLoaded();
                };
              }
            });
            
            // 안전장치: 5초 후에도 인쇄가 시작되지 않으면 강제 실행
            setTimeout(() => {
              if (loadedCount < totalImages) {
                console.log('타임아웃으로 인한 강제 인쇄 실행');
                window.print();
              }
            }, 5000);
            
            // 인쇄 창 닫기 이벤트 처리
            window.addEventListener('afterprint', () => {
              setTimeout(() => {
                window.close();
              }, 1000);
            });
            
            // ESC 키로 창 닫기
            document.addEventListener('keydown', (e) => {
              if (e.key === 'Escape') {
                window.close();
              }
            });
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };
  console.log("character:", character);

  // role 텍스트에 스페이스를 추가하는 함수
  const formatRoleText = (role: string) => {
    if (!role) {
      return "";
    }

    if (role.length === 2) {
      // 2글자는 3칸 스페이스로 띄우기
      return role.split("").join("   ");
    } else if (role.length === 3) {
      // 3글자는 1칸 스페이스로 띄우기
      return role.split("").join(" ");
    }
    // 그 외는 그대로
    return role;
  };

  return (
    <div
      ref={fullScreenRef}
      className="w-full h-screen relative flex flex-col items-center justify-between"
    >
      <Image
        src="/bg2.webp"
        alt="background"
        fill
        className="object-cover z-0"
        priority
        unoptimized
      />

      <div className="flex flex-col items-center justify-center z-30 mt-[300px]">
        <div
          className="text-[190px] font-bold text-center text-[#481F0E]"
          style={{ fontFamily: "MuseumClassic, serif" }}
        >
          "출전 준비 완료"
        </div>
      </div>

      {isRegenerating ? (
        // 재생성 중일 때 Lottie 애니메이션만 표시
        <div className="absolute top-[582px] w-[1594px] h-[2543px] z-20 flex items-center justify-center">
          <Lottie
            animationData={loaderAnimation}
            loop={true}
            style={{ width: 800, height: 800 }}
          />
        </div>
      ) : (
        // 일반 포토카드 표시
        <div
          ref={photoCardRef}
          className="photo-card absolute top-[582px] w-[1594px] h-[2543px] border-[10px] border-black z-20 rounded-[50px] flex flex-col items-center justify-start bg-[#F9D5AA] pt-8"
          style={{ backgroundColor: "#F9D5AA" }}
        >
          <div
            className="text-[170px] font-bold text-center text-[#481F0E] role-text relative"
            style={{ fontFamily: "MuseumClassic, serif" }}
          >
          {/* title_deco.png 이미지를 글자 중간에 배치 */}
          <img
            src="/title_img.png"
            alt="title decoration"
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-0 flex-shrink-0"
            style={{
              width: "1226px",
              height: "149px",
              minWidth: "1226px",
              minHeight: "149px",
              maxWidth: "1226px",
              maxHeight: "149px",
              border: "none",
              outline: "none",
              boxShadow: "none",
              backgroundColor: "transparent",
            }}
          />
          <span
            className="relative z-10 text-black role-name"
            style={{
              fontFamily: "Galmuri7",
              fontSize: "189px",
              letterSpacing: "-5%",
              border: "none",
              outline: "none",
              boxShadow: "none",
              backgroundColor: "transparent",
            }}
          >
            {formatRoleText(character?.role || "")}
          </span>
        </div>

        <div className="w-[1368px] h-[2070px] z-20 rounded-[50px] mb-[100px] relative overflow-hidden flex flex-col items-center justify-end">
          {/* 별 표시 영역 - QR 코드 위쪽에 세로로 배치 */}
          {character?.star_count && character.star_count > 0 && (
            <div
              className="absolute bottom-[480px] right-[50px] z-30 flex flex-col items-center gap-2"
              style={{
                border: "none",
                outline: "none",
                boxShadow: "none",
                backgroundColor: "transparent",
              }}
            >
              {Array.from({ length: character.star_count }, (_, index) => (
                <div
                  key={index}
                  className="w-[136px] h-[136px] relative"
                  style={{
                    backgroundImage: "url(/star.png)",
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    backgroundColor: "transparent",
                    border: "none",
                    outline: "none",
                    boxShadow: "none",
                  }}
                />
              ))}
            </div>
          )}

          <div
            className="qrcode absolute bottom-0 right-0 w-[460px] h-[460px] bg-[#F9D5AA] z-30 border-[21px] border-black rounded-tl-[50px] rounded-br-[50px] flex items-center justify-center "
            style={{ backgroundColor: "#F9D5AA" }}
          >
            {qrCodeUrl ? (
              <QRCodeComponent
                value={qrCodeUrl}
                size={380}
                className="rounded-lg border-none"
                onReady={handleQrReady}
              />
            ) : (
              <div className="w-[380px] h-[380px] bg-white flex items-center justify-center">
                <div className="text-[24px] text-gray-400">QR 준비중</div>
              </div>
            )}
          </div>

          <div
            className="absolute inset-0 border-[21px] border-black thick-container rounded-[60px] top-[]"
            style={{
              backgroundImage: `url("/card_bg.png")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            <img
              src={
                backgroundRemovedImageUrl || character?.picture_character || ""
              }
              alt={character?.role || "character"}
              className="object-cover w-[1348px] h-[2050px]"
            />
          </div>

          <div className="relative w-full h-[290px]">
            {/* 검정색 윗 테두리를 가진 겹친 div */}
            <div className="absolute top-0 left-0 w-full h-[290px] border-[21px] border-black z-25 rounded-bl-[50px] rounded-br-[50px] ability-frame" />

            <div className="w-full h-[290px] z-20 bg-[#E4BE50] flex flex-row border-none relative">
              {/* 네임택 위 텍스트 */}
              <div
                className="absolute w-[814px] h-[298px] z-30 flex flex-col items-center justify-center bg-[#F7D5AA] rounded-[130px] border-[21px] border-black"
                style={{
                  top: "-350px",
                  left: "32.5%",
                  transform: "translateX(-50%)",
                  fontFamily: "MuseumClassic, serif",
                }}
              >
                <div
                  className="text-[95px] text-[#000000] leading-tight text-center px-10 whitespace-pre-line"
                  style={{
                    fontFamily: "DNFBitBitv2, monospace",
                    whiteSpace: "pre-wrap",
                  }}
                  dangerouslySetInnerHTML={{
                    __html: randomMessage
                      .replace(/\/n/g, "\n") // "/n"을 "\n"으로 변환
                      .split("\n")
                      .join("<br />"),
                  }}
                ></div>
              </div>

              {/* 통합된 ability 영역 */}
              <div className="flex-1 flex flex-row border-none relative h-[287.5px]">
                {/* 왼쪽 ability1 영역 */}
                <div className="flex-1 flex flex-col border-none">
                  {/* 상단 - ability1 */}
                  <div
                    className="flex-1 bg-[#0068B7] flex flex-col items-center justify-center border-none"
                    style={{ fontFamily: "DNFBitBitv2, monospace" }}
                  >
                    <p
                      style={{ fontFamily: "DNFBitBitv2, monospace" }}
                      className="text-[69px] text-white leading-[150%] border-none"
                    >
                      {character?.ability1 || "지도력"}
                    </p>
                  </div>

                  {/* 하단 - skill1Value */}
                  <div
                    className="flex-1 bg-[#BAE3F9] flex flex-col items-center justify-center border-none"
                    style={{ fontFamily: "DNFBitBitv2, monospace" }}
                  >
                    <p
                      style={{ fontFamily: "DNFBitBitv2, monospace" }}
                      className="text-[100px] text-black leading-none border-none"
                    >
                      {skill1Value}
                    </p>
                  </div>
                </div>

                {/* 오른쪽 ability2 영역 */}
                <div className="flex-1 flex flex-col border-none">
                  {/* 상단 - ability2 */}
                  <div
                    className="flex-1 bg-[#0068B7] flex flex-col items-center justify-center border-none"
                    style={{ fontFamily: "DNFBitBitv2, monospace" }}
                  >
                    <p
                      style={{ fontFamily: "DNFBitBitv2, monospace" }}
                      className="text-[69px] text-white leading-[150%] border-none"
                    >
                      {character?.ability2 || "결단력"}
                    </p>
                  </div>

                  {/* 하단 - skill2Value */}
                  <div
                    className="flex-1 bg-[#BAE3F9] flex flex-col items-center justify-center border-none"
                    style={{ fontFamily: "DNFBitBitv2, monospace" }}
                  >
                    <p
                      style={{ fontFamily: "DNFBitBitv2, monospace" }}
                      className="text-[100px] text-black leading-none border-none"
                    >
                      {skill2Value}
                    </p>
                  </div>
                </div>

                {/* 중앙 구분선 - absolute 포지셔닝 */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10">
                  <div className="w-[21px] bg-black h-[220px] rounded-t-full rounded-b-full"></div>
                </div>
              </div>
              <div className="w-[460px] "></div>
            </div>
          </div>
        </div>
        </div>
      )}

      <div className="button-container flex items-center justify-center z-30 flex-row mb-[358px]">
        {!isImageUploadComplete ? (
          <div className="flex flex-col items-center gap-4">
            <div className="text-[128px] text-[#451F0D] font-bold">
              이미지 업로드중...
            </div>
          </div>
        ) : isPrinting ? (
          <div className="flex flex-col items-center gap-4">
            <div className="text-[128px] text-[#451F0D] font-bold">
              출력 중입니다. 잠시만 기다려 주세요.
            </div>
          </div>
        ) : (
          <div className="w-[1594px] flex flex-row items-center justify-between gap-x-12">
            <div className="w-[684px]">
              <Button
                onClick={handleGoHome}
                disabled={isRegenerating}
                className="w-full h-[281px] text-[128px] text-[#451F0D] bg-[#E4BE50] rounded-[60px] font-bold z-20"
              >
                처음으로
              </Button>
            </div>

            <div className="w-[228px] flex flex-col items-center justify-center gap-4">
              <Button
                onClick={() => {
                  console.log('Refresh 버튼 클릭됨!');
                  handleRegenerate();
                }}
                disabled={isRegenerating || refreshCount <= 0}
                className="w-[228px] h-[228px] text-[128px] text-[#451F0D] bg-[#E4BE50] rounded-full font-bold z-20 flex items-center justify-center p-0 overflow-visible disabled:opacity-50 disabled:cursor-not-allowed"
                title="다시 생성"
              >
                <IoMdRefresh style={{ width: '180px', height: '180px' }} />
              </Button>
              
            </div>

            <div className="w-[684px]">
              <Button
                onClick={handleTransform}
                disabled={isRegenerating}
                className="w-full h-[281px] text-[128px] text-[#451F0D] bg-[#E4BE50] rounded-[60px] font-bold z-20"
              >
                출력하기
              </Button>
            </div>
          </div>
        )}

        {/* 이미지 다운로드 버튼 - 완료된 경우에만 표시 */}
        {/* {isImageUploadComplete && !isPrinting && (
          <div>
            <Button
              onClick={handleDownloadImage}
              className="w-[752px] h-[281px] text-[120px] text-[#451F0D] bg-[#D4A843] hover:bg-[#C49739] rounded-[60px] font-bold z-20"
            >
              이미지 저장
            </Button>
          </div>
        )} */}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen flex items-center justify-center text-[64px]"></div>
      }
    >
      <CompletePageContent />
    </Suspense>
  );
}
