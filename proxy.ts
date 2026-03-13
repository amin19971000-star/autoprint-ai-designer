import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(_request: NextRequest) {
  const response = NextResponse.next();

  response.headers.delete('X-Frame-Options');

  response.headers.set(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://vnvbcn-0r.myshopify.com https://*.shopify.com https://*.myshopify.com;"
  );

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
