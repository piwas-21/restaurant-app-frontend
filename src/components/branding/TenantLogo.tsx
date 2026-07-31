'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';
import type { RestaurantInfoDto } from '@/types/restaurantInfo';

/** The SofraPiwas onion mark. Platform-owned, so deliberately NOT under
 * `public/branding/` — that directory is the tenant-overridable set, and this must not be
 * something a tenant image replaces. */
const BRAND_MARK = '/brand-mark.svg';

/**
 * The restaurant's mark in a header — its uploaded logo, or a designed LOCKUP of the
 * SofraPiwas mark next to the restaurant's own name (SOFRA-ONBOARDING-PLAN O6).
 *
 * One component for all three chromes (classic customer, craft customer, the shared staff
 * layout) because the fallback rule is the load-bearing part, not the markup. Before O6 the
 * chromes rendered a logo BAKED into the image — tenant-1's — which no tenant could change,
 * so every self-serve restaurant's header showed another restaurant's brand.
 *
 * The fallback is a lockup rather than bare text because a header is the one place a
 * restaurant's identity is asserted: plain text reads as a missing asset, whereas mark +
 * name reads as a logo the tenant simply has not personalised yet. Each template supplies
 * its own typeface and sizing through the class props, so the lockup is *designed* per
 * theme — Inter on classic, Amatic SC on craft — rather than one generic treatment.
 *
 * The mark is decorative: the name beside it carries the accessible name, exactly as in
 * sofra's own `BrandMark`.
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
  /** Applied to the lockup wrapper (mark + wordmark) in the no-logo case. */
  lockupClassName?: string;
  /** Applied to the brand mark inside the lockup. */
  markClassName?: string;
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
  lockupClassName,
  markClassName,
  priority = false,
}: Readonly<TenantLogoProps>) {
  const src = resolveLogoSrc(info, isDark);
  const name = info?.name || fallbackName;

  if (!src) {
    return (
      <span className={lockupClassName}>
        {/* A plain <img>: next/image adds no optimization for a static inline SVG.
            width/height are the SVG's own viewBox and exist ONLY to give the browser an
            intrinsic ratio — without them the mark is 0px wide until a 66KB trace loads
            and the name beside it jumps ~44px, above the fold, on every route. CSS sets
            the rendered height. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
        <img src={BRAND_MARK} alt="" aria-hidden="true" width={452} height={501} className={markClassName} />
        <span className={textClassName}>{name}</span>
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
