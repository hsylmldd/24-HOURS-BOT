import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Allow webhook endpoint to be accessed without authentication
  if (request.nextUrl.pathname.startsWith('/api/webhook')) {
    return NextResponse.next()
  }
  
  // Allow health check endpoint
  if (request.nextUrl.pathname.startsWith('/api/health')) {
    return NextResponse.next()
  }
  
  // Allow cron endpoint
  if (request.nextUrl.pathname.startsWith('/api/cron')) {
    return NextResponse.next()
  }
  
  // Allow stats endpoint
  if (request.nextUrl.pathname.startsWith('/api/stats')) {
    return NextResponse.next()
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*'
  ]
}