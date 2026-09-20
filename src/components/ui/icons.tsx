/**
 * icons.tsx — the app's style-aware icon set.
 *
 * Default renders the original **Lucide** icon (stroke-based); Terminal renders
 * its **Pixelarticons** counterpart (fill-based, pixel art). Every component
 * here keeps the Lucide name, so call sites import from this module exactly as
 * they used to import from `lucide-react` and the active UI style decides the
 * pack at render time.
 *
 * The pixel counterpart is chosen by meaning, not by name — lucide `Dices`
 * maps to pixel `Gamepad`, `Gem` to `DiamondGem`, `Footprints` (the Movement
 * stat) to `ArrowRight`, and the shield variants all collapse onto pixel
 * `Shield`. `X` is the trap: the pixel pack's own `X` is the brand logo, so
 * the close/dismiss glyph comes from pixel `Close` instead.
 * `strokeWidth` is a Lucide-only prop: the pixel pack is drawn with fills, so
 * it is ignored there. Every icon carries `data-icon-pack` so tests (and the
 * e2e style spec) can pin which pack rendered.
 *
 * Pixel components are imported per file (`pixelarticons/react/<Name>`) rather
 * than through the package barrel: the barrel re-exports ~2,000 modules, which
 * the production bundler tree-shakes but unbundled dev/test runners would
 * otherwise load in full.
 */

import type { ComponentType, SVGProps } from 'react'

