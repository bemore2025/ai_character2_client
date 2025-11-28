import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { v4 as uuidv4 } from 'uuid';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // 환경 변수 검증
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase 환경 변수가 설정되지 않음:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey
      });
      return NextResponse.json(
        { success: false, error: 'Supabase 환경 변수가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    console.log('환경 변수 확인 완료:', {
      url: supabaseUrl.substring(0, 30) + '...',
      hasKey: !!supabaseAnonKey
    });

    const supabase = await createClient();
    
    // 고유한 파일명 생성 (JPEG로 변경)
    const fileName = `${uuidv4()}.jpg`;
    const filePath = `photocards/${fileName}`;
    
    console.log('파일 경로 생성:', filePath);
    
    // presigned URL 생성 (업로드용)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('images')
      .createSignedUploadUrl(filePath, {
        upsert: true
      });
    
    if (uploadError) {
      console.error('presigned URL 생성 실패:', uploadError);
      return NextResponse.json(
        { success: false, error: `presigned URL 생성 실패: ${uploadError.message}` },
        { status: 500 }
      );
    }
    
    console.log('presigned URL 생성 성공:', {
      hasSignedUrl: !!uploadData.signedUrl,
      hasToken: !!uploadData.token
    });
    
    // 공개 URL 생성 (QR 코드용)
    const { data: urlData } = await supabase.storage
      .from('images')
      .getPublicUrl(filePath);
    
    console.log('공개 URL 생성:', urlData.publicUrl.substring(0, 50) + '...');
    
    return NextResponse.json({
      success: true,
      uploadUrl: uploadData.signedUrl,
      publicUrl: urlData.publicUrl,
      fileName: fileName,
      filePath: filePath,
      token: uploadData.token
    });
  } catch (error) {
    console.error('API 에러:', error);
    return NextResponse.json(
      { success: false, error: `서버 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 