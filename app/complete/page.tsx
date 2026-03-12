"use client";
import { Suspense, use, useRef, useEffect, useState, useCallback } from "react";
import Loading from "@/app/loading";
import Lottie from "lottie-react";
import loaderAnimation from "@/public/loader.json";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useButtonSound } from "@/app/components/ButtonSound";
import { toast } from "sonner";
import {
  capturePhotoFromVideo,
  generatePhotoFileName,
  blobToDataURL,
} from "@/utils/camera";
import {
  saveImageRecord,
  pollForImageResult,
  requestImageProcessing,
} from "@/utils/imagePolling";
import { WebcamComponent } from "./components/WebcamComponent";
import { CameraCorners } from "./components/CameraCorners";
import { ProcessingStatus } from "./components/ProcessingStatus";
import { CountdownOverlay } from "./components/CountdownOverlay";
import { PageProps, CameraPageContentProps, CameraClientProps } from "./types";
import { useImageStore } from "@/app/store/useImageStore";

export default function Page({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<Loading />}>
      <CameraPageContent searchParams={searchParams} />
    </Suspense>
  );
}

function CameraPageContent({ searchParams }: CameraPageContentProps) {
  const resolvedSearchParams = use(searchParams);
  const characterId = resolvedSearchParams.character;
  const situation = resolvedSearchParams.situation;

  return <CameraClient characterId={characterId} situation={situation} />;
}

