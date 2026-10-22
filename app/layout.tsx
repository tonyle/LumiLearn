import type { Metadata, Viewport } from "next";
import "./globals.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:{default:"LumiLearn Home",template:"%s · LumiLearn"},description:"Private family learning studio",manifest:"/manifest.webmanifest"};
export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#4f46e5"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
