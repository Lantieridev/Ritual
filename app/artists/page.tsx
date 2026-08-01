import { redirect } from 'next/navigation'

/** /artists se fusionó con /venues y /festivals en /coleccion (pestañas). */
export default function ArtistsPage() {
  redirect('/coleccion?tab=artistas')
}
