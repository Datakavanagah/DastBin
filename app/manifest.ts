import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'دست‌بین AI | Dastbin AI',
    short_name: 'دست‌بین',
    description:
      'Privacy-first, real-time hand tracking and gesture recognition in the browser.',
    start_url: '/',
    display: 'standalone',
    background_color: '#07100b',
    theme_color: '#a4ff5f',
    lang: 'fa',
    dir: 'rtl',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
