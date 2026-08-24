import { ExternalSourceAdapter } from '../types'
import { alpogoAdapter } from './alpogo'
import { ventiAdapter } from './venti'
import { quehacemosAdapter } from './quehacemos'
import { allaccessAdapter } from './allaccess'
import { livepassAdapter } from './livepass'
import { enigmaAdapter } from './enigma'
import { entrasteAdapter } from './entraste'

export const externalAdapters: ExternalSourceAdapter[] = [
  alpogoAdapter,
  ventiAdapter,
  quehacemosAdapter,
  allaccessAdapter,
  livepassAdapter,
  enigmaAdapter,
  entrasteAdapter,
]
