import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  applicationName: 'دست‌بین AI',
  title: {
    default: 'دست‌بین AI | آزمایشگاه بینایی دست',
    template: '%s | دست‌بین AI',
  },
  description:
    'تشخیص چنددست، انگشت‌ها و حرکت‌ها، رهگیری زنده، تاریخچه و آموزش حرکت سفارشی؛ با پردازش محلی در مرورگر.',
  keywords: [
    'تشخیص حرکت دست',
    'بینایی ماشین',
    'Hand Tracking',
    'Gesture Recognition',
    'MediaPipe',
    'WebAssembly',
  ],
  category: 'technology',
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    siteName: 'دست‌بین AI',
    title: 'دست‌بین AI | آزمایشگاه بینایی دست',
    description: 'رهگیری زنده دست و تشخیص ژست، کاملاً محلی و داخل مرورگر.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'دست‌بین AI',
    description:
      'Privacy-first hand tracking and gesture recognition in the browser.',
  },
};

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#07100b' },
    { media: '(prefers-color-scheme: light)', color: '#f4f7f2' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
