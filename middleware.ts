import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Strictly Public Routes (Must bypass auth check completely)
  // - Tenant payment links (/pay/*)
  // - Authentication pages (/auth/*)
  // - PWA assets, icons, manifest, service worker & Next.js static bundles
  if (
    pathname.startsWith('/pay') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/icons') ||
    pathname === '/manifest.json' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname === '/favicon.ico' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. Check for authentication tokens across cookies
  const authToken =
    request.cookies.get('sb-access-token')?.value ||
    request.cookies.get('supabase-auth-token')?.value ||
    request.cookies.getAll().find((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))?.value;

  // 3. Protected Routes: /, /properties, /invoices, /expenses, /statement, /settings
  // If unauthenticated, redirect to /auth/login
  if (!authToken) {
    const loginUrl = new URL('/auth/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
