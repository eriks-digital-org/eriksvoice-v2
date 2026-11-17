import {
  BellRing,
  BookOpen,
  Building2,
  FlaskConical,
  Gauge,
  Home,
  ListChecks,
  Phone,
  Plug,
  Settings,
  Users,
  Workflow,
  LayoutTemplate,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** Path relative to the area root ("" is the root itself). */
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Admin: four everyday places (sidebar + phone tab bar); the rest sits under ״עוד״. */
export const adminMainNav: NavItem[] = [
  { to: "", label: "בית", icon: Home },
  { to: "/clients", label: "לקוחות", icon: Building2 },
  { to: "/calls", label: "שיחות", icon: Phone },
  { to: "/agents", label: "סוכני AI", icon: Users },
];

export const adminMoreNav: NavItem[] = [
  { to: "/automations", label: "תבניות אוטומציה", icon: LayoutTemplate },
  { to: "/usage", label: "שימוש", icon: Gauge },
  { to: "/notifications", label: "התראות", icon: BellRing },
  { to: "/health", label: "תקינות מערכת", icon: FlaskConical },
  { to: "/settings", label: "הגדרות", icon: Settings },
];

/** Client portal: four everyday places, the rest under ״עוד״. */
export const portalMainNav: NavItem[] = [
  { to: "", label: "בית", icon: Home },
  { to: "/team", label: "הצוות שלי", icon: Users },
  { to: "/calls", label: "שיחות", icon: Phone },
  { to: "/automations", label: "אוטומציות", icon: Workflow },
];

export const portalMoreNav: NavItem[] = [
  { to: "/leads", label: "רשימת חיוג", icon: ListChecks },
  { to: "/knowledge", label: "מידע על העסק", icon: BookOpen },
  { to: "/connections", label: "חיבורים", icon: Plug },
  { to: "/notifications", label: "התראות", icon: BellRing },
  { to: "/usage", label: "דקות וחשבון", icon: Gauge },
];

/** Active if exact match, or a nested path of a non-root item. */
export const isActivePath = (current: string, href: string, root: string) =>
  current === href || (href !== root && current.startsWith(`${href}/`));
