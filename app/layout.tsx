import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moiré — Cafe24 AI Shop Maker",
  description: "프롬프트로 만들고, 클릭으로 고치는 Cafe24 AI 쇼핑몰 빌더",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
