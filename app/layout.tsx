import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "뽀꼬오목",
  description: "가족과 1:1로 즐기는 온라인 뽀꼬오목",
  applicationName: "뽀꼬오목",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "뽀꼬오목",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0d18",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
