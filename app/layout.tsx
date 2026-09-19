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
import { Navbar, MobileTabBar, Footer, MobileActionProvider } from "@/src/core/components/layout";

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
  applicationName: "RITUAL",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "RITUAL" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { createClient } from "@/src/core/lib/supabase/server";

import { GraphQLProvider } from "@/src/graphql/provider";
import { findProfile } from "@/src/domains/auth/service";
import { OnboardingTour } from "@/src/domains/auth/components";
import { OutboxSync } from "@/src/domains/expenses/components";
import { PwaProvider } from "@/src/core/components/pwa/PwaProvider";
import { loadBandaAction } from "@/src/domains/events/show-tonight.server";

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
  //
  // La banda de "Tu entrada de hoy" (issue #82) se resuelve en paralelo con
  // el mismo user.id ya validado más arriba — loadBandaAction nunca vuelve a
  // llamar a auth.getUser() (R1-002).
  const [profile, bandaAction] = await Promise.all([
    user ? findProfile(user.id) : Promise.resolve(null),
    loadBandaAction(user?.id ?? null),
  ]);
  const showOnboarding = Boolean(user) && !profile?.onboarding_completed_at;

  return (
    <html lang="es" className="dark">
      <body className={`${fontVariables} antialiased font-sans`}>
        <PwaProvider>
          <GraphQLProvider>
            {user && <OutboxSync userId={user.id} />}
            <MobileActionProvider>
              <Navbar user={user} />
              {children}
              <Footer />
              <MobileTabBar user={user} bandaAction={bandaAction} />
              {showOnboarding && <OnboardingTour />}
            </MobileActionProvider>
          </GraphQLProvider>
        </PwaProvider>
      </body>
    </html>
  );
}
