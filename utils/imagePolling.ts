// image polling 유틸리티 함수들

export interface ImagePollingResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface PollingOptions {
  maxAttempts?: number;
  intervalMs?: number;
  onProgress?: (attempt: number, maxAttempts: number) => void;
  regenerationCount?: number; // 재생성 횟수 (2: 초기, 1: 첫 번째 재생성, 0: 두 번째 재생성)
}

/**
 * job_id를 기반으로 image 테이블에서 result 값이 나올 때까지 polling
 */
export async function pollForImageResult(
  jobId: string,
  options: PollingOptions = {}
): Promise<ImagePollingResult> {
  const {
    maxAttempts = 60, // 최대 60번 시도 (약 5분)
    intervalMs = 5000, // 5초마다 체크
    onProgress,
    regenerationCount = 2, // 기본값: 초기 생성
  } = options;

  let attempt = 0;

  const poll = async (): Promise<ImagePollingResult> => {
    attempt++;

    if (onProgress) {
      onProgress(attempt, maxAttempts);
    }

    try {
      // regenerationCount를 쿼리 파라미터로 추가하여 적절한 컬럼 조회
      const response = await fetch(
        `/api/image?job_id=${jobId}&regeneration_count=${regenerationCount}&_t=${Date.now()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        }
      );

      const result = await response.json();

      // 디버깅 로그 추가
      console.log(`[Polling ${attempt}/${maxAttempts}] API Response:`, {
        ok: response.ok,
        status: response.status,
        has_result: result.has_result,
        regeneration_count: result.regeneration_count,
        target_column: result.target_column,
        data_exists: !!result.data,
        result_exists: !!result.data?.result,
        result_type: typeof result.data?.result,
        result_value: result.data?.result,
      });

      if (!response.ok) {
        console.log("[Polling] API Error:", result.error);
        return {
          success: false,
          error: result.error || "이미지 데이터 조회 실패",
        };
      }

      // result 값이 있으면 성공
      if (result.has_result && result.data?.result) {
        console.log("[Polling] Success! Result found:", result.data.result);
        return {
          success: true,
          data: result.data,
        };
      }

      console.log("[Polling] No result yet, continuing...");

      // 최대 시도 횟수에 도달했으면 타임아웃
      if (attempt >= maxAttempts) {
        return {
          success: false,
          error: "이미지 처리 타임아웃",
        };
      }

      // 다시 시도
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      return poll();
    } catch (error) {
      console.log(`[Polling] Network error on attempt ${attempt}:`, error);

      if (attempt >= maxAttempts) {
        console.log("[Polling] Max attempts reached, failing...");
        return {
          success: false,
          error: error instanceof Error ? error.message : "알 수 없는 오류",
        };
      }

      // 네트워크 에러 등의 경우 다시 시도
      console.log(`[Polling] Retrying in ${intervalMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      return poll();
    }
  };

  return poll();
}

/**
 * AWS API에 이미지 처리 요청 전송
 */
export async function requestImageProcessing(
  imageUrl: string,
  characterId: string,
  customPrompt: string,
  jobId: string,
  regenerationCount?: number
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(
      "https://9wdz4rve0l.execute-api.ap-northeast-2.amazonaws.com/api/v1/cartoonize",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: imageUrl,
          character_id: characterId,
          custom_prompt: customPrompt,
          job_id: jobId,
          regeneration_count: regenerationCount ?? 2,
        }),
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: `AWS API 요청 실패: ${response.status} ${response.statusText}`,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 이미지 저장 및 job_id 생성
 */
export async function saveImageRecord(pictureCamera: string): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  try {
    const response = await fetch("/api/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        picture_camera: pictureCamera,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || "이미지 레코드 저장 실패",
      };
    }

    return {
      success: true,
      jobId: result.job_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}
