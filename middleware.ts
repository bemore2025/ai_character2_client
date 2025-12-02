import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "./utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    // Supabase 세션 업데이트
    const response = await updateSession(request);

    // 루트 경로는 인증 체크 제외
    if (pathname === "/") {
      return response;
    }

    // 인증 쿠키 확인
    const isAuthenticated = request.cookies.get("auth_verified");

    // 인증되지 않은 경우 루트로 리다이렉트
    if (!isAuthenticated) {
      const redirectUrl = new URL("/", request.url);
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  } catch (error) {
    // 에러 발생 시 기본 응답 반환
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
