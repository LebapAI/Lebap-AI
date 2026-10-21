import { useTheme } from "@/hooks/useTheme";

export function OnboardingLogoSVG() {
  const { isLight } = useTheme();
  return (
    <svg
      viewBox="0 0 818 514"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lebap-onboarding-brand" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#4930ff" />
          <stop offset=".48" stopColor="#087cff" />
          <stop offset="1" stopColor="#22e6e9" />
        </linearGradient>
      </defs>
      <g
        transform="translate(150 0) scale(5.35)"
        opacity={isLight ? 0.12 : 0.2}
      >
        <path
          d="M39 8 25 16c-3 2-5 5-5 9v40c0 5 2 9 6 11l13 8c4 2 8 2 12 0l15-9c7-4 10-10 10-17 0-7-4-13-10-17L42 29v15l16 10c2 1 3 3 3 5s-1 4-3 5l-9 5c-2 1-4 1-6 0l-8-5c-2-1-3-3-3-5V23l7-4z"
          fill="url(#lebap-onboarding-brand)"
        />
      </g>
    </svg>
  );
}
