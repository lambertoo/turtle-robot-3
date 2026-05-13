import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNIPOD MADAGASCAR TurtleBot3 Dashboard",
  description: "Control panel for TurtleBot3 Waffle Pi — UNIPOD MADAGASCAR",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
