import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DoorScout",
  description: "because putting the numbers on the door is too hard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
