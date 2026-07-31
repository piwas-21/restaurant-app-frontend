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
  priority?: boolean;
}

/**
 * Resolves which stored logo to show, or null for the text fallback.
 *
 * The preferred variant wins, then EITHER other upload, then text. Falling back in both
 * directions — not just dark→light — is what stops a header from changing identity on a
 * tenant who uploaded only one logo. The dark→light direction is the obvious one; the
 * light→dark direction matters because `isDark` is not only the theme: both classic
 * chromes ask for the dark mark on the home page in light theme, because the hero behind
 * it is dark. A tenant with only a dark logo would otherwise show their mark on `/` and
 * their name as text on `/menu`, in one browsing session at one theme setting.
 */
export function resolveLogoSrc(info: RestaurantInfoDto | null, isDark: boolean): string | null {
  if (!info) return null;
  const [preferred, other] = isDark ? [info.logoDarkUrl, info.logoUrl] : [info.logoUrl, info.logoDarkUrl];
  // `||` rather than `??`: the backend normalises "no logo" to null, but a stored empty
  // string would sail through `??` and reach the <img> as an empty src — a broken-image
  // icon where the restaurant's name should be. Falling back on '' too costs nothing.
  return preferred || other || null;
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
  priority = false,
}: TenantLogoProps) {
  const src = resolveLogoSrc(info, isDark);
  const name = info?.name || fallbackName;

  if (!src) {
    return <span className={textClassName}>{name}</span>;
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
