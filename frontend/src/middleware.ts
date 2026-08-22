import { NextRequest, NextResponse } from "next/server";
import { decodeToken, hasRequiredRole, isTokenExpired } from "@/lib/auth/decodeToken";

const publicRoutes = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
  "/contact",
  "/privacy-policy",
  "/terms-of-service",
];

const protectedRoutes: Record<string, string | string[] | null> = {
  "/dashboard": null,
  "/profile": null,
  "/settings": null,
  "/admin": "admin",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value;

  // Redirect authenticated users away from login/register
  if (token && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Check if route is protected
  const matchedRoute = Object.keys(protectedRoutes).find(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (matchedRoute) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const payload = decodeToken(token);

    if (!payload || isTokenExpired(token)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const requiredRole = protectedRoutes[matchedRoute];
    if (!hasRequiredRole(payload, requiredRole)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
