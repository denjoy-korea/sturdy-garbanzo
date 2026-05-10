import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "뽀꼬오목",
  description: "가족과 1:1로 즐기는 온라인 뽀꼬오목",
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
