"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Subtitles, Radio, Keyboard, Settings } from "lucide-react";

const TABS = [
  { href: "/", label: "字幕", icon: Subtitles },
  { href: "/live", label: "即時轉錄", icon: Radio },
  { href: "/dictation", label: "聽寫", icon: Keyboard },
  { href: "/settings", label: "設定", icon: Settings },
] as const;

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              active
                ? "bg-purple-500/15 text-purple-300"
                : "text-white/40 hover:text-white/70 hover:bg-white/5"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
