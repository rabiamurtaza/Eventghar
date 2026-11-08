type SectionHeaderProps = {
  title: string;
  subtitle: string;
  titleId?: string;
};

/** Shared heading block so every home-page section looks and spaces the same. */
export default function SectionHeader({ title, subtitle, titleId }: SectionHeaderProps) {
  return (
    <div className="mb-6 sm:mb-10 text-left max-w-2xl">
      <h2
        id={titleId}
        className="text-3xl sm:text-5xl font-medium leading-[1.1] text-[#1c1230] font-serif-display"
      >
        {title}
      </h2>
      <p className="mt-1.5 sm:mt-2 text-sm sm:text-lg text-neutral-600 font-body">{subtitle}</p>
    </div>
  );
}
