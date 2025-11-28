import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    console.log('업로드 요청 시작');
    
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const uploadUrl = formData.get('uploadUrl') as string | null;
    
    console.log('FormData 파싱 완료:', {
      hasFile: !!file,
      fileSize: file?.size,
      fileType: file?.type,
      hasUploadUrl: !!uploadUrl,
      uploadUrlLength: uploadUrl?.length
    });
    
    if (!file || !uploadUrl) {
      console.error('필수 데이터 누락:', { hasFile: !!file, hasUploadUrl: !!uploadUrl });
      return NextResponse.json(
        { success: false, error: '파일 또는 업로드 URL이 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 파일을 ArrayBuffer로 변환
    console.log('파일을 ArrayBuffer로 변환 시작');
    const fileBuffer = await file.arrayBuffer();
    console.log('ArrayBuffer 변환 완료, 크기:', fileBuffer.byteLength);
    
    // presigned URL에 직접 PUT 요청
    console.log('presigned URL로 업로드 시작:', uploadUrl.substring(0, 50) + '...');
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': file.type,
        'Content-Length': file.size.toString(),
      },
    });
    
    console.log('업로드 응답:', {
      status: uploadResponse.status,
      statusText: uploadResponse.statusText,
      ok: uploadResponse.ok
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('업로드 실패 상세:', {
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        errorText: errorText.substring(0, 200)
      });
      return NextResponse.json(
        { success: false, error: `업로드 실패: ${uploadResponse.status} - ${errorText}` },
        { status: 500 }
      );
    }
    
    console.log('업로드 성공');
    return NextResponse.json({
      success: true,
      message: '업로드 완료',
      status: uploadResponse.status
    });
  } catch (error) {
    console.error('업로드 API 에러:', error);
    return NextResponse.json(
      { success: false, error: `서버 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 