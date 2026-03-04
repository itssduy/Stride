import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata = {
  title: "Stride PM",
  description: "Minimal team project management app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
