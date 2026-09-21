/** @type {import('next').NextConfig} */
const nextConfig = {
  // The desktop app ships the static export in ./out, served by Electron from app://kamaiplus.
  output: 'export',
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
