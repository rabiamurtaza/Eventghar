import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  const isBookEvent = path.startsWith('/book-event')
  const isAdmin = path.startsWith('/admin')
  const isOrganizer = path.startsWith('/organizer')
  const isMyAccount = path.startsWith('/my-account')

  if (!isBookEvent && !isAdmin && !isOrganizer && !isMyAccount) {
    return supabaseResponse
  }

  // Not logged in -> redirect to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  // If we reach here, user is logged in. Let's fetch their role.
  let role = 'user';
  const { data: admin } = await supabase.from('admins').select('id').eq('id', user.id).single();
  
  if (admin) {
    role = 'admin';
  } else {
    const { data: organizer } = await supabase.from('organizers').select('id').eq('id', user.id).single();
    if (organizer) {
      role = 'organizer';
    }
  }

  // Admin routes protection: only admins allowed
  if (isAdmin) {
    if (role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  // Organizer routes protection: only organizers and admins allowed
  if (isOrganizer) {
    if (role !== 'organizer' && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/book-event/:path*',
    '/admin/:path*',
    '/organizer/:path*',
    '/my-account/:path*',
  ],
}
