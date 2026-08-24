import { ExternalSourceAdapter } from '../types'
import { alpogoAdapter } from './alpogo'
import { ventiAdapter } from './venti'
import { quehacemosAdapter } from './quehacemos'
import { allaccessAdapter } from './allaccess'
import { livepassAdapter } from './livepass'
import { enigmaAdapter } from './enigma'
import { entrasteAdapter } from './entraste'
import { tuentradaAdapter } from './tuentrada'
import { puntoticketAdapter } from './puntoticket'
import { konexAdapter } from './konex'
import { pulsoticketsAdapter } from './pulsotickets'
import { norteticketAdapter } from './norteticket'
import { entradawebAdapter } from './entradaweb'

export const externalAdapters: ExternalSourceAdapter[] = [
  alpogoAdapter,
  ventiAdapter,
  quehacemosAdapter,
  allaccessAdapter,
  livepassAdapter,
  enigmaAdapter,
  entrasteAdapter,
  tuentradaAdapter,
  puntoticketAdapter,
  konexAdapter,
  pulsoticketsAdapter,
  norteticketAdapter,
  entradawebAdapter,
]
