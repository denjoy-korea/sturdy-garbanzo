import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "오목 - 1:1 온라인 대전",
  description: "친구와 1:1로 즐기는 온라인 오목",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
