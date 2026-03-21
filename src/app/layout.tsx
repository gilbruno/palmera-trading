import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyJournal — Trading Journal",
  description: "Track, analyse and improve your trading performance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="h-full antialiased" style={{ backgroundColor: "var(--bg-base)" }}>
        {/* Sidebar handles both desktop fixed rail and mobile drawer */}
        <Sidebar />

        {/* Main content — offset by sidebar width on desktop */}
        <div className="lg:pl-60">
          <main className="min-h-screen p-6 lg:p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
