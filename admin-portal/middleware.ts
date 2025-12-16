import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token');
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/client-login', '/client-signup'];
  const isPublicRoute = publicRoutes.includes(pathname);

  // Client routes
  const isClientRoute = pathname.startsWith('/client');

  // If accessing a protected route without a token, redirect appropriately
  if (!isPublicRoute && !token) {
    if (isClientRoute) {
      return NextResponse.redirect(new URL('/client-login', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If accessing login/signup page with a token, redirect to appropriate dashboard
  if (isPublicRoute && token) {
    if (pathname === '/client-login' || pathname === '/client-signup') {
      return NextResponse.redirect(new URL('/client/dashboard', request.url));
    }
    if (pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images).*)'],
};

