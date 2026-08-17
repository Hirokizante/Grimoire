/**
 * Icon-pack catalog for status conditions.
 *
 * Reuses the project's existing `lucide-react` dependency as the icon pack,
 * exposing a curated, readable selection. Each entry maps a stable string key
 * (persisted in `StatusCondition.icon` when `iconType === 'pack'`) to a Lucide
 * icon component. `statusIconByName` resolves a key back to its component at
 * render time.
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

/** A single selectable icon-pack entry. */
export interface StatusIconChoice {
  /** Stable key stored in `StatusCondition.icon`. */
  key: string
  /** Human-readable label for tooltips/aria. */
  label: string
  /** The Lucide component to render. */
  Icon: LucideIcon
}

/** Curated icon pack, grouped conceptually for the picker grid. */
export const STATUS_ICON_CHOICES: StatusIconChoice[] = [
  // Damage & combat
  { key: 'swords', label: 'Swords', Icon: Swords },
  { key: 'sword', label: 'Sword', Icon: Sword },
  { key: 'target', label: 'Target', Icon: Target },
  { key: 'crosshair', label: 'Crosshair', Icon: Crosshair },
  { key: 'bomb', label: 'Bomb', Icon: Bomb },
  { key: 'flame', label: 'Flame', Icon: Flame },
  { key: 'zap', label: 'Zap', Icon: Zap },
  { key: 'skull', label: 'Skull', Icon: Skull },
  { key: 'ghost', label: 'Ghost', Icon: Ghost },
  // Elements
  { key: 'snowflake', label: 'Snowflake', Icon: Snowflake },
  { key: 'droplet', label: 'Droplet', Icon: Droplet },
  { key: 'droplets', label: 'Droplets', Icon: Droplets },
  { key: 'wind', label: 'Wind', Icon: Wind },
  { key: 'sun', label: 'Sun', Icon: Sun },
  { key: 'moon', label: 'Moon', Icon: Moon },
  { key: 'cloud', label: 'Cloud', Icon: Cloud },
  { key: 'cloud-rain', label: 'Rain', Icon: CloudRain },
  { key: 'cloud-lightning', label: 'Lightning', Icon: CloudLightning },
  { key: 'cloud-snow', label: 'Snow', Icon: CloudSnow },
  { key: 'cloud-fog', label: 'Fog', Icon: CloudFog },
  // Buffs & recovery
  { key: 'heart', label: 'Heart', Icon: Heart },
  { key: 'heart-pulse', label: 'Heart Pulse', Icon: HeartPulse },
  { key: 'activity', label: 'Activity', Icon: Activity },
  { key: 'shield-plus', label: 'Shield Plus', Icon: ShieldPlus },
  { key: 'shield-check', label: 'Shield Check', Icon: ShieldCheck },
  { key: 'sparkles', label: 'Sparkles', Icon: Sparkles },
  { key: 'star', label: 'Star', Icon: Star },
  { key: 'gem', label: 'Gem', Icon: Gem },
  { key: 'crown', label: 'Crown', Icon: Crown },
  { key: 'leaf', label: 'Leaf', Icon: Leaf },
  // Debuffs & conditions
  { key: 'shield-alert', label: 'Shield Alert', Icon: ShieldAlert },
  { key: 'shield-x', label: 'Shield Off', Icon: ShieldX },
  { key: 'shield', label: 'Shield', Icon: Shield },
  { key: 'ban', label: 'Ban', Icon: Ban },
  { key: 'circle-slash', label: 'Circle Slash', Icon: CircleSlash },
  { key: 'alert-triangle', label: 'Warning', Icon: AlertTriangle },
  { key: 'alert-circle', label: 'Alert', Icon: AlertCircle },
  { key: 'x-circle', label: 'Cancel', Icon: XCircle },
  { key: 'check-circle', label: 'Check', Icon: CheckCircle },
  { key: 'minus-circle', label: 'Minus', Icon: MinusCircle },
  { key: 'plus-circle', label: 'Plus', Icon: PlusCircle },
  { key: 'eye-off', label: 'Blind', Icon: EyeOff },
  // Utility / other
  { key: 'eye', label: 'Eye', Icon: Eye },
  { key: 'key', label: 'Key', Icon: Key },
  { key: 'lock', label: 'Lock', Icon: Lock },
  { key: 'unlock', label: 'Unlock', Icon: Unlock },
  { key: 'magnet', label: 'Magnet', Icon: Magnet },
  { key: 'anchor', label: 'Anchor', Icon: Anchor },
  { key: 'footprints', label: 'Footprints', Icon: Footprints },
  { key: 'clock', label: 'Clock', Icon: Clock },
  { key: 'timer', label: 'Timer', Icon: Timer },
  { key: 'hourglass', label: 'Hourglass', Icon: Hourglass },
  { key: 'brain', label: 'Brain', Icon: Brain },
  { key: 'bug', label: 'Bug', Icon: Bug },
  { key: 'pill', label: 'Pill', Icon: Pill },
  { key: 'syringe', label: 'Syringe', Icon: Syringe },
  { key: 'flask', label: 'Flask', Icon: FlaskConical },
  { key: 'test-tube', label: 'Test Tube', Icon: TestTube },
  { key: 'lightbulb', label: 'Lightbulb', Icon: Lightbulb },
  { key: 'feather', label: 'Feather', Icon: Feather },
  { key: 'hammer', label: 'Hammer', Icon: Hammer },
  { key: 'wrench', label: 'Wrench', Icon: Wrench },
]

/** Resolve an icon-pack key back to its Lucide component (or null). */
export function statusIconByName(key: string): LucideIcon | null {
  return STATUS_ICON_CHOICES.find((c) => c.key === key)?.Icon ?? null
}
