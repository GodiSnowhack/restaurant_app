'use client';

import "./globals.css";
import { Inter } from "next/font/google";
import { ThemeProvider } from "../lib/theme-context";
import { useState, useEffect } from "react";

const inter = Inter({ subsets: ["latin"] });

// metadata не должны быть в директиве 'use client'
// это будет определено в layout-metadata.ts

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning={true}>
        <ThemeProvider>
          <div suppressHydrationWarning>
            {mounted ? children : null}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
} 