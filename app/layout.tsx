import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/use-toast";

export const metadata: Metadata = {
  title: "Desdobra ERP",
  description: "Advanced ERP System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
