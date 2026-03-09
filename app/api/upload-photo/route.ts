// 기존 코드 (18~29번째 줄)
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
