import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'دست‌بین | تشخیص باز و بسته بودن دست', description: 'تشخیص زنده دست باز و مشت بسته با دوربین، بدون ذخیره یا ارسال تصویر.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="fa" dir="rtl"><body>{children}</body></html>; }
