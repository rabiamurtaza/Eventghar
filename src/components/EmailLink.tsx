"use client";

import type { AnchorHTMLAttributes } from "react";
import { siteConfig } from "@/config/site";

function isMobileDevice() {
  const ua = navigator.userAgent || "";
  // iPadOS pretends to be a Mac, so it is recognised by its touch screen
  return /Android|iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * "Email us" link with the subject and message already filled in.
 *  - Phones and tablets: opens the mail app (a normal mailto link).
 *  - Computers: many have no mail program set up, so the mailto link would do nothing.
 *    Instead the same message opens in Gmail's website in a new tab.
 * The link address is always the mailto link, so it still works if the page is
 * opened without scripts or the link is copied.
 */
export default function EmailLink({
  children,
  onClick,
  ...rest
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <a
      {...rest}
      href={siteConfig.emailUrl}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (!isMobileDevice()) {
          e.preventDefault();
          window.open(siteConfig.emailWebUrl, "_blank", "noopener,noreferrer");
        }
      }}
    >
      {children}
    </a>
  );
}
