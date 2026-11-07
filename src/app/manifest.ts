import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Estate Management | Property & Tenancy Portal',
    short_name: 'Estate Management',
    description: 'Commercial Property & Tenancy Management System',
    start_url: '/',
    display: 'standalone',
    background_color: '#064e3b',
    theme_color: '#064e3b',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
