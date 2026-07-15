import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

export function parseGlobalsCssTokens(): Record<string, string> {
  const cssPath = path.resolve(process.cwd(), 'app/globals.css')
  const css = fs.readFileSync(cssPath, 'utf-8')

  const rootMatch = css.match(/:root\s*\{([^}]+)\}/)
  if (!rootMatch) {
    throw new Error('Could not find :root block in app/globals.css')
  }

  const rootContent = rootMatch[1]
  const tokens: Record<string, string> = {}
  const lineRegex = /--color-ritual-[\w-]+:\s*#[0-9a-fA-F]{6}/g
  const matches = rootContent.match(lineRegex)

  if (matches) {
    for (const match of matches) {
      const [key, val] = match.split(':').map((s) => s.trim())
      tokens[key] = val.toUpperCase()
    }
  }

  return tokens
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim()
  const num = parseInt(clean, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const sRGB = [r / 255, g / 255, b / 255]
  const [R, G, B] = sRGB.map((c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1))
  const l2 = relativeLuminance(hexToRgb(hex2))
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  const ratio = (lighter + 0.05) / (darker + 0.05)
  return Math.floor(ratio * 100) / 100
}

export interface ContrastPair {
  id: string
  component: string
  element: string
  textToken: string
  bgToken: string
  fontSize: string
  isBold: boolean
  isLarge: boolean
  exempt?: boolean
  exemptReason?: string
}

const TOKENS = parseGlobalsCssTokens()

