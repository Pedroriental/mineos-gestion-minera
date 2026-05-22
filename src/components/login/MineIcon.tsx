type MineIconProps = {
  size?: number;
  className?: string;
};

/** Silueta de cordillera (dos picos) — símbolo de mina */
export function MineIcon({ size = 20, className }: MineIconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 20 L10 4 L13 11 L17 8 L21 20" />
    </svg>
  );
}
