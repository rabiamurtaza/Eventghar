import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: string;
  subtitle: string;
  titleId?: string;
  /** Optional control shown at the right end of the heading (for example a search button). */
  action?: ReactNode;
};

/** Shared heading block so every home-page section looks and spaces the same. */
export default function SectionHeader({ title, subtitle, titleId, action }: SectionHeaderProps) {
  return (
    <div className="mb-6 sm:mb-10 flex items-end justify-between gap-4">
      <div className="min-w-0 text-left max-w-2xl">
        <h2
          id={titleId}
          className="text-3xl sm:text-5xl font-medium leading-[1.1] text-[#1c1230] font-serif-display"
        >
          {title}
        </h2>
        <p className="mt-1.5 sm:mt-2 text-sm sm:text-lg text-neutral-600 font-body">{subtitle}</p>
      </div>
      {action ? <div className="relative shrink-0 pb-1">{action}</div> : null}
    </div>
  );
}
