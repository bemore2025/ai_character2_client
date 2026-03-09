import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string;

    if (!file || !fileName) {
      return NextResponse.json(
        { error: '파일 또는 파일명이 누락되었습니다' },
        { status: 400 }
      );
    }
    const fileBuffer = await file.arrayBuffer();
    const { data, error } = await supabase.storage
      .from('pictures')
      .upload(fileName, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (error) {
      return NextResponse.json(
        { error: '파일 업로드에 실패했습니다', details: error.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from('pictures')
      .getPublicUrl(fileName);

    await supabase.from('camera_history').insert({ url: urlData.publicUrl });

    return NextResponse.json({
      success: true,
      fileName: fileName,
      path: data.path,
      publicUrl: urlData.publicUrl
    });
  } catch (error) {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
