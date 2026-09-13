/**
 * Icon-pack catalog for status conditions.
 *
 * The bundled pack is **RPG-Awesome** (496 fantasy icons, SIL OFL 1.1 font +
 * MIT CSS — see `rpg-awesome`). `RPG_AWESOME_ICON_KEYS` (generated, see
 * `scripts/generate-rpg-awesome-icons.mjs`) lists every class name; the key is
 * stored verbatim in `StatusCondition.icon` when `iconType === 'pack'` and the
 * icon renders as `<i className={`ra ${key}`} />`.
 *
 * Records saved before the pack switch carry a **Lucide** key (the old catalog)
 * and are still resolved here by `legacyStatusIconByName`, so an existing
 * status keeps its icon instead of falling back to the placeholder glyph.
 */

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Anchor,
  Ban,
  Bomb,
  Brain,
  Bug,
  CheckCircle,
  CircleSlash,
  Clock,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Crosshair,
  Crown,
  Droplet,
  Droplets,
  Eye,
  EyeOff,
  Feather,
  Flame,
  FlaskConical,
  Footprints,
  Gem,
  Ghost,
  Hammer,
  Heart,
  HeartPulse,
  Hourglass,
  Key,
  Leaf,
  Lightbulb,
  Lock,
  Magnet,
  MinusCircle,
  Moon,
  Pill,
  PlusCircle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldPlus,
  ShieldX,
  Skull,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Sword,
  Swords,
  Syringe,
  Target,
  TestTube,
  Timer,
  Unlock,
  Wind,
  Wrench,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import { RPG_AWESOME_ICON_KEYS } from '@/constants/rpgAwesomeIcons'

export { RPG_AWESOME_ICON_KEYS }

/** The CSS class prefix every RPG-Awesome icon key carries. */
export const RPG_AWESOME_PREFIX = 'ra-'

const RPG_AWESOME_KEY_SET = new Set(RPG_AWESOME_ICON_KEYS)

/** True when `key` is one of the bundled RPG-Awesome icon keys. */
export function isRpgAwesomeIconKey(key: string): boolean {
  return RPG_AWESOME_KEY_SET.has(key)
}

/**
 * Human-readable label for an icon key ('ra-crossed-swords' → 'Crossed
 * swords'), used for tooltips, `aria-label`s and the picker's preview line.
 */
export function rpgAwesomeIconLabel(key: string): string {
  const name = key.startsWith(RPG_AWESOME_PREFIX)
    ? key.slice(RPG_AWESOME_PREFIX.length)
    : key
  const words = name.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * The icon pack that shipped before RPG-Awesome: a curated set of Lucide
 * components, kept only so already-saved statuses still render. New selections
 * never use it.
 */
const LEGACY_LUCIDE_ICONS: Record<string, LucideIcon> = {
  // Damage & combat
  swords: Swords,
  sword: Sword,
  target: Target,
  crosshair: Crosshair,
  bomb: Bomb,
  flame: Flame,
  zap: Zap,
  skull: Skull,
  ghost: Ghost,
  // Elements
  snowflake: Snowflake,
  droplet: Droplet,
  droplets: Droplets,
  wind: Wind,
  sun: Sun,
  moon: Moon,
  cloud: Cloud,
  'cloud-rain': CloudRain,
  'cloud-lightning': CloudLightning,
  'cloud-snow': CloudSnow,
  'cloud-fog': CloudFog,
  // Buffs & recovery
  heart: Heart,
  'heart-pulse': HeartPulse,
  activity: Activity,
  'shield-plus': ShieldPlus,
  'shield-check': ShieldCheck,
  sparkles: Sparkles,
  star: Star,
  gem: Gem,
  crown: Crown,
  leaf: Leaf,
  // Debuffs & conditions
  'shield-alert': ShieldAlert,
  'shield-x': ShieldX,
  shield: Shield,
  ban: Ban,
  'circle-slash': CircleSlash,
  'alert-triangle': AlertTriangle,
  'alert-circle': AlertCircle,
  'x-circle': XCircle,
  'check-circle': CheckCircle,
  'minus-circle': MinusCircle,
  'plus-circle': PlusCircle,
  'eye-off': EyeOff,
  // Utility / other
  eye: Eye,
  key: Key,
  lock: Lock,
  unlock: Unlock,
  magnet: Magnet,
  anchor: Anchor,
  footprints: Footprints,
  clock: Clock,
  timer: Timer,
  hourglass: Hourglass,
  brain: Brain,
  bug: Bug,
  pill: Pill,
  syringe: Syringe,
  flask: FlaskConical,
  'test-tube': TestTube,
  lightbulb: Lightbulb,
  feather: Feather,
  hammer: Hammer,
  wrench: Wrench,
}

/**
 * Resolve a **pre-RPG-Awesome** Lucide key back to its component (or null).
 * Only used as a rendering fallback for statuses saved with the old pack.
 */
export function legacyStatusIconByName(key: string): LucideIcon | null {
  return LEGACY_LUCIDE_ICONS[key] ?? null
}
