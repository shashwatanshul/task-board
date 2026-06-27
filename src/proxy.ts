import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifyToken } from "@/lib/jwt";

// Next.js 16 "proxy" (formerly "middleware"). Guards the dashboard and the
// tasks API based on the JWT stored in an httpOnly cookie.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const isAuthenticated = token ? (await verifyToken(token)) !== null : false;

  // Protect the tasks API: respond with 401 JSON instead of redirecting.
  if (pathname.startsWith("/api/tasks")) {
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Authenticated users shouldn't see the auth pages.
  if (pathname === "/login" || pathname === "/signup") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Protect the dashboard (home) page.
  if (pathname === "/") {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/signup", "/api/tasks/:path*"],
};
