/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // ⬇️ laat de build niet falen op ESLint-fouten
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
