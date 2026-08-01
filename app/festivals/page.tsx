import { redirect } from 'next/navigation'

/** /festivals se fusionó con /artists y /venues en /coleccion (pestañas). */
export default function FestivalsPage() {
  redirect('/coleccion?tab=festivales')
}
