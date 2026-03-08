import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Challenge Apnée",
  description: "Saisie des feuilles de distances",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <main className="mx-auto max-w-6xl p-6">{children}</main>
      </body>
    </html>
  );
}
