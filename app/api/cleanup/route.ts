import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: Request) {
  // Vercel Cron 보안 확인
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const BUCKET = "images";
  const MINUTES = 5;
  const cutoff = new Date(Date.now() - MINUTES * 60 * 1000).toISOString();
  let totalDeleted = 0;
  const errors: string[] = [];

  async function deleteOldFilesInFolder(folderPath: string) {
    const { data: items, error: listError } = await supabase.storage
      .from(BUCKET)
      .list(folderPath, { limit: 1000 });

    if (listError || !items || items.length === 0) return;

    const folders = items.filter((item) => item.id === null);
    const files = items.filter((item) => item.id !== null);

    for (const folder of folders) {
      await deleteOldFilesInFolder(folderPath + "/" + folder.name);
    }

    if (files.length > 0) {
      const filesToDelete = files.filter((file) => {
        const fileTime = file.created_at || file.updated_at;
        if (!fileTime) return true;
        return fileTime < cutoff;
      });

      if (filesToDelete.length > 0) {
        const pathsToDelete = filesToDelete.map((f) => folderPath + "/" + f.name);
        const { error: removeError } = await supabase.storage
          .from(BUCKET)
          .remove(pathsToDelete);
        if (removeError) {
          errors.push(removeError.message);
        } else {
          totalDeleted += filesToDelete.length;
        }
      }
    }
  }

  const TOP_FOLDERS = ["cartoon_results", "photocards"];
  for (const folder of TOP_FOLDERS) {
    await deleteOldFilesInFolder(folder);
  }

  return NextResponse.json({ success: true, totalDeleted, errors });
}
