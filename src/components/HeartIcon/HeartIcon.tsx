interface Props {
  filled: boolean;
  size?: number;
  color: string;
}

export default function HeartIcon({ filled, size = 20, color }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={filled ? 0 : 2}
      style={{ display: 'block' }}
    >
      <path d="M12 21s-6.716-4.365-9.428-8.28C.665 9.882 1.02 6.31 3.464 4.293 5.58 2.55 8.36 2.94 10 4.7L12 6.86l2-2.16c1.64-1.76 4.42-2.15 6.536-.407 2.444 2.017 2.8 5.589.892 8.427C18.716 16.635 12 21 12 21z" />
    </svg>
  );
}