import {
  Activity as LucideActivity,
  AlertCircle as LucideAlertCircle,
  AlertTriangle as LucideAlertTriangle,
  Anchor as LucideAnchor,
  ArchiveRestore as LucideArchiveRestore,
  ArrowDown as LucideArrowDown,
  ArrowDownFromLine as LucideArrowDownFromLine,
  ArrowLeft as LucideArrowLeft,
  ArrowUp as LucideArrowUp,
  ArrowUpDown as LucideArrowUpDown,
  ArrowUpFromLine as LucideArrowUpFromLine,
  Ban as LucideBan,
  BedDouble as LucideBedDouble,
  Bomb as LucideBomb,
  Brain as LucideBrain,
  Bug as LucideBug,
  Camera as LucideCamera,
  Check as LucideCheck,
  CheckCircle as LucideCheckCircle,
  ChevronDown as LucideChevronDown,
  ChevronLeft as LucideChevronLeft,
  ChevronRight as LucideChevronRight,
  CirclePlus as LucideCirclePlus,
  CircleSlash as LucideCircleSlash,
  Clock as LucideClock,
  Cloud as LucideCloud,
  CloudFog as LucideCloudFog,
  CloudLightning as LucideCloudLightning,
  CloudRain as LucideCloudRain,
  CloudSnow as LucideCloudSnow,
  Crosshair as LucideCrosshair,
  Crown as LucideCrown,
  DatabaseBackup as LucideDatabaseBackup,
  Dices as LucideDices,
  Droplet as LucideDroplet,
  Droplets as LucideDroplets,
  Eye as LucideEye,
  EyeOff as LucideEyeOff,
  Feather as LucideFeather,
  FileText as LucideFileText,
  Filter as LucideFilter,
  Flame as LucideFlame,
  FlaskConical as LucideFlaskConical,
  Footprints as LucideFootprints,
  Gem as LucideGem,
  Ghost as LucideGhost,
  GitBranch as LucideGitBranch,
  GripVertical as LucideGripVertical,
  Hammer as LucideHammer,
  Hash as LucideHash,
  Heart as LucideHeart,
  HeartPulse as LucideHeartPulse,
  Hourglass as LucideHourglass,
  Infinity as LucideInfinityIcon,
  Key as LucideKey,
  LayoutDashboard as LucideLayoutDashboard,
  LayoutGrid as LucideLayoutGrid,
  Leaf as LucideLeaf,
  Lightbulb as LucideLightbulb,
  List as LucideList,
  Loader2 as LucideLoader2,
  Lock as LucideLock,
  Magnet as LucideMagnet,
  Maximize2 as LucideMaximize2,
  Minimize2 as LucideMinimize2,
  Minus as LucideMinus,
  MinusCircle as LucideMinusCircle,
  Moon as LucideMoon,
  MoreVertical as LucideMoreVertical,
  Paintbrush as LucidePaintbrush,
  Pencil as LucidePencil,
  Pill as LucidePill,
  Plus as LucidePlus,
  PlusCircle as LucidePlusCircle,
  RefreshCw as LucideRefreshCw,
  RotateCcw as LucideRotateCcw,
  RotateCw as LucideRotateCw,
  ScrollText as LucideScrollText,
  Search as LucideSearch,
  Settings as LucideSettings,
  Shield as LucideShield,
  ShieldAlert as LucideShieldAlert,
  ShieldCheck as LucideShieldCheck,
  ShieldPlus as LucideShieldPlus,
  ShieldX as LucideShieldX,
  Skull as LucideSkull,
  Snowflake as LucideSnowflake,
  Sparkles as LucideSparkles,
  Star as LucideStar,
  Sun as LucideSun,
  Sword as LucideSword,
  Swords as LucideSwords,
  Syringe as LucideSyringe,
  Target as LucideTarget,
  TestTube as LucideTestTube,
  Timer as LucideTimer,
  Trash2 as LucideTrash2,
  TriangleAlert as LucideTriangleAlert,
  Unlock as LucideUnlock,
  Upload as LucideUpload,
  User as LucideUser,
  UserPlus as LucideUserPlus,
  Users as LucideUsers,
  Wind as LucideWind,
  Wrench as LucideWrench,
  X as LucideX,
  XCircle as LucideXCircle,
  Zap as LucideZap,
} from 'lucide-react'
import { Alien as PixelAlien } from 'pixelarticons/react/Alien'
import { Anchor as PixelAnchor } from 'pixelarticons/react/Anchor'
import { Archive as PixelArchive } from 'pixelarticons/react/Archive'
import { ArrowBarDown as PixelArrowBarDown } from 'pixelarticons/react/ArrowBarDown'
import { ArrowBarUp as PixelArrowBarUp } from 'pixelarticons/react/ArrowBarUp'
import { ArrowDown as PixelArrowDown } from 'pixelarticons/react/ArrowDown'
import { ArrowLeft as PixelArrowLeft } from 'pixelarticons/react/ArrowLeft'
import { ArrowRight as PixelArrowRight } from 'pixelarticons/react/ArrowRight'
import { ArrowUp as PixelArrowUp } from 'pixelarticons/react/ArrowUp'
import { Bomb as PixelBomb } from 'pixelarticons/react/Bomb'
import { Brush as PixelBrush } from 'pixelarticons/react/Brush'
import { Bug as PixelBug } from 'pixelarticons/react/Bug'
import { Bulletlist as PixelBulletlist } from 'pixelarticons/react/Bulletlist'
import { Camera as PixelCamera } from 'pixelarticons/react/Camera'
import { Cancel as PixelCancel } from 'pixelarticons/react/Cancel'
import { ChartLine as PixelChartLine } from 'pixelarticons/react/ChartLine'
import { Check as PixelCheck } from 'pixelarticons/react/Check'
import { CheckboxOn as PixelCheckboxOn } from 'pixelarticons/react/CheckboxOn'
import { ChevronDown as PixelChevronDown } from 'pixelarticons/react/ChevronDown'
import { ChevronLeft as PixelChevronLeft } from 'pixelarticons/react/ChevronLeft'
import { ChevronRight as PixelChevronRight } from 'pixelarticons/react/ChevronRight'
import { CircleInfo as PixelCircleInfo } from 'pixelarticons/react/CircleInfo'
import { Clock as PixelClock } from 'pixelarticons/react/Clock'
import { Close as PixelClose } from 'pixelarticons/react/Close'
import { Cloud as PixelCloud } from 'pixelarticons/react/Cloud'
import { Collapse as PixelCollapse } from 'pixelarticons/react/Collapse'
import { Cpu as PixelCpu } from 'pixelarticons/react/Cpu'
import { Crown as PixelCrown } from 'pixelarticons/react/Crown'
import { Database as PixelDatabase } from 'pixelarticons/react/Database'
import { DiamondGem as PixelDiamondGem } from 'pixelarticons/react/DiamondGem'
import { DragAndDrop as PixelDragAndDrop } from 'pixelarticons/react/DragAndDrop'
import { Expand as PixelExpand } from 'pixelarticons/react/Expand'
import { Eye as PixelEye } from 'pixelarticons/react/Eye'
import { EyeOff as PixelEyeOff } from 'pixelarticons/react/EyeOff'
import { Feather as PixelFeather } from 'pixelarticons/react/Feather'
import { FileText as PixelFileText } from 'pixelarticons/react/FileText'
import { Filter as PixelFilter } from 'pixelarticons/react/Filter'
import { Fire as PixelFire } from 'pixelarticons/react/Fire'
import { Gamepad as PixelGamepad } from 'pixelarticons/react/Gamepad'
import { Gear as PixelGear } from 'pixelarticons/react/Gear'
import { GitBranch as PixelGitBranch } from 'pixelarticons/react/GitBranch'
import { Gps as PixelGps } from 'pixelarticons/react/Gps'
import { Grid2x22 as PixelGrid2x22 } from 'pixelarticons/react/Grid2x22'
import { Hash as PixelHash } from 'pixelarticons/react/Hash'
import { Heart as PixelHeart } from 'pixelarticons/react/Heart'
import { HotelBed as PixelHotelBed } from 'pixelarticons/react/HotelBed'
import { Hourglass as PixelHourglass } from 'pixelarticons/react/Hourglass'
import { Infinity as PixelInfinity } from 'pixelarticons/react/Infinity'
import { Key as PixelKey } from 'pixelarticons/react/Key'
import { Layout as PixelLayout } from 'pixelarticons/react/Layout'
import { Leaf as PixelLeaf } from 'pixelarticons/react/Leaf'
import { Lightbulb as PixelLightbulb } from 'pixelarticons/react/Lightbulb'
import { Link as PixelLink } from 'pixelarticons/react/Link'
import { Loader as PixelLoader } from 'pixelarticons/react/Loader'
import { Lock as PixelLock } from 'pixelarticons/react/Lock'
import { Minus as PixelMinus } from 'pixelarticons/react/Minus'
import { MinusBox as PixelMinusBox } from 'pixelarticons/react/MinusBox'
import { Moon as PixelMoon } from 'pixelarticons/react/Moon'
import { MoreVertical as PixelMoreVertical } from 'pixelarticons/react/MoreVertical'
import { Pencil as PixelPencil } from 'pixelarticons/react/Pencil'
import { Plus as PixelPlus } from 'pixelarticons/react/Plus'
import { PlusBox as PixelPlusBox } from 'pixelarticons/react/PlusBox'
import { Potion as PixelPotion } from 'pixelarticons/react/Potion'
import { Redo as PixelRedo } from 'pixelarticons/react/Redo'
import { Refresh as PixelRefresh } from 'pixelarticons/react/Refresh'
import { Reload as PixelReload } from 'pixelarticons/react/Reload'
import { Script as PixelScript } from 'pixelarticons/react/Script'
import { Search as PixelSearch } from 'pixelarticons/react/Search'
import { Shield as PixelShield } from 'pixelarticons/react/Shield'
import { Skull as PixelSkull } from 'pixelarticons/react/Skull'
import { Snowflake as PixelSnowflake } from 'pixelarticons/react/Snowflake'
import { SortVertical as PixelSortVertical } from 'pixelarticons/react/SortVertical'
import { Sparkles as PixelSparkles } from 'pixelarticons/react/Sparkles'
import { Spray as PixelSpray } from 'pixelarticons/react/Spray'
import { Star as PixelStar } from 'pixelarticons/react/Star'
import { Sun as PixelSun } from 'pixelarticons/react/Sun'
import { Sword as PixelSword } from 'pixelarticons/react/Sword'
import { Target as PixelTarget } from 'pixelarticons/react/Target'
import { TestTube as PixelTestTube } from 'pixelarticons/react/TestTube'
import { Tools as PixelTools } from 'pixelarticons/react/Tools'
import { Trash as PixelTrash } from 'pixelarticons/react/Trash'
import { Unlock as PixelUnlock } from 'pixelarticons/react/Unlock'
import { Upload as PixelUpload } from 'pixelarticons/react/Upload'
import { User as PixelUser } from 'pixelarticons/react/User'
import { UserPlus as PixelUserPlus } from 'pixelarticons/react/UserPlus'
import { Users as PixelUsers } from 'pixelarticons/react/Users'
import { WarningDiamond as PixelWarningDiamond } from 'pixelarticons/react/WarningDiamond'
import { Watch as PixelWatch } from 'pixelarticons/react/Watch'
import { Waves as PixelWaves } from 'pixelarticons/react/Waves'
import { Wind as PixelWind } from 'pixelarticons/react/Wind'
import { Zap as PixelZap } from 'pixelarticons/react/Zap'

