import type { Metadata, Viewport } from "next";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Medi-Track",
  description: "Multi-tenant clinic management",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