export const CONTRAST_PAIRS: ContrastPair[] = [
  // --- HomeHeroStates.tsx ---
  {
    id: 'HHS-01',
    component: 'HomeHeroStates / MobileHomeHeader',
    element: 'Wordmark - "Ritu" text',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-panel',
    fontSize: '20px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHS-02',
    component: 'HomeHeroStates / MobileHomeHeader',
    element: 'Wordmark - "al" red text',
    textToken: '--color-ritual-red',
    bgToken: '--color-ritual-panel',
    fontSize: '20px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHS-03',
    component: 'HomeHeroStates / MobileHomeHeader',
    element: 'Guest header link "Entrar"',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-panel',
    fontSize: '10px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHS-04',
    component: 'HomeHeroStates / StateBadge',
    element: 'StateBadge tone="bone"',
    textToken: '--color-ritual-panel',
    bgToken: '--color-ritual-bone',
    fontSize: '9px',
    isBold: true,
    isLarge: false,
  },
  {
    id: 'HHS-05',
    component: 'HomeHeroStates / StateBadge',
    element: 'StateBadge tone="red"',
    textToken: '--color-ritual-panel',
    bgToken: '--color-ritual-red',
    fontSize: '9px',
    isBold: true,
    isLarge: false,
  },
  {
    id: 'HHS-06',
    component: 'HomeHeroStates / MorningAfterHero',
    element: 'Heading h1 "¿Cómo estuvo?"',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-panel',
    fontSize: '62px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHS-07',
    component: 'HomeHeroStates / MorningAfterHero',
    element: 'Show details text',
    textToken: '--color-ritual-gray-light-3',
    bgToken: '--color-ritual-panel',
    fontSize: '22px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHS-08',
    component: 'HomeHeroStates / MorningAfterHero',
    element: 'Body italic subtitle',
    textToken: '--color-ritual-gray-text',
    bgToken: '--color-ritual-panel',
    fontSize: '14px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'MAS-01',
    component: 'MorningAfterScore',
    element: 'Score button lit (selected)',
    textToken: '--color-ritual-panel',
    bgToken: '--color-ritual-red',
    fontSize: '19px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'MAS-02',
    component: 'MorningAfterScore',
    element: 'Score button unlit (unselected)',
    textToken: '--color-ritual-gray-muted-2',
    bgToken: '--color-ritual-surface-high',
    fontSize: '19px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'MAS-03',
    component: 'MorningAfterScore',
    element: 'Error message (role=alert)',
    textToken: '--color-ritual-red-hover',
    bgToken: '--color-ritual-panel',
    fontSize: '10px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHS-09',
    component: 'HomeHeroStates / MorningAfterHero',
    element: 'List kicker "Lo que queda de anoche"',
    textToken: '--color-ritual-gray-mid-2',
    bgToken: '--color-ritual-bg',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHS-10',
    component: 'HomeHeroStates / MorningAfterHero',
    element: 'Pending item label "Escribir la reseña"',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-bg',
    fontSize: '21px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHS-11',
    component: 'HomeHeroStates / MorningAfterHero',
    element: 'Pending item hint "Dos líneas alcanzan"',
    textToken: '--color-ritual-gray-mid-2',
    bgToken: '--color-ritual-bg',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHS-12',
    component: 'HomeHeroStates / MorningAfterHero',
    element: 'Pending item label "Cargar el gasto"',
    textToken: '--color-ritual-red',
    bgToken: '--color-ritual-bg',
    fontSize: '21px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHS-13',
    component: 'HomeHeroStates / PastOnlyHero',
    element: 'Date line text',
    textToken: '--color-ritual-red',
    bgToken: '--color-ritual-panel',
    fontSize: '19px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHS-14',
    component: 'HomeHeroStates / PastOnlyHero',
    element: 'Heading h1 artist headliner',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-panel',
    fontSize: '64px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHS-15',
    component: 'HomeHeroStates / PastOnlyHero',
    element: 'Place line text',
    textToken: '--color-ritual-gray-light-3',
    bgToken: '--color-ritual-panel',
    fontSize: '21px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHS-16',
    component: 'HomeHeroStates / PastOnlyHero',
    element: 'Body italic subtitle',
    textToken: '--color-ritual-gray-text',
    bgToken: '--color-ritual-panel',
    fontSize: '14px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHS-17',
    component: 'HomeHeroStates / PastOnlyHero',
    element: 'Button "Ver ese show"',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-panel',
    fontSize: '16px',
    isBold: true,
    isLarge: false,
  },
  {
    id: 'HHS-18',
    component: 'HomeHeroStates / PastOnlyHero',
    element: 'Button "Cargar un show" (DESKTOP_PRIMARY)',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-red',
    fontSize: '20px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHS-19',
    component: 'HomeHeroStates / UnissuedTicket',
    element: 'Unissued ticket texts ("SIN EMITIR", "Talón Nº...", "Tu primer talón")',
    textToken: '--color-ritual-mobile-ghost-label',
    bgToken: '--color-ritual-mobile-blank',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
    exempt: true,
    exemptReason: 'Element is decorative ticket template with aria-hidden="true"',
  },
  {
    id: 'HHS-20',
    component: 'HomeHeroStates / FirstTimeHero',
    element: 'Label "no hay nada que abrir todavía"',
    textToken: '--color-ritual-gray-text',
    bgToken: '--color-ritual-mobile-blank',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHS-21',
    component: 'HomeHeroStates / FirstTimeHero',
    element: 'Heading h1 "Empezá por el último que viste"',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-mobile-blank',
    fontSize: '44px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHS-22',
    component: 'HomeHeroStates / FirstTimeHero',
    element: 'Body italic subtitle',
    textToken: '--color-ritual-gray-text',
    bgToken: '--color-ritual-mobile-blank',
    fontSize: '14.5px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHS-23',
    component: 'HomeHeroStates / FirstTimeHero',
    element: 'Secondary desktop link "Cargarlo a mano"',
    textToken: '--color-ritual-gray-text',
    bgToken: '--color-ritual-mobile-blank',
    fontSize: '10px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHS-24',
    component: 'HomeHeroStates / FirstTimeHero',
    element: 'List kicker "¿A cuál de estos fuiste?"',
    textToken: '--color-ritual-gray-mid-2',
    bgToken: '--color-ritual-bg',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHS-25',
    component: 'HomeHeroStates / FirstTimeHero',
    element: 'Seed artist item text',
    textToken: '--color-ritual-gray-light-3',
    bgToken: '--color-ritual-bg',
    fontSize: '17px',
    isBold: true,
    isLarge: false,
  },
  {
    id: 'HHS-26',
    component: 'HomeHeroStates / FirstTimeHero',
    element: 'Seed note (tiered copy)',
    textToken: '--color-ritual-gray-mid',
    bgToken: '--color-ritual-bg',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHS-27',
    component: 'HomeHeroStates / FirstTimeHero',
    element: 'Seed artist subtitle 2 "Tocá uno y buscás..."',
    textToken: '--color-ritual-gray-mid',
    bgToken: '--color-ritual-bg',
    fontSize: '12.5px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHS-28',
    component: 'HomeHeroStates / FirstTimeHero',
    element: 'Promises kicker "Lo que se va a llenar acá"',
    textToken: '--color-ritual-gray-mid-2',
    bgToken: '--color-ritual-bg',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHS-29',
    component: 'HomeHeroStates / FirstTimeHero',
    element: 'Promise row number "01", "02", "03"',
    textToken: '--color-ritual-mobile-ghost',
    bgToken: '--color-ritual-bg',
    fontSize: '26px',
    isBold: true,
    isLarge: true,
    exempt: true,
    exemptReason: 'Ghost ink on purpose (not filled yet); decorative, aria-hidden="true"',
  },
  {
    id: 'HHS-30',
    component: 'HomeHeroStates / FirstTimeHero',
    element: 'Promise row label',
    textToken: '--color-ritual-gray-mid-2',
    bgToken: '--color-ritual-bg',
    fontSize: '19px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHS-31',
    component: 'HomeHeroStates / GuestHero',
    element: 'Date line text',
    textToken: '--color-ritual-red',
    bgToken: '--color-ritual-panel',
    fontSize: '19px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHS-32',
    component: 'HomeHeroStates / GuestHero',
    element: 'Heading h1 headliner',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-panel',
    fontSize: '66px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHS-33',
    component: 'HomeHeroStates / GuestHero',
    element: 'Place line text',
    textToken: '--color-ritual-gray-light-3',
    bgToken: '--color-ritual-panel',
    fontSize: '22px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHS-34',
    component: 'HomeHeroStates / GuestHero',
    element: 'Body italic subtitle',
    textToken: '--color-ritual-gray-text',
    bgToken: '--color-ritual-panel',
    fontSize: '14px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHS-35',
    component: 'HomeHeroStates / GuestHero',
    element: 'Collection card heading "Esto es tu colección vacía"',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-bg',
    fontSize: '26px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHS-36',
    component: 'HomeHeroStates / GuestHero',
    element: 'Collection card body italic',
    textToken: '--color-ritual-gray-text',
    bgToken: '--color-ritual-bg',
    fontSize: '13px',
    isBold: false,
    isLarge: false,
  },

  // --- MobileTabBar.tsx ---
  {
    id: 'MTB-01',
    component: 'MobileTabBar',
    element: 'Active tab label ("Hoy")',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-mobile-nav-bg',
    fontSize: '19px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'MTB-02',
    component: 'MobileTabBar',
    element: 'Inactive tab label ("Buscar", "Archivo", "Vos")',
    textToken: '--color-ritual-gray-text',
    bgToken: '--color-ritual-mobile-nav-bg',
    fontSize: '17px',
    isBold: true,
    isLarge: false,
  },
  {
    id: 'MTB-03',
    component: 'MobileTabBar / MobileHeroAction',
    element: 'Hero action primary button',
    textToken: '--color-ritual-panel',
    bgToken: '--color-ritual-red',
    fontSize: '22px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'MTB-04',
    component: 'MobileTabBar / MobileHeroAction',
    element: 'Hero action alt button',
    textToken: '--color-ritual-gray-text',
    bgToken: '--color-ritual-panel',
    fontSize: '10px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'MTB-05',
    component: 'MobileTabBar / BandaAction',
    element: 'BandaAction subtitle ("Tu entrada de hoy")',
    textToken: '--color-ritual-gray-mid-2',
    bgToken: '--color-ritual-mobile-banda-bg',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'MTB-06',
    component: 'MobileTabBar / BandaAction',
    element: 'BandaAction title',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-mobile-banda-bg',
    fontSize: '21px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'MTB-07',
    component: 'MobileTabBar / BandaAction',
    element: 'BandaAction action button label',
    textToken: '--color-ritual-panel',
    bgToken: '--color-ritual-red',
    fontSize: '16px',
    isBold: true,
    isLarge: false,
  },

  // --- HomeHeroStates.tsx / TonightMobileHero (#82 — hoy mobile) ---
  {
    id: 'HHT-01',
    component: 'HomeHeroStates / TonightMobileHero',
    element: 'Heading h1 headliner',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-panel',
    fontSize: '78px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHT-02',
    component: 'HomeHeroStates / TonightMeta',
    element: 'Venue line',
    textToken: '--color-ritual-gray-light-3',
    bgToken: '--color-ritual-panel',
    fontSize: '22px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHT-03',
    component: 'HomeHeroStates / TonightMeta',
    element: 'Address text',
    textToken: '--color-ritual-gray-text',
    bgToken: '--color-ritual-panel',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHT-04',
    component: 'HomeHeroStates / TonightMeta',
    element: 'Weather tag',
    textToken: '--color-ritual-red',
    bgToken: '--color-ritual-panel',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHT-05',
    component: 'HomeHeroStates / TonightMeta',
    element: 'Separator "·" (aria-hidden)',
    textToken: '--color-ritual-mobile-sep',
    bgToken: '--color-ritual-panel',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
    exempt: true,
    exemptReason: 'Decorative separator, aria-hidden="true" — not a text pair a screen reader user reads',
  },
  {
    id: 'HHT-06',
    component: 'HomeHeroStates / RecentSeenList',
    element: 'List kicker "Lo último que viste"',
    textToken: '--color-ritual-gray-mid-2',
    bgToken: '--color-ritual-bg',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHT-07',
    component: 'HomeHeroStates / RecentSeenList',
    element: 'Recent show name',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-bg',
    fontSize: '21px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'HHT-08',
    component: 'HomeHeroStates / RecentSeenList',
    element: 'Recent show meta',
    textToken: '--color-ritual-gray-mid-2',
    bgToken: '--color-ritual-bg',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'HHT-09',
    component: 'HomeHeroStates / RecentSeenList',
    element: 'Recent show score',
    textToken: '--color-ritual-red',
    bgToken: '--color-ritual-bg',
    fontSize: '19px',
    isBold: true,
    isLarge: true,
  },

  // --- SuggestionsStrip.tsx (issue #81 — home ranking strip) ---
  {
    id: 'SGS-01',
    component: 'SuggestionsStrip',
    element: 'Heading title',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-bg',
    fontSize: '28px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'SGS-02',
    component: 'SuggestionsStrip',
    element: 'Heading note',
    textToken: '--color-ritual-gray-mid-2',
    bgToken: '--color-ritual-bg',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'SGS-03',
    component: 'SuggestionsStrip',
    element: 'Link "Ver todo"',
    textToken: '--color-ritual-gray-text',
    bgToken: '--color-ritual-bg',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'SGS-04',
    component: 'SuggestionsStrip',
    element: 'Card date badge',
    textToken: '--color-ritual-panel',
    bgToken: '--color-ritual-red',
    fontSize: '17px',
    isBold: true,
    isLarge: false,
  },
  {
    id: 'SGS-05',
    component: 'SuggestionsStrip',
    element: 'Card headliner name',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-panel',
    fontSize: '25px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'SGS-06',
    component: 'SuggestionsStrip',
    element: 'Card venue name',
    textToken: '--color-ritual-gray-text',
    bgToken: '--color-ritual-panel',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'SGS-07',
    component: 'SuggestionsStrip',
    element: 'Card reason line',
    textToken: '--color-ritual-red',
    bgToken: '--color-ritual-panel',
    fontSize: '12px',
    isBold: false,
    isLarge: false,
  },

  // --- BottomSheet.tsx / BottomSheetItem.tsx ---
  {
    id: 'BSH-01',
    component: 'BottomSheet',
    element: 'Sheet title',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-mobile-nav-bg',
    fontSize: '30px',
    isBold: false,
    isLarge: true,
  },
  {
    id: 'BSH-02',
    component: 'BottomSheet',
    element: 'Sheet subtitle',
    textToken: '--color-ritual-gray-mid-2',
    bgToken: '--color-ritual-mobile-nav-bg',
    fontSize: '9px',
    isBold: false,
    isLarge: false,
  },
  {
    id: 'BSH-03',
    component: 'BottomSheetItem',
    element: 'Row label (default/bone)',
    textToken: '--color-ritual-bone',
    bgToken: '--color-ritual-mobile-nav-bg',
    fontSize: '23px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'BSH-04',
    component: 'BottomSheetItem',
    element: 'Row label (tone="acento")',
    textToken: '--color-ritual-red',
    bgToken: '--color-ritual-mobile-nav-bg',
    fontSize: '23px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'BSH-05',
    component: 'BottomSheetItem',
    element: 'Row label (tone="apagado")',
    textToken: '--color-ritual-gray-text',
    bgToken: '--color-ritual-mobile-nav-bg',
    fontSize: '23px',
    isBold: true,
    isLarge: true,
  },
  {
    id: 'BSH-06',
    component: 'BottomSheetItem',
    element: 'Row hint',
    textToken: '--color-ritual-gray-mid-2',
    bgToken: '--color-ritual-mobile-nav-bg',
    fontSize: '12px',
    isBold: false,
    isLarge: false,
  },
]

