"use client";

import { useEffect, useRef, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function SessionTimeout() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isActive = true;
    let currentTimeoutDuration = 15 * 60 * 1000; // Default to 15 mins
    let cleanupListeners: (() => void) | null = null;

    // Last activity is shared across ALL open tabs, so an idle tab never logs out
    // a user who is active in another tab.
    const ACTIVITY_KEY = "eg_last_activity";
    const markActivity = () => {
      try { localStorage.setItem(ACTIVITY_KEY, String(Date.now())); } catch {}
    };
    const lastActivity = () => {
      try { return Number(localStorage.getItem(ACTIVITY_KEY)) || 0; } catch { return 0; }
    };

    const logout = async () => {
      if (!isActive) return;
      const idleFor = Date.now() - lastActivity();
      if (idleFor < currentTimeoutDuration) {
        // Activity happened in another tab - wait for the remaining time instead
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(logout, currentTimeoutDuration - idleFor);
        return;
      }
      await supabase.auth.signOut();
      router.push("/login?message=Session expired due to inactivity");
      router.refresh();
    };

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(logout, currentTimeoutDuration);
    };

    const removeCurrentListeners = () => {
      if (cleanupListeners) {
        cleanupListeners();
        cleanupListeners = null;
      }
    };

    const setupUserActivity = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !isActive) return;

      // Determine role safely using maybeSingle
      let role = 'user';
      const { data: admin } = await supabase.from('admins').select('id').eq('id', session.user.id).maybeSingle();

      if (admin) {
        role = 'admin';
      } else {
        const { data: organizer } = await supabase.from('organizers').select('id').eq('id', session.user.id).maybeSingle();
        if (organizer) role = 'organizer';
      }

      if (!isActive) return;

      // 2 hours for admins and organizers (gate staff scan for long periods without
      // touching the screen), 15 minutes for regular users
      currentTimeoutDuration = role === 'admin' || role === 'organizer'
        ? 2 * 60 * 60 * 1000
        : 15 * 60 * 1000;

      markActivity();
      resetTimer();

      // Clean up previous listeners before attaching new ones
      removeCurrentListeners();

      const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
      let throttled = false;
      const handleActivity = () => {
        if (!throttled) {
          markActivity();
          resetTimer();
          throttled = true;
          setTimeout(() => { throttled = false; }, 1000);
        }
      };

      events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));
      cleanupListeners = () => {
        events.forEach(event => window.removeEventListener(event, handleActivity));
      };
    };

    setupUserActivity();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        setupUserActivity();
      } else if (event === 'SIGNED_OUT') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        removeCurrentListeners();
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      removeCurrentListeners();
    };
  }, [router, supabase]);

  return null;
}
