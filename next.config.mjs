/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // allowedDevOrigins: ["3000-firebase-rumi-restaurant-web-1747075444577.cluster-axf5tvtfjjfekvhwxwkkkzsk2y.cloudworkstations.dev"], // Temporarily comment out to avoid warning, will re-evaluate if needed for deployment
  },
  // Other configurations can go here
  images: {
    domains: ['lh3.google.com'],
  },
};

export default nextConfig;