function CameraClient({ characterId, situation }: CameraClientProps) {
  const router = useRouter();
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [showWhiteCircle, setShowWhiteCircle] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showLottieLoader, setShowLottieLoader] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("이미지 생성중...");
  const { playSound } = useButtonSound();
  const { setImageData } = useImageStore();
  const flashSoundRef = useRef<HTMLAudioElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    flashSoundRef.current = new Audio("/flash.wav");
    flashSoundRef.current.load();

    return () => {
      if (flashSoundRef.current) {
        flashSoundRef.current.pause();
        flashSoundRef.current = null;
      }
    };
  }, []);

  const handleVideoRef = useCallback((ref: HTMLVideoElement | null) => {
    videoElementRef.current = ref;
  }, []);

  const isErrorString = useCallback((value: unknown) => {
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    return trimmed.startsWith("ERROR:");
  }, []);

  const isValidImageSrc = useCallback((value: unknown) => {
    if (typeof value !== "string") return false;

    const trimmed = value.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("ERROR:")) return false;

    return (
      trimmed.startsWith("data:image/") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("blob:")
    );
  }, []);

  const normalizeImageSrc = useCallback(
    (value: string) => {
      if (!value) return "";

      const trimmed = value.trim();

      if (!trimmed) return "";
      if (trimmed.startsWith("ERROR:")) return "";

      if (
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("blob:") ||
        trimmed.startsWith("data:image/")
      ) {
        return trimmed;
      }

      const looksLikeBase64 =
        trimmed.length > 100 &&
        /^[A-Za-z0-9+/=\s_-]+$/.test(trimmed.replace(/\n/g, "").replace(/\r/g, ""));

      if (looksLikeBase64) {
        return `data:image/png;base64,${trimmed}`;
      }

      return "";
    },
    []
  );

  const extractImageUrlFromPollingResult = useCallback(
    (resultData: unknown) => {
      if (!resultData) return "";

      if (typeof resultData === "string") {
        return normalizeImageSrc(resultData);
      }

      if (typeof resultData === "object") {
        const obj = resultData as Record<string, unknown>;

        const candidates = [
          obj.result_image_data_url,
          obj.background_removed_image_url,
          obj.result_image_url,
          obj.generated_image_url,
          obj.image_url,
          obj.result,
          obj.result_image_b64,
        ];

        for (const candidate of candidates) {
          if (typeof candidate === "string") {
            const normalized = normalizeImageSrc(candidate);
            if (normalized) return normalized;
          }
        }
      }

      return "";
    },
    [normalizeImageSrc]
  );

  const extractErrorMessageFromPollingResult = useCallback(
    (resultData: unknown) => {
      if (!resultData) return "";

      if (typeof resultData === "string" && isErrorString(resultData)) {
        return resultData;
      }

      if (typeof resultData === "object") {
        const obj = resultData as Record<string, unknown>;
        const candidates = [obj.error, obj.message, obj.result];

        for (const candidate of candidates) {
          if (typeof candidate === "string" && isErrorString(candidate)) {
            return candidate;
          }
        }
      }

      return "";
    },
    [isErrorString]
  );

  const uploadPhotoToSupabase = async (photoBlob: Blob, fileName: string) => {
    try {
      const formData = new FormData();
      formData.append("file", photoBlob, fileName);
      formData.append("fileName", fileName);

      const response = await fetch("/api/upload-photo", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        return null;
      }

      return result;
    } catch (error) {
      console.error("[Camera] uploadPhotoToSupabase error:", error);
      return null;
    }
  };

  const processWithFaceSwap = useCallback(
    async (uploadedPhotoUrl: string) => {
      if (!characterId) {
        toast("캐릭터 정보가 없습니다", {
          description: "캐릭터를 선택해주세요.",
        });
        return;
      }

      try {
        setShowLottieLoader(true);
        setProcessingMessage("이미지 저장 중...");

        const saveResult = await saveImageRecord(uploadedPhotoUrl);

        if (!saveResult.success || !saveResult.jobId) {
          toast("이미지 저장 실패", {
            description: saveResult.error || "이미지 저장에 실패했습니다.",
          });
          setShowLottieLoader(false);
          return;
        }

        setProcessingMessage("이미지 생성 중...");

        const awsResult = await requestImageProcessing(
          uploadedPhotoUrl,
          characterId,
          situation || "변신",
          saveResult.jobId,
          2
        );

        if (!awsResult.success) {
          toast("AWS API 요청 실패", {
            description: awsResult.error || "이미지 처리 요청에 실패했습니다.",
          });
          setShowLottieLoader(false);
          return;
        }

        setProcessingMessage("결과 대기 중...");

        const pollingResult = await pollForImageResult(saveResult.jobId, {
          maxAttempts: 60,
          intervalMs: 5000,
          onProgress: () => {
            setProcessingMessage("결과 대기 중...");
          },
        });

        console.log("[Camera] Polling completed:", {
          success: pollingResult.success,
          hasData: !!pollingResult.data,
          hasResult: !!pollingResult.data?.result,
          result: pollingResult.data?.result,
        });

        if (pollingResult.success && pollingResult.data?.result) {
          const resultData = pollingResult.data.result;

          const explicitError = extractErrorMessageFromPollingResult(resultData);
          if (explicitError) {
            console.error("[Camera] Polling returned error result:", explicitError);
            toast("이미지 생성 실패", {
              description: explicitError.replace(/^ERROR:\s*/, ""),
            });
            setShowLottieLoader(false);
            return;
          }

          const backgroundImageUrl = extractImageUrlFromPollingResult(resultData);

          console.log(
            "[Camera] Final image src preview:",
            backgroundImageUrl?.slice(0, 80)
          );
          console.log(
            "[Camera] final backgroundImageUrl:",
            backgroundImageUrl?.slice?.(0, 120)
          );

          if (isValidImageSrc(backgroundImageUrl)) {
            setImageData({
              characterId,
              situation: situation || "변신",
              backgroundRemovedImageUrl: backgroundImageUrl,
              jobId: saveResult.jobId,
            });

            try {
              sessionStorage.setItem("generatedImageUrl", backgroundImageUrl);
              sessionStorage.setItem("generatedJobId", saveResult.jobId);
              sessionStorage.setItem("generatedCharacterId", characterId);
              sessionStorage.setItem(
                "generatedSituation",
                situation || "변신"
              );
              console.log("[Camera] sessionStorage saved");
            } catch (error) {
              console.error("[Camera] sessionStorage save error:", error);
            }

            router.push(
              `/complete?character=${characterId}&jobId=${saveResult.jobId}`
            );
          } else {
            console.error("[Camera] Invalid image result:", resultData);
            toast("이미지 생성 실패", {
              description: "생성된 결과가 올바른 이미지 형식이 아닙니다.",
            });
            setShowLottieLoader(false);
          }
        } else {
          console.log("[Camera] Polling failed:", pollingResult.error);
          toast("이미지 생성 실패", {
            description: pollingResult.error || "이미지 생성에 실패했습니다.",
          });
          setShowLottieLoader(false);
        }
      } catch (error) {
        console.error("[Camera] processWithFaceSwap error:", error);
        toast("처리 중 오류 발생", {
          description:
            error instanceof Error
              ? error.message
              : "알 수 없는 오류가 발생했습니다.",
        });
        setShowLottieLoader(false);
      }
    },
    [
      characterId,
      situation,
      router,
      setImageData,
      extractErrorMessageFromPollingResult,
      extractImageUrlFromPollingResult,
      isValidImageSrc,
    ]
  );

  const captureAndUploadPhoto = useCallback(async () => {
    if (!videoElementRef.current) return;

    if (videoElementRef.current.readyState < 2) {
      toast("카메라가 준비되지 않았습니다", {
        description: "잠시 후 다시 시도해주세요.",
      });
      return;
    }

    try {
      setIsUploading(true);

      const photoBlob = await capturePhotoFromVideo(videoElementRef.current);
      const photoDataURL = await blobToDataURL(photoBlob);
      setCapturedPhoto(photoDataURL);

      const fileName = generatePhotoFileName();
      const uploadResult = await uploadPhotoToSupabase(photoBlob, fileName);

      if (uploadResult && uploadResult.publicUrl) {
        setIsUploading(false);
        await processWithFaceSwap(uploadResult.publicUrl);
      } else {
        toast("사진 업로드 실패", {
          description: "사진 업로드에 실패했습니다.",
        });
        setIsUploading(false);
      }
    } catch (error) {
      console.error("[Camera] captureAndUploadPhoto error:", error);
      toast("사진 촬영 실패", {
        description: "사진 촬영 중 오류가 발생했습니다.",
      });
      setIsUploading(false);
    }
  }, [processWithFaceSwap]);

  const handleTransform = useCallback(() => {
    playSound();

    if (flashSoundRef.current) {
      flashSoundRef.current.currentTime = 0;
      const playPromise = flashSoundRef.current.play();

      if (playPromise !== undefined) {
        playPromise.catch(() => {
          toast("오디오 재생 실패", {
            description: "오디오 파일을 재생할 수 없습니다",
            action: {
              label: "확인",
              onClick: () => {},
            },
          });
        });
      }
    }

    setTimeout(() => {
      setIsCountingDown(true);
    }, 300);
  }, [playSound]);

  const handleCountdownComplete = useCallback(() => {
    captureAndUploadPhoto();

    setShowWhiteCircle(true);
    setIsCountingDown(false);

    setTimeout(() => {
      setShowWhiteCircle(false);
    }, 300);
  }, [captureAndUploadPhoto]);

  return (
    <div className="w-full h-screen relative flex flex-col items-center justify-between">
      <Image
        src="/bg2.webp"
        alt="background"
        fill
        className="object-cover z-0"
        priority
        unoptimized
      />

      <div className="flex flex-col items-center justify-center z-30 mt-[300px] animate-fade-in">
        <div
          className="text-[260px] font-bold text-center text-[#481F0E]"
          style={{ fontFamily: "MuseumClassic, serif" }}
        >
          사진 촬영
        </div>
      </div>

      <div className="absolute top-[949px] w-[1225px] aspect-square animate-fade-in-delay rounded-full overflow-hidden">
        {!showLottieLoader && (
          <div className="absolute inset-0 flex items-center justify-center z-20 rounded-full overflow-hidden">
            <WebcamComponent onVideoRef={handleVideoRef} />
          </div>
        )}

        {capturedPhoto && !showLottieLoader && (
          <div className="absolute inset-0 z-40 rounded-full overflow-hidden">
            <Image
              src={capturedPhoto}
              alt="촬영된 사진"
              fill
              className="object-cover"
            />
          </div>
        )}

        {showWhiteCircle && !capturedPhoto && !showLottieLoader && (
          <div className="absolute inset-0 bg-white/80 rounded-full z-35 animate-flash"></div>
        )}

        {showLottieLoader && (
          <div className="absolute inset-0 z-50 rounded-full overflow-hidden flex items-center justify-center">
            <div className="w-full h-full">
              <Lottie
                animationData={loaderAnimation}
                loop={true}
                autoplay={true}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </div>
        )}

        {!showWhiteCircle && !showLottieLoader && (
          <CountdownOverlay
            isCountingDown={isCountingDown}
            onCountdownComplete={handleCountdownComplete}
          />
        )}

        <ProcessingStatus
          isUploading={isUploading}
          showLottieLoader={showLottieLoader}
          processingMessage={processingMessage}
        />

        <CameraCorners />

        {!showLottieLoader && (
          <div className="absolute inset-0 z-35 pointer-events-none scale-110 mt-[100px]">
            <Image
              src="/mask.png"
              alt="overlap"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        )}
      </div>

      <div className="absolute bottom-[832px] left-1/2 transform -translate-x-1/2 flex flex-col items-center justify-center z-30 border-[25px] border-[#D3B582] rounded-[60px] w-[1666px] h-[390px] animate-fade-in-up">
        {showLottieLoader ? (
          <div className="text-[120px] font-bold text-center text-[#481F0E]">
            {processingMessage}
          </div>
        ) : (
          <>
            <div className="text-[79px] font-bold text-center text-[#481F0E]">
              정면을 바라보고 얼굴이 전체가
            </div>
            <div className="text-[79px] font-bold text-center text-[#481F0E]">
              잘 보이도록 촬영해주세요
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-center z-30 flex-row mb-[358px] animate-fade-in-up">
        <Button
          onClick={handleTransform}
          disabled={
            isCountingDown || showWhiteCircle || isUploading || showLottieLoader
          }
          className={`w-[1523px] h-[281px] text-[128px] font-bold z-20 rounded-[60px] border-4 border-[#471F0D] transition-all duration-200 hover:scale-101 active:scale-99 ${
            isCountingDown || showWhiteCircle || isUploading || showLottieLoader
              ? "text-[#8B7355] bg-[#A8956B] cursor-not-allowed opacity-50"
              : "text-[#451F0D] bg-[#E4BE50] hover:bg-[#E4BE50]/90 cursor-pointer"
          }`}
        >
          {isUploading
            ? "저장 중..."
            : showLottieLoader
            ? "변신 중..."
            : "수군으로 변신하기"}
        </Button>
      </div>
    </div>
  );
}
