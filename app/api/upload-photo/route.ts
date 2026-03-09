import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string;
    
    if (!file || !fileName) {
      return NextResponse.json(
        { error: '파일 또는 파일명이 누락되었습니다' },
        { status: 400 }
      );
    }

    // base64로 변환 (Supabase 저장 없음)
    const fileBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(fileBuffer).toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    return NextResponse.json({
      success: true,
      fileName: fileName,
      path: fileName,
      publicUrl: dataUrl
    });

  } catch (error) {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
