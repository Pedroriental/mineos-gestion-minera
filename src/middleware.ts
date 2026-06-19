import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Zero-DB middleware — reads role & complex_id exclusively from
 * user_metadata in the Supabase JWT. No database queries.
 */
const routePermissions: Record<string, string[]> = {
  '/admin-dev':    ['admin_developer'],
  '/admin':        ['admin_developer', 'admin'],
  '/mina':         ['admin_developer', 'admin', 'mining_supervisor'],
  '/planta':       ['admin_developer', 'admin', 'mill_supervisor'],
  '/reportes':     ['admin_developer', 'admin', 'mining_supervisor', 'mill_supervisor', 'guest'],
  '/plataforma':   ['admin_developer'],
  '/operaciones':  ['admin_developer', 'admin', 'guest'],
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) =>
            request.cookies.set({ name, value }),
          );
          response = NextResponse.next({ request: { headers: request.headers } });
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated → redirect to login (except root)
  if (!user && request.nextUrl.pathname !== '/') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (user) {
    const pathname = request.nextUrl.pathname;
    const userRole: string = user.user_metadata?.role ?? 'admin';

    // Check route permissions
    for (const [route, allowedRoles] of Object.entries(routePermissions)) {
      if (pathname.startsWith(route)) {
        if (!allowedRoles.includes(userRole)) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        break;
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/admin-dev/:path*',
    '/admin/:path*',
    '/mina/:path*',
    '/planta/:path*',
    '/reportes/:path*',
    '/plataforma/:path*',
    '/operaciones/:path*',
  ],
};
