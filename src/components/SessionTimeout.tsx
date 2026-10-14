"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function SessionTimeout() {
  const router = useRouter();
  const supabase = createClient();
  // Use ReturnType<typeof setTimeout> to avoid NodeJS vs browser typing issues
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isActive = true;
    let currentTimeoutDuration = 15 * 60 * 1000; // Default to 15 mins

    const logout = async () => {
      if (!isActive) return;
      await supabase.auth.signOut();
      router.push("/login?message=Session expired due to inactivity");
      router.refresh();
    };

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(logout, currentTimeoutDuration);
    };

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // If no session, no need to track inactivity for logout
      if (!session) return;

      // Determine the role for customized timeout
      let role = 'user';
      const { data: admin } = await supabase.from('admins').select('id').eq('id', session.user.id).single();
      
      if (admin) {
        role = 'admin';
      } else {
        const { data: organizer } = await supabase.from('organizers').select('id').eq('id', session.user.id).single();
        if (organizer) role = 'organizer';
      }
      
      // 45 minutes for admin, 15 minutes for users and organizers
      currentTimeoutDuration = role === 'admin' 
        ? 45 * 60 * 1000 
        : 15 * 60 * 1000;

      resetTimer();

      const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
      
      // We throttle the reset to avoid running it on every single pixel of mouse movement
      let throttled = false;
      const handleActivity = () => {
        if (!throttled) {
          resetTimer();
          throttled = true;
          setTimeout(() => { throttled = false; }, 1000);
        }
      };

      events.forEach(event => window.addEventListener(event, handleActivity));

      return () => {
        events.forEach(event => window.removeEventListener(event, handleActivity));
      };
    };

    let cleanupEvents: (() => void) | undefined;

    checkUser().then(cleanup => {
      cleanupEvents = cleanup;
    });
    
    // Subscribe to auth state changes to start/stop tracking
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        checkUser().then(cleanup => {
          cleanupEvents = cleanup;
        });
      } else if (event === 'SIGNED_OUT') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (cleanupEvents) cleanupEvents();
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (cleanupEvents) cleanupEvents();
    };
  }, [router, supabase]);

  return null;
}
