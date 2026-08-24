import { ExternalSourceAdapter } from '../types'
import { alpogoAdapter } from './alpogo'
import { ventiAdapter } from './venti'
import { quehacemosAdapter } from './quehacemos'

export const externalAdapters: ExternalSourceAdapter[] = [
  alpogoAdapter,
  ventiAdapter,
  quehacemosAdapter,
]
