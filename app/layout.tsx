import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PERCOM — PADES Microfinance",
  description: "Système de suivi des performances des agents de collecte",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}