import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import SiteFooter from "@/components/site/SiteFooter";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space",
});
const sans = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "East Bay Stringing — mobile racquet stringing",
  description:
    "Mobile racquet stringing for the East Bay. Three convenient meetup spots, no storefront, wholesale strings — lower prices, fast turnaround, pay in person.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
