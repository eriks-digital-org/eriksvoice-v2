import type { Metadata, Viewport } from "next";
import { Fredoka, Rubik } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Fredoka draws Latin letters and digits; it has no Hebrew, so Hebrew falls to Rubik.
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"], display: "swap" });
const rubik = Rubik({ variable: "--font-rubik", subsets: ["hebrew", "latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "EriksVoice", template: "%s · EriksVoice" },
  description: "EriksVoice: סוכני AI קוליים שעונים לכל שיחה ומוציאים שיחות.",
  icons: { icon: "/brand/eriks-mark.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f1ecfd",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${fredoka.variable} ${rubik.variable}`}>
      <body>
        {children}
        <Toaster position="top-center" dir="rtl" />
      </body>
    </html>
  );
}
