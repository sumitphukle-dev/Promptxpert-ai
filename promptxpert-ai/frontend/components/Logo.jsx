export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="14" stroke="#8F83FF" strokeWidth="2" />
      <path d="M16 2 L22 14 M30 16 L18 22 M16 30 L10 18 M2 16 L14 10" stroke="#EDF1FF" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="3.2" fill="#3DDDB4" />
    </svg>
  );
}
