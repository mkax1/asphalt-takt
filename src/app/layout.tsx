import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Asphalt-Takt – Mischgut-Disposition",
  description:
    "Mischgut-Bestellungen für den Asphalt-Straßenbau erfassen, prüfen und einplanen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <StoreProvider>{children}</StoreProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
