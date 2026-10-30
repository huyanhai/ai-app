"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";

const MENUS = [
  { href: "/settings/prompts", label: "提示词配置", icon: MessageSquareText },
  { href: "/settings/models", label: "模型配置", icon: Boxes },
];

// 配置页左侧菜单
const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-white/5 px-3 py-5">
      <h1 className="px-3 text-lg font-medium">配置</h1>
      <p className="mt-1 px-3 text-xs text-white/40">管理提示词与生成模型</p>
      <nav className="mt-6 flex flex-col gap-1">
        {MENUS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                pathname.startsWith(item.href)
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
