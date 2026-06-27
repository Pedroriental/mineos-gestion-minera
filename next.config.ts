/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        // Forzar revalidacion en cada request del HTML de la app.
        // Los chunks /_next/static/* mantienen su cache (tienen hash
        // unico por build), pero el HTML siempre se revalida contra
        // el servidor. Esto evita que el navegador sirva HTML viejo
        // despues de un deploy.
        source: '/((?!_next/static|_next/image|favicon.ico|brand).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
