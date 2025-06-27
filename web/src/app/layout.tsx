import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SocketProvider } from "../context/SocketContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Backgammon",
  description: "Backgammon dev app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        <SocketProvider>
          <div
            id="top-controls"
            style={{
              width: "100%",
              zIndex: 10,
              position: "relative",
            }}
          >
            {/* Top controls will be rendered here by the board component */}
          </div>
          <main
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {children}
          </main>
        </SocketProvider>
      </body>
    </html>
  );
}
