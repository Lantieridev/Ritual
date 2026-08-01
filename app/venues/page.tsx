import { redirect } from 'next/navigation'

/** /venues se fusionó con /artists y /festivals en /coleccion (pestañas). */
export default function VenuesPage() {
  redirect('/coleccion?tab=sedes')
}
