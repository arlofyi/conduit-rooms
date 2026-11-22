// Icons Rooms needs that Conduit does not have. Same style as Icons.tsx:
// 24px viewBox, stroke based, 1.8 stroke width, round caps, currentColor.

type IconProps = { size?: number; className?: string };

const svg = (size: number, className: string | undefined, children: React.ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ flexShrink: 0 }}
    aria-hidden
  >
    {children}
  </svg>
);

export const ImageIcon = ({ size = 15, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4.5 17.5l4.6-4.4 3.2 3 2.6-2.4 4.6 4.1" />
    </>,
  );

export const ArrowDownIcon = ({ size = 14, className }: IconProps) =>
  svg(size, className, <path d="M12 5v14M6 13l6 6 6-6" />);

export const StopIcon = ({ size = 12, className }: IconProps) =>
  svg(size, className, <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />);

export const PaletteIcon = ({ size = 13, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
    </>,
  );

export const CheckIcon = ({ size = 12, className }: IconProps) =>
  svg(size, className, <path d="M5 12.5l4.5 4.5L19 7.5" />);

export const HashIcon = ({ size = 13, className }: IconProps) =>
  svg(size, className, <path d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16" />);

export const PowerIcon = ({ size = 12, className }: IconProps) =>
  svg(size, className, <path d="M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0" />);
