/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Allows Vercel production build to succeed
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;