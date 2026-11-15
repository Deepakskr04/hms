import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lodge Management System",
  description: "Custom Lodge Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isLocalTest = process.env.LOCAL_TEST_MODE === "true";

  const content = (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );

  if (isLocalTest) {
    return content;
  }

  return <ClerkProvider>{content}</ClerkProvider>;
}
