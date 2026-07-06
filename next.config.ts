import type { NextConfig } from 'next';

// Tenant hosts are derived from the NEXT_PUBLIC_* build args baked into each
// image (Dockerfile ARGs; per-tenant images bake their own domain — sofra
// ADR-003, issue #123) so the same config builds for any tenant domain.
// Fallback keeps a bare local `next dev`/`next build` working against the
// default dev backend.
const DEV_API_ORIGIN = 'http://localhost:5221';

// Unset is a valid state (bare local build → dev fallback); a set-but-invalid
// value must fail the build — silently falling back would ship a broken CSP.
const toOrigin = (name: string, value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    throw new Error(`${name} must be an absolute URL, got: "${value}"`);
  }
};

const apiOrigin = toOrigin('NEXT_PUBLIC_API_URL', process.env.NEXT_PUBLIC_API_URL) ?? DEV_API_ORIGIN;
const imageBase = toOrigin('NEXT_PUBLIC_IMAGE_BASE_URL', process.env.NEXT_PUBLIC_IMAGE_BASE_URL);

const connectSrc = ["'self'", apiOrigin, 'https://accounts.google.com', 'https://www.gstatic.com']
  .filter((entry, index, all) => all.indexOf(entry) === index)
  .join(' ');

const imageBaseRemotePatterns = (() => {
  if (!imageBase) return [];
  const url = new URL(imageBase);
  return [
    {
      protocol: url.protocol === 'http:' ? ('http' as const) : ('https' as const),
      hostname: url.hostname,
    },
  ];
})();

const nextConfig: NextConfig = {
  // Enable standalone output for Docker containers
  output: 'standalone',

  experimental: {
    // allowedDevOrigins can be added if needed for cloud workstations
  },

  /* Security Configuration */
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://www.gstatic.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: https: blob:",
              `connect-src ${connectSrc}`,
              "frame-src 'self' https://accounts.google.com https://www.google.com https://maps.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              'upgrade-insecure-requests',
            ].join('; '),
          },
        ],
      },
    ];
  },

  // Disable powered-by header
  poweredByHeader: false,

  // Production optimizations
  compress: true,

  // Image optimization security
  images: {
    remotePatterns: [
      // Tenant image host comes from NEXT_PUBLIC_IMAGE_BASE_URL (issue #123).
      ...imageBaseRemotePatterns,
      {
        // Static menu JSON hotlinks (legacy) — retired with issue #124.
        protocol: 'https',
        hostname: 'restaurant-admin-api.orderhub.ch',
        pathname: '/web-images/**',
      },
      {
        // Google account avatars.
        protocol: 'https',
        hostname: 'lh3.google.com',
        pathname: '/u/0/d/**',
      },
    ],
    deviceSizes: [640, 828, 1200],
    imageSizes: [64, 96, 128],
    formats: ['image/webp'],
    unoptimized: true,
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
