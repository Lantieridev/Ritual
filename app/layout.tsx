import type { Metadata } from "next";
import {
  Anton,
  Archivo_Black,
  Archivo,
  Big_Shoulders,
  Bebas_Neue,
  Space_Mono,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import { Navbar, Footer } from "@/src/core/components/layout";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const archivoBlack = Archivo_Black({ variable: "--font-archivo-black", weight: "400", subsets: ["latin"] });
const archivo = Archivo({ variable: "--font-archivo", weight: ["700", "800", "900"], subsets: ["latin"] });
const bigShoulders = Big_Shoulders({ variable: "--font-big-shoulders", weight: ["800", "900"], subsets: ["latin"] });
const bebasNeue = Bebas_Neue({ variable: "--font-bebas-neue", weight: "400", subsets: ["latin"] });
const spaceMono = Space_Mono({ variable: "--font-space-mono", weight: ["400", "700"], subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", weight: ["400", "500", "600", "700"], subsets: ["latin"] });

const fontVariables = [
  anton.variable,
  archivoBlack.variable,
  archivo.variable,
  bigShoulders.variable,
  bebasNeue.variable,
  spaceMono.variable,
  spaceGrotesk.variable,
].join(" ");

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "RITUAL — Tu agenda de recitales",
  description: "Plataforma de gestión de recitales: itinerarios, giras y memoria en vivo.",
};

import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { createClient } from "@/src/core/lib/supabase/server";

import { GraphQLProvider } from "@/src/graphql/provider";
import { findProfile } from "@/src/domains/auth/service";
import { OnboardingTour } from "@/src/domains/auth/components";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user }, error: getUserError } = await supabase.auth.getUser();
  if (getUserError && !isAuthSessionMissingError(getUserError)) {
    console.error("supabase.auth.getUser() failed in root layout:", getUserError);
  }

  // Resuelto acá, server-side, en vez de que el tour dispare su propia query
  // al montar: evita el flash de "nada" mientras esa query resuelve, y a un
  // visitante sin sesión no le cuesta ni siquiera la consulta a profiles.
  const profile = user ? await findProfile(user.id) : null;
  const showOnboarding = Boolean(user) && !profile?.onboarding_completed_at;

  return (
    <html lang="es" className="dark">
      <body className={`${fontVariables} antialiased font-sans`}>
        <GraphQLProvider>
          <Navbar user={user} />
          {children}
          <Footer />
          {showOnboarding && <OnboardingTour />}
        </GraphQLProvider>
      </body>
    </html>
  );
}
