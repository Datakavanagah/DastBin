import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "دست‌بین AI | آزمایشگاه بینایی دست",
  description:
    "تشخیص چنددست، انگشت‌ها و حرکت‌ها، رهگیری زنده، تاریخچه و آموزش حرکت سفارشی؛ با پردازش محلی در مرورگر.",
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
