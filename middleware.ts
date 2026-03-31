import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (
    pathname === "/" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Note: La vérification du rôle ADMIN est faite côté serveur (page.tsx)
  // car BetterAuth nécessite un appel API qui n'est pas compatible avec Edge Runtime
  // La page /admin redirige vers /dashboard si l'utilisateur n'est pas ADMIN

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
