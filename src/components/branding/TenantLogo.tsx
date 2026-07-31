'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';
import type { RestaurantInfoDto } from '@/types/restaurantInfo';

/**
 * The restaurant's mark in a header — its uploaded logo, or its NAME as text
 * (SOFRA-ONBOARDING-PLAN O6).
 *
 * One component for all three chromes (classic customer, craft customer, the shared staff
 * layout) because the fallback rule is the load-bearing part, not the markup. Before O6 the
 * chromes rendered a logo BAKED into the image — tenant-1's — which no tenant could change,
 * so every self-serve restaurant's header showed another restaurant's brand. A stand-in
 * image would recreate that; a name always belongs to the tenant reading it.
 *
 * The three chromes differ only in sizing and class names, which arrive as props. Keeping
 * the resolution in one place is also what stops the three copies from drifting into three
 * different answers to "what happens when there is no dark logo?".
 */
/**
 * The wordmark style the two `classic`-family chromes share (the customer chrome and the
 * shared staff chrome render byte-identical headers by design — see the ROLE note at the
 * top of `app-internal-layout.tsx`). Exported rather than copied so the two cannot drift,
 * and so `craft`, which has its own Amatic SC wordmark, is free to ignore it.
 */
export const WORDMARK_STYLE: CSSProperties = {
  marginRight: '10px',
  fontSize: '1.5rem',
  fontWeight: 700,
  letterSpacing: '0.02em',
  color: 'var(--primary-color)',
  whiteSpace: 'nowrap',
};

export interface TenantLogoProps {
  /** Restaurant info; null while loading, which renders the name fallback. */
  info: RestaurantInfoDto | null;
  /** Name to show when there is no logo (and as the alt text). */
  fallbackName: string;
  /** Whether the surrounding chrome is currently rendering dark. */
  isDark: boolean;
  width: number;
  height: number;
  /** Applied to the <img>. */
  imageClassName?: string;
  imageStyle?: CSSProperties;
  /** Applied to the text wordmark, which is a different element with different needs. */
  textClassName?: string;
  textStyle?: CSSProperties;
  priority?: boolean;
}

/**
 * Resolves which stored logo to show, or null for the text fallback.
 *
 * Dark falls back to light rather than to text: one logo that reads on both themes is the
 * common case, and demanding a second upload before showing anything would leave a tenant
 * who uploaded one logo with a header that changes identity when the theme flips.
 */
export function resolveLogoSrc(info: RestaurantInfoDto | null, isDark: boolean): string | null {
  if (!info) return null;
  const preferred = isDark ? info.logoDarkUrl : info.logoUrl;
  // `||` rather than `??`: the backend normalises "no logo" to null, but a stored empty
  // string would sail through `??` and reach the <img> as an empty src — a broken-image
  // icon where the restaurant's name should be. Falling back on '' too costs nothing.
  return preferred || info.logoUrl || null;
}

export default function TenantLogo({
  info,
  fallbackName,
  isDark,
  width,
  height,
  imageClassName,
  imageStyle,
  textClassName,
  textStyle,
  priority = false,
}: TenantLogoProps) {
  const src = resolveLogoSrc(info, isDark);
  const name = info?.name || fallbackName;

  if (!src) {
    return (
      <span className={textClassName} style={textStyle}>
        {name}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={name}
      width={width}
      height={height}
      className={imageClassName}
      style={imageStyle}
      priority={priority}
    />
  );
}
