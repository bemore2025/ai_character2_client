import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const isAuthenticated = request.cookies.get("auth_verified");

  return NextResponse.json({
    authenticated: !!isAuthenticated,
  });
}
