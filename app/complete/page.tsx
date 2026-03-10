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
    jobId: storedJobId,
  } = useImageStore();

  const CARD_WIDTH = 900;
  const CARD_HEIGHT = 1440;

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
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [isImageUploadComplete, setIsImageUploadComplete] = useState(false);
  const [isQrReady, setIsQrReady] = useState(false);
  const [showQrInCard, setShowQrInCard] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [randomMessage, setRandomMessage] = useState<string>("");
  const [localRefreshCount, setLocalRefreshCount] = useState<number>(2);
  const { playSound } = useButtonSound();
  const searchParams = useSearchParams();
  const characterId = searchParams.get("character");
  const situationParam = searchParams.get("situation");
  const imageParam = searchParams.get("image");
  const resultImageParam = searchParams.get("resultImage");
  const backgroundImageParam = searchParams.get("backgroundImage");
  const [backgroundRemovedImageUrl, setBackgroundRemovedImageUrl] = useState<string>("");
  const photoCardRef = useRef<HTMLDivElement>(null);
  const fullScreenRef = useRef<HTMLDivElement>(null);

  const fetchRandomMessage = async () => {
    try {
      const response = await fetch("/api/messages/random");
      if (response.ok) {
        const data: MessageResponse = await response.json();
        setRandomMessage(data.message);
      }
    } catch (error) {
      setRandomMessage("경상좌수영 수군 출전 준비 완료!");
    }
  };

  const fetchCharacter = async (characterId: string) => {
    try {
      const response = await fetch(`/api/characters/${characterId}`);
      if (response.ok) {
        const data: CharacterResponse = await response.json();
        setCharacter(data.character);
        if (data.character.ability1_min && data.character.ability1_max) {
          const randomSkill1 = Math.floor(
            Math.random() * (data.character.ability1_max - data.character.ability1_min + 1) +
              data.character.ability1_min
          );
          setSkill1Value(randomSkill1);
        }
        if (data.character.ability2_min && data.character.ability2_max) {
          const randomSkill2 = Math.floor(
            Math.random() * (data.character.ability2_max - data.character.ability2_min + 1) +
              data.character.ability2_min
          );
          setSkill2Value(randomSkill2);
        }
      } else {
        setSkill1Value(Math.floor(Math.random() * 201 + 100));
        setSkill2Value(Math.floor(Math.random() * 201 + 100));
      }
    } catch (error) {
      setSkill1Value(Math.floor(Math.random() * 201 + 100));
      setSkill2Value(Math.floor(Math.random() * 201 + 100));
    }
  };

  useEffect(() => {
    console.log("=== Complete 페이지 진입 - 재생성 카운트 초기화 ===");
    localStorage.setItem("regenerateCount", "2");
    setLocalRefreshCount(2);
  }, []);

  useEffect(() => {
    const savedCount = localStorage.getItem("regenerateCount");
    if (savedCount !== null) {
      setLocalRefreshCount(parseInt(savedCount));
    }
  }, [isRegenerating]);

  useEffect(() => {
    const printingState = localStorage.getItem("isPrinting");
    const printingStartTime = localStorage.getItem("printingStartTime");
    if (printingState === "true" && printingStartTime) {
      const startTime = parseInt(printingStartTime);
      const currentTime = Date.now();
      const elapsedTime = currentTime - startTime;
      if (elapsedTime < 60000) {
        setIsPrinting(true);
        const remainingTime = 60000 - elapsedTime;
        setTimeout(() => {
          setIsPrinting(false);
          localStorage.removeItem("isPrinting");
          localStorage.removeItem("printingStartTime");
        }, remainingTime);
      } else {
        localStorage.removeItem("isPrinting");
        localStorage.removeItem("printingStartTime");
      }
    }
  }, []);

  const addDebugInfo = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const debugMessage = `[${timestamp}] ${message}`;
    console.log(debugMessage);
    setDebugInfo((prev) => [...prev.slice(-4), debugMessage]);
  }, []);

  useEffect(() => {
    if (characterId) {
      fetchCharacter(characterId);
    } else {
      setSkill1Value(Math.floor(Math.random() * 201 + 100));
      setSkill2Value(Math.floor(Math.random() * 201 + 100));
    }
  }, [characterId]);

  useEffect(() => {
    fetchRandomMessage();
  }, []);

  useEffect(() => {
    if (backgroundImageParam) {
      const decodedUrl = decodeURIComponent(backgroundImageParam);
      addDebugInfo(`background_removed_image_url 직접 사용: ${decodedUrl}`);
      setBackgroundRemovedImageUrl(decodedUrl);
    } else if (resultImageParam) {
      try {
        const apiResponse = JSON.parse(decodeURIComponent(resultImageParam));
        let backgroundImageUrl = "";
        if (apiResponse.result && apiResponse.result.background_removed_image_url) {
          backgroundImageUrl = apiResponse.result.background_removed_image_url;
        } else if (apiResponse.background_removed_image_url) {
          backgroundImageUrl = apiResponse.background_removed_image_url;
        }
        if (backgroundImageUrl) {
          setBackgroundRemovedImageUrl(backgroundImageUrl);
        } else {
          if (apiResponse.result && apiResponse.result.result_image_url) {
            setBackgroundRemovedImageUrl(apiResponse.result.result_image_url);
          } else if (apiResponse.result_image_url) {
            setBackgroundRemovedImageUrl(apiResponse.result_image_url);
          }
        }
      } catch (error) {
        setBackgroundRemovedImageUrl(resultImageParam || "");
      }
    }
  }, [backgroundImageParam, resultImageParam, addDebugInfo]);

  useEffect(() => {
    if (imageParam) {
      addDebugInfo(`이미지 파라미터 감지: ${imageParam}`);
      setQrCodeUrl(imageParam);
      setShowQrInCard(true);
    } else if (backgroundImageParam || resultImageParam) {
      setShowQrInCard(true);
    }
  }, [imageParam, backgroundImageParam, resultImageParam]);

  useEffect(() => {
    const autoStart = async () => {
      if (isImageUploadComplete || imageParam) {
        return;
      }
      addDebugInfo("자동 프로세스 시작 준비");
      const timer = setTimeout(() => {
        addDebugInfo("자동 프로세스 시작");
        captureAndUploadImage();
      }, 0);
      return () => clearTimeout(timer);
    };

    if (photoCardRef.current && !isImageUploadComplete && !imageParam) {
      autoStart();
    }
  }, [isImageUploadComplete, imageParam]);

  const captureAndUploadImage = useCallback(async () => {
    try {
      addDebugInfo("이미지 캡처 시작");
      setIsLoading(true);

      const targetElement = photoCardRef.current;
      if (!targetElement) {
        addDebugInfo("캡처 대상 요소를 찾을 수 없음");
        return;
      }

      addDebugInfo("Canvas 변환 시작");

      const dataUrl = await domtoimage.toJpeg(targetElement, {
        bgcolor: "#B9D8F0",
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        quality: 0.88,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          width: `${CARD_WIDTH}px`,
          height: `${CARD_HEIGHT}px`,
        },
      });

      addDebugInfo("이미지 변환 완료, Supabase 업로드 준비");

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], "photo-card.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);

      addDebugInfo(`Supabase 업로드 시작 - 파일 크기: ${file.size} bytes`);

      let uploadResult;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          const uploadResponse = await fetch("/api/upload-image", {
            method: "POST",
            body: formData,
          });

          addDebugInfo(`업로드 시도 ${retryCount + 1}: 응답 상태 ${uploadResponse.status}`);

          uploadResult = await uploadResponse.json();

          if (uploadResult.success && uploadResult.url) {
            addDebugInfo(`Supabase 업로드 성공: ${uploadResult.url.substring(0, 60)}...`);

            setQrCodeUrl(uploadResult.url);
            setShowQrInCard(true);

            const currentUrl = window.location.href;
            const url = new URL(currentUrl);
            url.searchParams.set("image", uploadResult.url);
            window.history.replaceState({}, "", url.toString());

            addDebugInfo("QR 코드 렌더링 대기 중");
            return;
          } else {
            addDebugInfo(`업로드 실패 (시도 ${retryCount + 1}): ${uploadResult.error}`);
            break;
          }
        } catch (networkError) {
          retryCount++;
          addDebugInfo(
            `업로드 네트워크 에러 (시도 ${retryCount}): ${
              networkError instanceof Error ? networkError.message : "Unknown error"
            }`
          );
          if (retryCount < maxRetries) {
            addDebugInfo(`${2000 * retryCount}ms 후 재시도...`);
            await new Promise((resolve) => setTimeout(resolve, 2000 * retryCount));
          }
        }
      }

      if (!uploadResult?.success) {
        addDebugInfo(`모든 업로드 시도 실패 (${maxRetries}회)`);
        setIsImageUploadComplete(true);
      }
    } catch (error) {
      addDebugInfo(
        `이미지 캡처 및 업로드 에러: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsLoading(false);
      setIsImageUploadComplete(true);
    }
  }, [addDebugInfo, CARD_WIDTH, CARD_HEIGHT]);

  useEffect(() => {
    if (isImageUploadComplete) return;
    if (qrCodeUrl) {
      addDebugInfo("QR URL 이미 설정됨, 추가 캡처 스킵");
    }
  }, [qrCodeUrl]);

  const handleQrReady = () => {
    addDebugInfo("QR 코드 렌더링 완료");
    setIsQrReady(true);
  };

  useEffect(() => {
    if (qrCodeUrl) {
      setIsQrReady(false);
      addDebugInfo(`QR 코드 URL 설정: ${qrCodeUrl.substring(0, 50)}...`);
    }
  }, [qrCodeUrl]);

  const handleTransform = () => {
    playSound();
    setIsPrinting(true);
    const startTime = Date.now();
    localStorage.setItem("isPrinting", "true");
    localStorage.setItem("printingStartTime", startTime.toString());
    setTimeout(() => {
      handlePrint();
    }, 100);
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
    if (!storedCharacterId || !storedImageUrl || !storedJobId) {
      toast({ title: "재생성 불가", description: "저장된 이미지 정보가 없습니다." });
      return;
    }
    const currentCount = parseInt(localStorage.getItem("regenerateCount") || "0");
    if (currentCount <= 0) {
      toast({ title: "재생성 불가", description: "재생성 횟수를 모두 사용했습니다." });
      return;
    }

    setIsRegenerating(true);
    try {
      const currentRegenerationCount = parseInt(localStorage.getItem("regenerateCount") || "2");
      const nextRegenerationCount = Math.max(0, currentRegenerationCount - 1);

      const awsResult = await requestImageProcessing(
        storedImageUrl,
        storedCharacterId,
        storedSituation || "재생성",
        storedJobId,
        nextRegenerationCount
      );

      if (!awsResult.success) {
        toast({
          title: "이미지 처리 요청 실패",
          description: awsResult.error || "이미지 처리 요청에 실패했습니다.",
        });
        setIsRegenerating(false);
        return;
      }

      const pollingResult = await pollForImageResult(storedJobId, {
        maxAttempts: 60,
        intervalMs: 5000,
        regenerationCount: nextRegenerationCount,
      });

      if (pollingResult.success && pollingResult.data?.result) {
        const resultData = pollingResult.data.result;
        let backgroundImageUrl = "";

        if (typeof resultData === "string") {
          backgroundImageUrl = resultData;
        } else if (typeof resultData === "object" && resultData !== null) {
          if (resultData.background_removed_image_url) {
            backgroundImageUrl = resultData.background_removed_image_url;
          } else if (resultData.result_image_url) {
            backgroundImageUrl = resultData.result_image_url;
          }
        }

        if (backgroundImageUrl) {
          const newCount = Math.max(0, currentCount - 1);
          localStorage.setItem("regenerateCount", newCount.toString());
          setLocalRefreshCount(newCount);

          setBackgroundRemovedImageUrl(backgroundImageUrl);
          setIsImageUploadComplete(false);
          setQrCodeUrl("");

          setTimeout(async () => {
            await captureAndUploadImage();
            toast({ title: "재생성 완료", description: "새로운 이미지가 생성되었습니다." });
          }, 100);
        } else {
          toast({
            title: "이미지 URL을 찾을 수 없습니다",
            description: "생성된 이미지 URL을 찾을 수 없습니다.",
          });
        }
      } else {
        toast({ title: "이미지 생성 실패", description: "이미지 생성에 실패했습니다." });
      }
    } catch (error) {
      toast({
        title: "오류 발생",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

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
      }, 2000);
    }
  }, [isCountingDown, countdown, router]);

  const getStatusMessage = () => {
    return isImageUploadComplete ? "완료!" : "이미지 업로드중...";
  };

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
      await new Promise((resolve) => setTimeout(resolve, 3000));
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const dataUrl = await domtoimage.toJpeg(targetElement, {
        bgcolor: "#B9D8F0",
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        quality: 0.88,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          width: `${CARD_WIDTH}px`,
          height: `${CARD_HEIGHT}px`,
        },
        filter: (node) => {
          const element = node as Element;
          if (element.tagName === "SCRIPT" || element.tagName === "STYLE") return false;
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

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `포토카드_${character?.role || "character"}_${new Date().getTime()}.jpg`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "다운로드 완료", description: "포토카드 이미지가 다운로드되었습니다." });
    } catch (error) {
      toast({
        title: "오류",
        description: "이미지 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    if (!qrCodeUrl) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>포토카드 양면 출력</title>
        <meta charset="utf-8">
        <style>
          @page { size: 245px 386px; margin: 0; padding: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: white; }
          .print-container { width: 100%; height: 100%; }
          .print-page { width: 245px; height: 386px; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; page-break-after: always; page-break-inside: avoid; position: relative; overflow: hidden; background: white; }
          .print-page:last-child { page-break-after: avoid; }
          .card-image { width: 100%; height: 100%; margin: 0; padding: 0; object-fit: cover; border: none; display: block; }
          .card-image.back { transform: scaleX(-1) scaleY(-1); }
          .page-info { position: absolute; top: 5px; right: 5px; font-size: 12px; color: #666; background: rgba(255,255,255,0.9); padding: 3px 8px; border-radius: 4px; z-index: 10; }
          @media print {
            .page-info { display: none !important; }
            html, body { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
            .print-page { width: 245px !important; height: 386px !important; margin: 0 !important; page-break-after: always !important; }
            .print-page:last-child { page-break-after: auto !important; }
            .card-image { width: 100% !important; height: 100% !important; object-fit: cover !important; }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <div class="print-page">
            <div class="page-info">앞면 - Page 1</div>
            <img src="${qrCodeUrl}" alt="포토카드 앞면" class="card-image" crossorigin="anonymous" />
          </div>
          <div class="print-page">
            <div class="page-info">뒷면 - Page 2</div>
            <img src="/print_front.jpg" alt="포토카드 뒷면" class="card-image back" crossorigin="anonymous" />
          </div>
        </div>
        <script>
          let loadedCount = 0;
          const images = document.querySelectorAll('img');
          const totalImages = images.length;
          function checkAllLoaded() {
            loadedCount++;
            if (loadedCount === totalImages) {
              setTimeout(() => { window.print(); }, 1000);
            }
          }
          images.forEach((img, index) => {
            if (img.complete && img.naturalHeight !== 0) { checkAllLoaded(); }
            else {
              img.onload = () => { checkAllLoaded(); };
              img.onerror = () => { checkAllLoaded(); };
            }
          });
          setTimeout(() => { if (loadedCount < totalImages) { window.print(); } }, 5000);
          window.addEventListener('afterprint', () => { setTimeout(() => { window.close(); }, 1000); });
          document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { window.close(); } });
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const formatRoleText = (role: string) => {
    if (!role) return "";
    if (role.length === 2) return role.split("").join("   ");
    else if (role.length === 3) return role.split("").join(" ");
    return role;
  };

  return (
    <div
      ref={fullScreenRef}
      className="w-full h-screen relative flex flex-col items-center justify-between"
    >
      <Image src="/bg2.webp" alt="background" fill className="object-cover z-0" priority unoptimized />
      <div className="flex flex-col items-center justify-center z-30 mt-[300px]">
        <div
          className="text-[190px] font-bold text-center text-[#481F0E]"
          style={{ fontFamily: "MuseumClassic, serif" }}
        >
          "출전 준비 완료"
        </div>
      </div>

      {isRegenerating ? (
        <div className="absolute top-[582px] w-[1594px] h-[2543px] z-20 flex items-center justify-center">
          <Lottie animationData={loaderAnimation} loop={true} style={{ width: 800, height: 800 }} />
        </div>
      ) : (
        <div
          ref={photoCardRef}
          className="photo-card absolute top-[582px] w-[1594px] h-[2543px] border-[10px] border-black z-20 rounded-[50px] flex flex-col items-center justify-start bg-[#B9D8F0] pt-8"
          style={{ backgroundColor: "#B9D8F0" }}
        >
          <div
            className="text-[170px] font-bold text-center text-[#481F0E] role-text relative"
            style={{ fontFamily: "MuseumClassic, serif" }}
          >
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
              className="qrcode absolute bottom-0 right-0 w-[460px] h-[460px] bg-[#B9D8F0] z-30 border-[21px] border-black rounded-tl-[50px] rounded-br-[50px] flex items-center justify-center"
              style={{ backgroundColor: "#B9D8F0" }}
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
              className="absolute inset-0 border-[21px] border-black thick-container rounded-[60px]"
              style={{
                backgroundImage: `url("/card_bg2.png")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <img
                src={backgroundRemovedImageUrl || character?.picture_character || ""}
                alt={character?.role || "character"}
                className="cartoon-image object-cover w-[1348px] h-[2050px] rounded-[40px]"
              />
            </div>

            <div className="relative w-full h-[290px]">
              <div className="absolute top-0 left-0 w-full h-[290px] border-[21px] border-black z-25 rounded-bl-[50px] rounded-br-[50px] ability-frame" />
              <div className="w-full h-[290px] z-20 bg-[#E4BE50] flex flex-row border-none relative">
                <div
                  className="absolute w-[814px] h-[298px] z-30 flex flex-col items-center justify-center bg-[#B9D8F0] rounded-[130px] border-[21px] border-black"
                  style={{
                    top: "-350px",
                    left: "32.5%",
                    transform: "translateX(-50%)",
                    fontFamily: "MuseumClassic, serif",
                  }}
                >
                  <div
                    className="text-[95px] text-[#000000] leading-tight text-center px-10 whitespace-pre-line"
                    style={{ fontFamily: "DNFBitBitv2, monospace", whiteSpace: "pre-wrap" }}
                    dangerouslySetInnerHTML={{
                      __html: randomMessage.replace(/\/n/g, "\n").split("\n").join("<br />"),
                    }}
                  ></div>
                </div>

                <div className="flex-1 flex flex-row border-none relative h-[287.5px]">
                  <div className="flex-1 flex flex-col border-none">
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
                  <div className="flex-1 flex flex-col border-none">
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
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10">
                    <div className="w-[21px] bg-black h-[220px] rounded-t-full rounded-b-full"></div>
                  </div>
                </div>
                <div className="w-[460px]"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="button-container flex items-center justify-center z-30 flex-row mb-[358px]">
        {!isImageUploadComplete ? (
          <div className="flex flex-col items-center gap-4">
            <div className="text-[128px] text-[#451F0D] font-bold">이미지 업로드중...</div>
          </div>
        ) : isPrinting ? (
          <div className="flex flex-col items-center gap-4">
            <div className="text-[128px] text-[#451F0D] font-bold">출력 중입니다. 잠시만 기다려 주세요.</div>
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
            {localRefreshCount > 0 && (
              <div className="w-[228px] flex flex-col items-center justify-center gap-4">
                <Button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="w-[228px] h-[228px] text-[128px] text-[#451F0D] bg-[#E4BE50] rounded-full font-bold z-20 flex items-center justify-center p-0 overflow-visible disabled:opacity-50 disabled:cursor-not-allowed"
                  title="다시 생성"
                >
                  <IoMdRefresh style={{ width: "180px", height: "180px" }} />
                </Button>
              </div>
            )}
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
