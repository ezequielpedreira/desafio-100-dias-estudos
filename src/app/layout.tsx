import type { Metadata, Viewport } from "next";
import { Nunito_Sans, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { brand } from "@/lib/brand";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const bodyFont = Nunito_Sans({ variable: "--font-body", subsets: ["latin"] });
const displayFont = Space_Grotesk({ variable: "--font-display", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.description,
};

export const viewport: Viewport = { themeColor: "#6c4cff", colorScheme: "light dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  const themeScript = `(function(){try{var t=localStorage.getItem('levelup100-theme')==='dark'?'dark':'light';document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.style.colorScheme=t}catch(e){document.documentElement.style.colorScheme='light'}})()`;
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
