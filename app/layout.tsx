import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOLIVE — AI Design Platform for Cafe24",
  description: "쇼핑몰을 만들고, 바꾸고, 계속 살아있게. AI Design Platform for Cafe24",
  openGraph: {
    title: "MOLIVE — AI Design Platform for Cafe24",
    description: "쇼핑몰을 만들고, 바꾸고, 계속 살아있게.",
    siteName: "MOLIVE",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "MOLIVE — AI Design Platform for Cafe24",
    description: "쇼핑몰을 만들고, 바꾸고, 계속 살아있게.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
