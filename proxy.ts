import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/auth")) return NextResponse.next();
  const session = await getIronSession<{ authenticated: boolean }>(
    req,
    new Response(),
    { cookieName: "birdseye-session", password: process.env.AUTH_SECRET! }
  );
  if (!session.authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/explore/:path*", "/api/:path*"],
};
