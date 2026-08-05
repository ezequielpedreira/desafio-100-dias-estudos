"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const next = theme === "light" ? "dark" : "light";
  const label = next === "dark" ? "Ativar tema escuro" : "Ativar tema claro";
  const Icon = theme === "light" ? Moon : Sun;

  return (
    <button
      type="button"
      className={compact ? "icon-button" : "btn-secondary"}
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
    >
      <Icon size={18} aria-hidden="true" />
      {!compact && <span>{theme === "light" ? "Tema escuro" : "Tema claro"}</span>}
    </button>
  );
}