import { useUiStyleStore } from '@/store/uiStyleStore'

export interface AppIconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  /** Rendered size in pixels (both packs). */
  size?: number | string
  /** Lucide-only stroke width; ignored by the pixel pack. */
  strokeWidth?: number
  /** Which pack rendered this icon — set by the wrapper, not by call sites. */
  'data-icon-pack'?: 'lucide' | 'pixelarticons'
}

/** A component that draws one app icon in the active UI style's pack. */
export type AppIcon = ComponentType<AppIconProps>

type PixelIcon = ComponentType<SVGProps<SVGSVGElement>>

/** Pair a Lucide icon with its Pixelarticons counterpart behind one name. */
function makeAppIcon(
  name: string,
  Lucide: AppIcon,
  Pixel: PixelIcon,
): AppIcon {
  function Icon({ size = 24, strokeWidth, ...props }: AppIconProps) {
    const uiStyle = useUiStyleStore((s) => s.style)
    if (uiStyle === 'terminal') {
      return (
        <Pixel width={size} height={size} data-icon-pack="pixelarticons" {...props} />
      )
    }
    return (
      <Lucide size={size} strokeWidth={strokeWidth} data-icon-pack="lucide" {...props} />
    )
  }
  Icon.displayName = name
  return Icon
}

export const Activity = makeAppIcon('Activity', LucideActivity, PixelChartLine)
export const AlertCircle = makeAppIcon('AlertCircle', LucideAlertCircle, PixelCircleInfo)
export const AlertTriangle = makeAppIcon('AlertTriangle', LucideAlertTriangle, PixelWarningDiamond)
export const Anchor = makeAppIcon('Anchor', LucideAnchor, PixelAnchor)
export const ArchiveRestore = makeAppIcon('ArchiveRestore', LucideArchiveRestore, PixelArchive)
export const ArrowDown = makeAppIcon('ArrowDown', LucideArrowDown, PixelArrowDown)
export const ArrowDownFromLine = makeAppIcon('ArrowDownFromLine', LucideArrowDownFromLine, PixelArrowBarDown)
export const ArrowLeft = makeAppIcon('ArrowLeft', LucideArrowLeft, PixelArrowLeft)
export const ArrowUp = makeAppIcon('ArrowUp', LucideArrowUp, PixelArrowUp)
export const ArrowUpDown = makeAppIcon('ArrowUpDown', LucideArrowUpDown, PixelSortVertical)
export const ArrowUpFromLine = makeAppIcon('ArrowUpFromLine', LucideArrowUpFromLine, PixelArrowBarUp)
export const Ban = makeAppIcon('Ban', LucideBan, PixelCancel)
export const BedDouble = makeAppIcon('BedDouble', LucideBedDouble, PixelHotelBed)
export const Bomb = makeAppIcon('Bomb', LucideBomb, PixelBomb)
export const Brain = makeAppIcon('Brain', LucideBrain, PixelCpu)
export const Bug = makeAppIcon('Bug', LucideBug, PixelBug)
export const Camera = makeAppIcon('Camera', LucideCamera, PixelCamera)
export const Check = makeAppIcon('Check', LucideCheck, PixelCheck)
export const CheckCircle = makeAppIcon('CheckCircle', LucideCheckCircle, PixelCheckboxOn)
export const ChevronDown = makeAppIcon('ChevronDown', LucideChevronDown, PixelChevronDown)
export const ChevronLeft = makeAppIcon('ChevronLeft', LucideChevronLeft, PixelChevronLeft)
export const ChevronRight = makeAppIcon('ChevronRight', LucideChevronRight, PixelChevronRight)
export const CirclePlus = makeAppIcon('CirclePlus', LucideCirclePlus, PixelPlusBox)
export const CircleSlash = makeAppIcon('CircleSlash', LucideCircleSlash, PixelCancel)
export const Clock = makeAppIcon('Clock', LucideClock, PixelClock)
export const Cloud = makeAppIcon('Cloud', LucideCloud, PixelCloud)
export const CloudFog = makeAppIcon('CloudFog', LucideCloudFog, PixelCloud)
export const CloudLightning = makeAppIcon('CloudLightning', LucideCloudLightning, PixelZap)
export const CloudRain = makeAppIcon('CloudRain', LucideCloudRain, PixelCloud)
export const CloudSnow = makeAppIcon('CloudSnow', LucideCloudSnow, PixelSnowflake)
export const Crosshair = makeAppIcon('Crosshair', LucideCrosshair, PixelGps)
export const Crown = makeAppIcon('Crown', LucideCrown, PixelCrown)
export const DatabaseBackup = makeAppIcon('DatabaseBackup', LucideDatabaseBackup, PixelDatabase)
export const Dices = makeAppIcon('Dices', LucideDices, PixelGamepad)
export const Droplet = makeAppIcon('Droplet', LucideDroplet, PixelWaves)
export const Droplets = makeAppIcon('Droplets', LucideDroplets, PixelWaves)
export const Eye = makeAppIcon('Eye', LucideEye, PixelEye)
export const EyeOff = makeAppIcon('EyeOff', LucideEyeOff, PixelEyeOff)
export const Feather = makeAppIcon('Feather', LucideFeather, PixelFeather)
export const FileText = makeAppIcon('FileText', LucideFileText, PixelFileText)
export const Filter = makeAppIcon('Filter', LucideFilter, PixelFilter)
export const Flame = makeAppIcon('Flame', LucideFlame, PixelFire)
export const FlaskConical = makeAppIcon('FlaskConical', LucideFlaskConical, PixelPotion)
export const Footprints = makeAppIcon('Footprints', LucideFootprints, PixelArrowRight)
export const Gem = makeAppIcon('Gem', LucideGem, PixelDiamondGem)
export const Ghost = makeAppIcon('Ghost', LucideGhost, PixelAlien)
export const GitBranch = makeAppIcon('GitBranch', LucideGitBranch, PixelGitBranch)
export const GripVertical = makeAppIcon('GripVertical', LucideGripVertical, PixelDragAndDrop)
export const Hammer = makeAppIcon('Hammer', LucideHammer, PixelTools)
export const Hash = makeAppIcon('Hash', LucideHash, PixelHash)
export const Heart = makeAppIcon('Heart', LucideHeart, PixelHeart)
export const HeartPulse = makeAppIcon('HeartPulse', LucideHeartPulse, PixelHeart)
export const Hourglass = makeAppIcon('Hourglass', LucideHourglass, PixelHourglass)
export const InfinityIcon = makeAppIcon('InfinityIcon', LucideInfinityIcon, PixelInfinity)
export const Key = makeAppIcon('Key', LucideKey, PixelKey)
export const LayoutDashboard = makeAppIcon('LayoutDashboard', LucideLayoutDashboard, PixelLayout)
export const LayoutGrid = makeAppIcon('LayoutGrid', LucideLayoutGrid, PixelGrid2x22)
export const Leaf = makeAppIcon('Leaf', LucideLeaf, PixelLeaf)
export const Lightbulb = makeAppIcon('Lightbulb', LucideLightbulb, PixelLightbulb)
export const List = makeAppIcon('List', LucideList, PixelBulletlist)
export const Loader2 = makeAppIcon('Loader2', LucideLoader2, PixelLoader)
export const Lock = makeAppIcon('Lock', LucideLock, PixelLock)
export const Magnet = makeAppIcon('Magnet', LucideMagnet, PixelLink)
export const Maximize2 = makeAppIcon('Maximize2', LucideMaximize2, PixelExpand)
export const Minimize2 = makeAppIcon('Minimize2', LucideMinimize2, PixelCollapse)
export const Minus = makeAppIcon('Minus', LucideMinus, PixelMinus)
export const MinusCircle = makeAppIcon('MinusCircle', LucideMinusCircle, PixelMinusBox)
export const Moon = makeAppIcon('Moon', LucideMoon, PixelMoon)
export const MoreVertical = makeAppIcon('MoreVertical', LucideMoreVertical, PixelMoreVertical)
export const Paintbrush = makeAppIcon('Paintbrush', LucidePaintbrush, PixelBrush)
export const Pencil = makeAppIcon('Pencil', LucidePencil, PixelPencil)
export const Pill = makeAppIcon('Pill', LucidePill, PixelPotion)
export const Plus = makeAppIcon('Plus', LucidePlus, PixelPlus)
export const PlusCircle = makeAppIcon('PlusCircle', LucidePlusCircle, PixelPlusBox)
export const RefreshCw = makeAppIcon('RefreshCw', LucideRefreshCw, PixelRefresh)
export const RotateCcw = makeAppIcon('RotateCcw', LucideRotateCcw, PixelReload)
export const RotateCw = makeAppIcon('RotateCw', LucideRotateCw, PixelRedo)
export const ScrollText = makeAppIcon('ScrollText', LucideScrollText, PixelScript)
export const Search = makeAppIcon('Search', LucideSearch, PixelSearch)
export const Settings = makeAppIcon('Settings', LucideSettings, PixelGear)
export const Shield = makeAppIcon('Shield', LucideShield, PixelShield)
export const ShieldAlert = makeAppIcon('ShieldAlert', LucideShieldAlert, PixelShield)
export const ShieldCheck = makeAppIcon('ShieldCheck', LucideShieldCheck, PixelShield)
export const ShieldPlus = makeAppIcon('ShieldPlus', LucideShieldPlus, PixelShield)
export const ShieldX = makeAppIcon('ShieldX', LucideShieldX, PixelShield)
export const Skull = makeAppIcon('Skull', LucideSkull, PixelSkull)
export const Snowflake = makeAppIcon('Snowflake', LucideSnowflake, PixelSnowflake)
export const Sparkles = makeAppIcon('Sparkles', LucideSparkles, PixelSparkles)
export const Star = makeAppIcon('Star', LucideStar, PixelStar)
export const Sun = makeAppIcon('Sun', LucideSun, PixelSun)
export const Sword = makeAppIcon('Sword', LucideSword, PixelSword)
export const Swords = makeAppIcon('Swords', LucideSwords, PixelSword)
export const Syringe = makeAppIcon('Syringe', LucideSyringe, PixelSpray)
export const Target = makeAppIcon('Target', LucideTarget, PixelTarget)
export const TestTube = makeAppIcon('TestTube', LucideTestTube, PixelTestTube)
export const Timer = makeAppIcon('Timer', LucideTimer, PixelWatch)
export const Trash2 = makeAppIcon('Trash2', LucideTrash2, PixelTrash)
export const TriangleAlert = makeAppIcon('TriangleAlert', LucideTriangleAlert, PixelWarningDiamond)
export const Unlock = makeAppIcon('Unlock', LucideUnlock, PixelUnlock)
export const Upload = makeAppIcon('Upload', LucideUpload, PixelUpload)
export const User = makeAppIcon('User', LucideUser, PixelUser)
export const UserPlus = makeAppIcon('UserPlus', LucideUserPlus, PixelUserPlus)
export const Users = makeAppIcon('Users', LucideUsers, PixelUsers)
export const Wind = makeAppIcon('Wind', LucideWind, PixelWind)
export const Wrench = makeAppIcon('Wrench', LucideWrench, PixelTools)
export const X = makeAppIcon('X', LucideX, PixelClose)
export const XCircle = makeAppIcon('XCircle', LucideXCircle, PixelCancel)
export const Zap = makeAppIcon('Zap', LucideZap, PixelZap)
