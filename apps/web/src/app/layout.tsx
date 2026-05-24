import type { Metadata } from "next";

import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zap Electrical Dashboard",
  description: "Internal performance and forecasting dashboard for Zap Electrical"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-sand text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
