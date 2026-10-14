"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

function SignupForm() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const redirectUrl = searchParams.get("redirect") || "/my-account";
  const rawMessage = searchParams.get("message");
  const isBookingRedirect = redirectUrl.startsWith("/book/");
  
  // Clear professional message for users trying to book tickets
  const displayMessage = rawMessage || (isBookingRedirect ? "Please create an account or log in first to book your tickets." : null);

  const handleGoogleSignup = async () => {
    // Preserve the destination so user returns seamlessly after sign up
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectUrl)}`,
      },
    });
  };

  // Build login href to preserve redirect and message
  const loginParams = new URLSearchParams();
  if (redirectUrl && redirectUrl !== "/my-account") loginParams.set("redirect", redirectUrl);
  if (displayMessage) loginParams.set("message", displayMessage);
  const loginHref = loginParams.toString() ? `/login?${loginParams.toString()}` : "/login";

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        {displayMessage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-left animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm mt-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Account Required</p>
                <p className="mt-0.5 text-xs font-semibold text-amber-900 leading-relaxed">
                  {displayMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-3xl font-extrabold text-slate-900">Create an account</h2>
          <p className="mt-2 text-sm text-slate-600">
            Join Event Ghar securely with your Google account
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <button 
            onClick={handleGoogleSignup}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>
        <p className="mt-6 text-sm text-slate-600">
          Already have an account?{" "}
          <Link href={loginHref} className="font-semibold text-purple-600 hover:text-purple-700 transition">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center text-slate-500">Loading...</div>}>
      <SignupForm />
    </Suspense>
  );
}
