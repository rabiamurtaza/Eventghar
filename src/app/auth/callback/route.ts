import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const { searchParams } = requestUrl
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  // Determine site origin: use NEXT_PUBLIC_SITE_URL, forwarded host from reverse proxy (e.g. Vercel), or request origin
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  const origin = process.env.NEXT_PUBLIC_SITE_URL || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : requestUrl.origin)

  if (code) {
    const supabase = await createClient()
    const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && authData?.user) {
      const user = authData.user
      try {
        // Check if user is already an admin or organizer
        const [adminRes, orgRes] = await Promise.all([
          supabase.from('admins').select('id').eq('id', user.id).maybeSingle(),
          supabase.from('organizers').select('id').eq('id', user.id).maybeSingle(),
        ])

        if (!adminRes.data && !orgRes.data) {
          // Record as normal user in public.users if not already exists
          await supabase.from('users').upsert({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          }, { onConflict: 'id' })
        }
      } catch (err) {
        console.error('Error syncing user profile on login:', err)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Could not verify auth code`)
}
