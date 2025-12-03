import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { v4 as uuidv4 } from 'uuid';

// image 테이블에 job_id와 picture_camera 저장
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { picture_camera } = await request.json();
    
    if (!picture_camera) {
      return NextResponse.json(
        { error: 'picture_camera URL이 누락되었습니다' },
        { status: 400 }
      );
    }

    // UUID 생성
    const job_id = uuidv4();

    // image 테이블에 데이터 삽입
    const { data, error } = await supabase
      .from('image')
      .insert({
        job_id: job_id,
        picture_camera: picture_camera
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'image 테이블 저장에 실패했습니다', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      job_id
    });

  } catch (error) {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// job_id로 이미지 데이터 조회 (polling용)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = request.nextUrl;
    const job_id = searchParams.get('job_id');
    const regeneration_count = searchParams.get('regeneration_count') || '2'; // 기본값 2 (초기 생성)

    if (!job_id) {
      return NextResponse.json(
        { error: 'job_id가 누락되었습니다' },
        { status: 400 }
      );
    }

    // job_id로 image 데이터 조회
    const { data, error } = await supabase
      .from('image')
      .select('*')
      .eq('job_id', job_id)
      .single();

    if (error) {
      return NextResponse.json(
        { error: '이미지 데이터 조회에 실패했습니다', details: error.message },
        { status: 500 }
      );
    }

    // regeneration_count에 따라 적절한 result 컬럼 선택
    let targetResult = null;
    let hasResult = false;

    const count = parseInt(regeneration_count);

    if (count === 2) {
      // 초기 생성 (아직 재생성 안 함)
      targetResult = data.result;
      hasResult = !!data.result;
    } else if (count === 1) {
      // 첫 번째 재생성
      targetResult = data.result_add1;
      hasResult = !!data.result_add1;
    } else if (count === 0) {
      // 두 번째 재생성
      targetResult = data.result_add2;
      hasResult = !!data.result_add2;
    }

    // 타임스탬프를 추가하여 캐싱 방지
    const responseData = {
      ...data,
      result: targetResult,
      _timestamp: Date.now() // 캐시 버스팅용
    };

    return NextResponse.json({
      success: true,
      data: responseData,
      has_result: hasResult,
      regeneration_count: count,
      target_column: count === 2 ? 'result' : count === 1 ? 'result_add1' : 'result_add2'
    });

  } catch (error) {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
