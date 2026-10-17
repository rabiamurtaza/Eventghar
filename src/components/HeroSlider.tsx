"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

// Sliding duration: edit this constant to change slide speed
const SLIDE_INTERVAL_MS = 7000;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function HeroSlider() {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Swipe / Drag tracking references
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const isMouseDown = useRef<boolean>(false);
  const mouseStartX = useRef<number | null>(null);

  const supabase = createClient();

  // 1. Fetch images from Supabase table hero_images
  const fetchHeroImages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("hero_images")
        .select("image_url")
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        setImages(data.map((item) => item.image_url));
      }
    } catch (err) {
      console.warn("Could not load hero images:", err);
    }
  }, [supabase]);

  // 2. Check Admin role (matching Navbar logic)
  useEffect(() => {
    async function checkRole() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: admin } = await supabase
          .from("admins")
          .select("id")
          .eq("id", session.user.id)
          .single();
        setIsAdmin(!!admin);
      } else {
        setIsAdmin(false);
      }
    }

    checkRole();
    fetchHeroImages();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        supabase
          .from("admins")
          .select("id")
          .eq("id", session.user.id)
          .single()
          .then(({ data }) => setIsAdmin(!!data));
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchHeroImages]);

  // 3. Slide navigation helpers
  const goToNext = useCallback(() => {
    if (images.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goToPrev = useCallback(() => {
    if (images.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // 4. Timer setup & restart
  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (images.length > 1) {
      timerRef.current = setInterval(() => {
        goToNext();
      }, SLIDE_INTERVAL_MS);
    }
  }, [images.length, goToNext]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resetTimer]);

  // 5. Mobile Swipe Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 50) {
      // Swiped left -> next
      goToNext();
      resetTimer();
    } else if (distance < -50) {
      // Swiped right -> prev
      goToPrev();
      resetTimer();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // 6. Desktop Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isMouseDown.current = true;
    mouseStartX.current = e.clientX;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isMouseDown.current || mouseStartX.current === null) return;
    const distance = mouseStartX.current - e.clientX;
    if (distance > 50) {
      goToNext();
      resetTimer();
    } else if (distance < -50) {
      goToPrev();
      resetTimer();
    }
    isMouseDown.current = false;
    mouseStartX.current = null;
  };

  const handleMouseLeave = () => {
    isMouseDown.current = false;
    mouseStartX.current = null;
  };

  // 7. Admin File Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validate type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError("Invalid format: Only JPEG, PNG, and WebP images are accepted.");
      return;
    }

    // Validate size (max 5 MB)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setUploadError("File too large: Image must be smaller than 5 MB.");
      return;
    }

    setUploading(true);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `hero-${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

      // Upload to public 'hero-images' storage bucket
      const { error: uploadErr } = await supabase.storage
        .from("hero-images")
        .upload(fileName, file);

      if (uploadErr) throw uploadErr;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("hero-images")
        .getPublicUrl(fileName);

      const imageUrl = publicUrlData.publicUrl;

      // Insert record into 'hero_images' database table
      const { error: insertErr } = await supabase
        .from("hero_images")
        .insert([{ image_url: imageUrl }]);

      if (insertErr) throw insertErr;

      // Immediately add to local state without page reload
      setImages((prev) => {
        const nextList = [...prev, imageUrl];
        setCurrentIndex(nextList.length - 1);
        return nextList;
      });

      // Clear file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      console.error("Hero image upload failed:", err);
      setUploadError(err.message || "Failed to upload image. Please verify admin privileges.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Hero Section Container (Full bleed edge-to-edge, no border, no rounded corners) */}
      <section
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className="relative w-full h-[440px] sm:h-[500px] lg:h-[560px] overflow-hidden select-none cursor-grab active:cursor-grabbing bg-neutral-950 flex flex-col justify-center items-center"
      >
        {/* Fallback Background (when no images exist yet) */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-neutral-900 to-black z-0" />

        {/* Sliding Background Images with smooth crossfade */}
        {images.map((imgUrl, idx) => (
          <div
            key={imgUrl + idx}
            style={{ backgroundImage: `url(${imgUrl})` }}
            className={`absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-1000 ease-in-out pointer-events-none z-0 ${
              idx === currentIndex ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}

        {/* Dark Left Fade Overlay for perfect text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent pointer-events-none z-10" />

        {/* Foreground Hero Text Content (Left-aligned) */}
        <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left pointer-events-none pt-12 sm:pt-16">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl drop-shadow-md font-heading leading-tight">
              Discover & Experience Great Events
            </h1>
            <p className="mt-4 text-base sm:text-lg lg:text-xl text-neutral-200 font-normal drop-shadow leading-relaxed font-body">
              Find the latest concerts, workshops, conferences, and meetups happening near you.
            </p>
          </div>
        </div>

        {/* Non-Clickable Dot Indicators at Bottom Center */}
        {images.length > 1 && (
          <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center items-center gap-2 pointer-events-none">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all duration-500 ${
                  i === currentIndex
                    ? "w-7 bg-white shadow-md shadow-white/40"
                    : "w-2 bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Admin "Add Image" Action (Visible STRICTLY to logged-in Admins) */}
      {isAdmin && (
        <div className="bg-neutral-900 border-b border-neutral-800 py-3 px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-neutral-300">
            <span className="font-bold text-indigo-400 uppercase tracking-wider text-[11px]">
              Admin Controls:
            </span>
            <span>
              {images.length} hero image{images.length === 1 ? "" : "s"} active
            </span>
          </div>

          <div className="flex items-center gap-3">
            {uploadError && (
              <span className="text-red-400 font-medium text-xs">
                {uploadError}
              </span>
            )}

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />

            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold px-3.5 py-1.5 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {uploading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Uploading Image...</span>
                </>
              ) : (
                <>
                  <span>➕</span>
                  <span>Add Hero Image</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
