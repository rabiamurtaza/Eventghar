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

        // Extract the best name provided by Google OAuth
        const rawName = (
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.user_metadata?.display_name ||
          [user.user_metadata?.given_name, user.user_metadata?.family_name].filter(Boolean).join(' ') ||
          user.email?.split('@')[0] ||
          'User'
        ).trim();

        if (!adminRes.data && !orgRes.data) {
          // Check if record already exists in public.users
          const { data: existingUser } = await supabase
            .from('users')
            .select('id, full_name')
            .eq('id', user.id)
            .maybeSingle();

          if (!existingUser) {
            await supabase.from('users').insert({
              id: user.id,
              email: user.email || '',
              full_name: rawName,
            });
          } else if ((!existingUser.full_name || existingUser.full_name === 'User') && rawName !== 'User') {
            await supabase.from('users').update({
              full_name: rawName,
            }).eq('id', user.id);
          }
        } else if (orgRes.data) {
          // If organizer exists with empty name, update with Google name
          const { data: existingOrg } = await supabase
            .from('organizers')
            .select('id, full_name')
            .eq('id', user.id)
            .maybeSingle();

          if (existingOrg && (!existingOrg.full_name || existingOrg.full_name === 'User') && rawName !== 'User') {
            await supabase.from('organizers').update({
              full_name: rawName,
            }).eq('id', user.id);
          }
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
