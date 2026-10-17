"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { ShieldCheck, Sparkles, ArrowRight, Lock } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const redirectUrl = searchParams.get("redirect") || "/my-account";
  const rawMessage = searchParams.get("message");
  const isBookingRedirect = redirectUrl.startsWith("/book/");
  
  // Clear professional message for users trying to book tickets
  const displayMessage = rawMessage || (isBookingRedirect ? "Please log in or create an account first to book your tickets." : null);

  const handleGoogleLogin = async () => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    // Preserve the destination so user returns seamlessly after sign in
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(redirectUrl)}`,
      },
    });
  };

  // Build signup href to preserve redirect and message
  const signupParams = new URLSearchParams();
  if (redirectUrl && redirectUrl !== "/my-account") signupParams.set("redirect", redirectUrl);
  if (displayMessage) signupParams.set("message", displayMessage);
  const signupHref = signupParams.toString() ? `/signup?${signupParams.toString()}` : "/signup";

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-radial from-emerald-500/5 via-neutral-50 to-neutral-100 dark:from-emerald-950/20 dark:via-neutral-950 dark:to-black px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 p-8 sm:p-10 shadow-xl backdrop-blur-md text-center relative overflow-hidden">
        
        {/* Subtle decorative top accent line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500" />

        {displayMessage && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/40 p-4 text-left animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">Login Required</p>
                <p className="mt-0.5 text-xs font-semibold text-amber-900 dark:text-amber-200 leading-relaxed">
                  {displayMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 mb-3">
            <Sparkles className="w-3 h-3" />
            <span>Fast Events Authentication</span>
          </div>
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">Welcome Back</h2>
          <p className="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Sign in with your Google account to access your digital QR tickets, booking status, and organizer desks.
          </p>
        </div>
        
        <div className="pt-2">
          <button 
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750 px-5 py-3.5 text-sm font-bold text-neutral-900 dark:text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        <div className="flex items-center gap-2 justify-center text-[11px] text-neutral-500 dark:text-neutral-400 pt-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>256-bit TLS encrypted authentication</span>
        </div>

        <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Don&apos;t have an account?{" "}
            <Link href={signupHref} className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1">
              <span>Create one</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center text-neutral-500">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
