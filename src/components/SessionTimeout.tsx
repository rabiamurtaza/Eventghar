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

      // 45 minutes for admin, 15 minutes for users and organizers
      currentTimeoutDuration = role === 'admin' 
        ? 45 * 60 * 1000 
        : 15 * 60 * 1000;

      resetTimer();

      // Clean up previous listeners before attaching new ones
      removeCurrentListeners();

      const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
      let throttled = false;
      const handleActivity = () => {
        if (!throttled) {
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
