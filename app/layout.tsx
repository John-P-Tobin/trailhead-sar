import type { Metadata } from "next";
import SafetyFooter from "@/components/SafetyFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trailhead — SAR Planner",
  description: "Bayesian search & rescue decision support for incident commanders",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <SafetyFooter />
      </body>
    </html>
  );
}
