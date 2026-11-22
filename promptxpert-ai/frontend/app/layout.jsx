import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata = {
  title: "PromptXpert AI: image authenticity signals and prompt reconstruction",
  description: "Check an image's AI-generation signals and provenance, then rebuild an editable prompt from it.",
};
export const viewport = { themeColor: "#080A12" };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
