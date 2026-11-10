import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "OpRouter — Every model, one workspace", description: "Explore and compare AI models in one workspace." };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
