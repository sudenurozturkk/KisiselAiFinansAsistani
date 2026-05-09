import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Akıllı Finans Asistanı — AI Destekli Kişisel Finans Platformu",
  description:
    "Gemini AI ile kişisel finans yönetimi, bütçe takibi, akıllı alışveriş tavsiyeleri ve finansal okuryazarlık koçu. Agentic AI destekli akıllı finans asistanı.",
  keywords: [
    "finans asistanı",
    "bütçe yönetimi",
    "yapay zeka",
    "gemini",
    "kişisel finans",
    "tasarruf",
    "e-ticaret",
    "finansal okuryazarlık",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ToastProvider>
          <div className="min-h-screen flex">
            <Sidebar />
            <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6 lg:p-10 max-w-7xl mx-auto w-full">
              {children}
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
