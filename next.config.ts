import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: '/auth', destination: '/app/login', permanent: true },
      { source: '/login', destination: '/app/login', permanent: true },
      { source: '/dashboard/:path*', destination: '/app/dashboard/:path*', permanent: true },
    ];
  },
};

export default config;
