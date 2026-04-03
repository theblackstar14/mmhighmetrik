import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.ngrok-free.app'],
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig