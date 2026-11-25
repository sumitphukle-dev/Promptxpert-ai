import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import CommandPalette from "@/components/CommandPalette";
import RouteTransition from "@/components/RouteTransition";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata = {
  title: "PromptXpert AI: professional prompts and image intelligence",
  description: "Build and analyze professional prompts, recreate prompts from images, and inspect image authenticity signals.",
};
export const viewport = { themeColor: "#080A12" };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Providers>
          <Navbar />
          <CommandPalette />
          <RouteTransition>{children}</RouteTransition>
        </Providers>
      </body>
    </html>
  );
}
