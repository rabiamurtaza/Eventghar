"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";

// Sliding duration: edit this constant to change slide speed
const SLIDE_INTERVAL_MS = 7000;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function extractStoragePathFromUrl(url: string, bucketName: string): string {
  try {
    const parsed = new URL(url);
    const marker = `/${bucketName}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx !== -1) {
      return decodeURIComponent(parsed.pathname.substring(idx + marker.length));
    }
    return parsed.pathname.split("/").pop() || "";
  } catch {
    const parts = url.split(`/${bucketName}/`);
    if (parts.length > 1) {
      return parts[1].split("?")[0];
    }
    return url.split("/").pop()?.split("?")[0] || "";
  }
}

export default function HeroSlider() {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingImages, setLoadingImages] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Swipe / Drag tracking references
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const isMouseDown = useRef<boolean>(false);
  const mouseStartX = useRef<number | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // 1. Fetch images from Supabase table hero_images with preloading
  const fetchHeroImages = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("hero_images")
        .select("image_url")
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        const urls = data.map((item) => item.image_url);
        // Preload first image for smooth instantaneous display
        const img = new Image();
        img.src = urls[0];
        img.onload = () => {
          setImages(urls);
          setLoadingImages(false);
        };
        img.onerror = () => {
          setImages(urls);
          setLoadingImages(false);
        };
      } else {
        setImages([]);
        setLoadingImages(false);
      }
    } catch (err) {
      console.warn("Could not load hero images:", err);
      setLoadingImages(false);
    }
  }, [supabase]);

  // 2. Check Admin role & subscribe to Realtime updates
  useEffect(() => {
    let isSubscribed = true;

    async function checkRole() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isSubscribed) return;
      if (session) {
        const { data: admin } = await supabase
          .from("admins")
          .select("id")
          .eq("id", session.user.id)
          .maybeSingle();
        if (isSubscribed) setIsAdmin(!!admin);
      } else {
        if (isSubscribed) setIsAdmin(false);
      }
    }

    checkRole();
    fetchHeroImages();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isSubscribed) return;
      if (session) {
        const { data: admin } = await supabase
          .from("admins")
          .select("id")
          .eq("id", session.user.id)
          .maybeSingle();
        if (isSubscribed) setIsAdmin(!!admin);
      } else {
        if (isSubscribed) setIsAdmin(false);
      }
    });

    // Realtime channel: instantly update hero images when uploaded or deleted
    const channel = supabase
      .channel("hero-images-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hero_images" },
        () => {
          fetchHeroImages();
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
      supabase.removeChannel(channel);
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
    } catch (err: unknown) {
      console.error("Hero image upload failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to upload image. Please verify admin privileges.";
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  // 8. Admin Delete Current Hero Image
  const handleConfirmDelete = async () => {
    if (images.length === 0 || deleting) return;

    const currentImageUrl = images[currentIndex];
    if (!currentImageUrl) return;

    setDeleting(true);
    setUploadError(null);
    setDeleteMessage(null);

    try {
      // Double check admin role
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("You must be logged in as an administrator to delete hero images.");
      }
      const { data: admin } = await supabase
        .from("admins")
        .select("id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!admin) {
        throw new Error("Unauthorized: Only administrators can delete hero images.");
      }

      // 1. Delete file from storage bucket so no orphaned files remain
      const storagePath = extractStoragePathFromUrl(currentImageUrl, "hero-images");
      if (storagePath) {
        const { error: storageErr } = await supabase.storage
          .from("hero-images")
          .remove([storagePath]);

        if (storageErr) {
          console.warn("Storage removal note:", storageErr);
        }
      }

      // 2. Delete record from database
      const { error: dbErr } = await supabase
        .from("hero_images")
        .delete()
        .eq("image_url", currentImageUrl);

      if (dbErr) throw dbErr;

      // 3. Smoothly update local images list and index without page refresh or flicker
      setImages((prev) => {
        const nextList = prev.filter((_, i) => i !== currentIndex);
        const nextIdx = nextList.length === 0 ? 0 : currentIndex >= nextList.length ? nextList.length - 1 : currentIndex;
        setCurrentIndex(nextIdx);
        return nextList;
      });

      setShowDeleteConfirm(false);
      setDeleteMessage("Image deleted");
      setTimeout(() => setDeleteMessage(null), 3000);
    } catch (err: unknown) {
      console.error("Hero image delete failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to delete hero image.";
      setUploadError(msg);
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
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

        {/* Loading Indicator for Hero Images */}
        {loadingImages && (
          <div className="absolute inset-0 z-15 flex flex-col items-center justify-center bg-black/50 backdrop-blur-xs transition-opacity duration-300 pointer-events-none">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-2" />
            <span className="text-[11px] font-semibold text-neutral-300 tracking-wider uppercase">
              Loading Highlights...
            </span>
          </div>
        )}

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

        {/* Dark Centered Vignette Overlay for perfect text legibility */}
        <div className="absolute inset-0 bg-black/45 pointer-events-none z-10" />

        {/* Foreground Hero Text Content (Centered) */}
        <div className="relative z-20 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center pointer-events-none pt-10 sm:pt-14 flex flex-col items-center justify-center">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white drop-shadow-md font-heading leading-tight max-w-3xl">
            Discover and Experience, Great Events
          </h1>
          <p className="mt-3 sm:mt-4 text-sm sm:text-lg lg:text-xl text-neutral-200 font-normal drop-shadow leading-relaxed font-body max-w-2xl mx-auto">
            Find the latest concerts, sports, fun parties, and trips happening near you.
          </p>
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

      {/* Admin Controls Bar (Visible STRICTLY to logged-in Admins) */}
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

          <div className="flex flex-wrap items-center gap-3">
            {uploadError && (
              <span className="text-red-400 font-medium text-xs">
                {uploadError}
              </span>
            )}
            {deleteMessage && (
              <span className="text-green-400 font-semibold text-xs">
                {deleteMessage}
              </span>
            )}

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />

            {/* Delete Image Button - only shown if there are images to delete */}
            {images.length > 0 && (
              <button
                type="button"
                disabled={deleting || uploading}
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-3 py-1.5 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Delete the currently displayed hero image"
              >
                <span>🗑️</span>
                <span>Delete Image</span>
              </button>
            )}

            <button
              type="button"
              disabled={uploading || deleting}
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

      {/* Confirmation Dialog for Deleting Hero Image */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl text-center">
            <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 mx-auto flex items-center justify-center text-lg mb-3">
              🗑️
            </div>
            <h4 className="text-base font-bold text-white mb-1">Delete Hero Image?</h4>
            <p className="text-xs text-neutral-300 mb-5 leading-relaxed">
              Delete this hero image? This cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold py-2.5 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {deleting ? (
                  <>
                    <span className="animate-spin text-xs">⏳</span>
                    <span>Deleting...</span>
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