describe('Design Tokens & Color Contrast (WCAG AA)', () => {
  it('parses all required --color-ritual-* tokens from app/globals.css', () => {
    expect(Object.keys(TOKENS).length).toBeGreaterThan(0)
    expect(TOKENS['--color-ritual-bone']).toBe('#EDEBE6')
    expect(TOKENS['--color-ritual-red']).toBe('#D6202A')
    expect(TOKENS['--color-ritual-panel']).toBe('#0B0B0C')
  })

  it('declares the mobile-sep token for the Hoy hero separator (#82)', () => {
    expect(TOKENS['--color-ritual-mobile-sep']).toBe('#33333A')
  })

  it('declares the bottom sheet divider token, distinct from --color-ritual-border', () => {
    expect(TOKENS['--color-ritual-mobile-sheet-divider']).toBe('#1D1D22')
    expect(TOKENS['--color-ritual-mobile-sheet-divider']).not.toBe(TOKENS['--color-ritual-border'])
  })

  it('declares the bottom sheet veil token as an rgba() overlay', () => {
    // parseGlobalsCssTokens() only matches 6-digit hex, so the rgba() veil is
    // read straight from the raw CSS text instead of via TOKENS.
    const cssPath = path.resolve(process.cwd(), 'app/globals.css')
    const css = fs.readFileSync(cssPath, 'utf-8')
    const veilMatch = css.match(/--color-ritual-mobile-sheet-veil:\s*(rgba\([^)]+\))/)
    expect(veilMatch, 'Missing --color-ritual-mobile-sheet-veil in app/globals.css').not.toBeNull()
    expect(veilMatch![1].replace(/\s/g, '')).toBe('rgba(6,6,8,0.72)')
  })

  it('declares .ritual-sheet-up and .ritual-sheet-veil with a prefers-reduced-motion override', () => {
    const cssPath = path.resolve(process.cwd(), 'app/globals.css')
    const css = fs.readFileSync(cssPath, 'utf-8')

    expect(css).toMatch(/\.ritual-sheet-up\s*\{/)
    expect(css).toMatch(/\.ritual-sheet-veil\s*\{/)

    const reducedMotionBlocks = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{(?:[^{}]|\{[^{}]*\})*\}/g) ?? []
    const coversBoth = reducedMotionBlocks.some(
      (block) => block.includes('.ritual-sheet-up') && block.includes('.ritual-sheet-veil')
    )
    expect(coversBoth, 'Both motion classes must be disabled in the same prefers-reduced-motion block').toBe(true)
  })

  // Pares que salen tal cual del prototipo aprobado y no llegan a AA (#78). No
  // se cuentan acá: los cubre el bloque de deuda de diseño (`it.fails`) de abajo.
  const DESIGN_DEBT_PAIR_IDS = new Set([
    'HHS-05', 'MAS-02', 'HHS-09', 'HHS-11', 'HHS-24', 'HHS-26', 'HHS-27', 'HHS-28', 'MTB-05', 'MTB-07',
    'HHT-04', 'HHT-06', 'HHT-08', // #78
    'SGS-02', 'SGS-04', 'SGS-07', // #78 — home ranking strip note/badge/reason, same prototype colors
    'BSH-02', 'BSH-06', // #78 — bottom sheet subtitle/hint, same prototype colors
  ])

  it('every non-exempt text pair outside the known design debt meets WCAG AA', () => {
    const failures: Array<{ id: string; element: string; ratio: number; required: number }> = []

    for (const pair of CONTRAST_PAIRS) {
      if (pair.exempt || DESIGN_DEBT_PAIR_IDS.has(pair.id)) continue

      const textHex = TOKENS[pair.textToken]
      const bgHex = TOKENS[pair.bgToken]
      expect(textHex, `Missing text token ${pair.textToken}`).toBeDefined()
      expect(bgHex, `Missing bg token ${pair.bgToken}`).toBeDefined()

      const ratio = getContrastRatio(textHex, bgHex)
      const required = pair.isLarge ? 3.0 : 4.5

      if (ratio < required) {
        failures.push({ id: pair.id, element: pair.element, ratio: Number(ratio.toFixed(2)), required })
      }
    }

    expect(failures, JSON.stringify(failures, null, 2)).toEqual([])
  })

  it('the design-debt list only names pairs that exist and really fail AA', () => {
    for (const id of DESIGN_DEBT_PAIR_IDS) {
      const pair = CONTRAST_PAIRS.find((p) => p.id === id)
      expect(pair, `Unknown pair id ${id}`).toBeDefined()
      const ratio = getContrastRatio(TOKENS[pair!.textToken], TOKENS[pair!.bgToken])
      expect(ratio, `${id} already meets AA — move it out of the design debt`).toBeLessThan(pair!.isLarge ? 3.0 : 4.5)
    }
  })

  /*
   * Deuda de diseño conocida: estos pares salen tal cual del prototipo
   * aprobado (Ritual Mobile.dc.html) y no llegan a WCAG AA. No se cambian en
   * código sin pasar por Claude Design, así que quedan como `it.fails`: la
   * suite pasa hoy, y el día que el diseño suba estos colores cada test
   * empieza a fallar para avisar que hay que convertirlo en uno normal.
   */
  const DESIGN_DEBT: Array<{ label: string; text: string; bg: string; required: number }> = [
    { label: 'StateBadge rojo (panel sobre rojo, 9px bold)', text: '--color-ritual-panel', bg: '--color-ritual-red', required: 4.5 },
    { label: 'MorningAfterScore apagado (gray-muted-2 sobre surface-high, 19px)', text: '--color-ritual-gray-muted-2', bg: '--color-ritual-surface-high', required: 3.0 },
    { label: 'LIST_KICKER e hints (gray-mid-2 sobre bg, 9px)', text: '--color-ritual-gray-mid-2', bg: '--color-ritual-bg', required: 4.5 },
    { label: 'Notas de semillas (gray-mid sobre bg, 9–12.5px)', text: '--color-ritual-gray-mid', bg: '--color-ritual-bg', required: 4.5 },
    { label: 'Subtítulo de la banda (gray-mid-2 sobre banda-bg, 9px)', text: '--color-ritual-gray-mid-2', bg: '--color-ritual-mobile-banda-bg', required: 4.5 },
    { label: 'Acción de la banda (panel sobre rojo, 16px)', text: '--color-ritual-panel', bg: '--color-ritual-red', required: 4.5 },
    { label: 'Tag de clima de Hoy (rojo sobre panel, 9px)', text: '--color-ritual-red', bg: '--color-ritual-panel', required: 4.5 },
  ]

  for (const debt of DESIGN_DEBT) {
    it.fails(`deuda de diseño — ${debt.label} todavía no llega a AA ${debt.required}:1`, () => {
      const ratio = getContrastRatio(TOKENS[debt.text], TOKENS[debt.bg])
      expect(ratio).toBeGreaterThanOrEqual(debt.required)
    })
  }
})
