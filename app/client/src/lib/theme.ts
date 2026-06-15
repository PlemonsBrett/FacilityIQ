export type Theme = "dark" | "light";

const LS_KEY = "fiq_theme";

export function getTheme(): Theme {
  return (localStorage.getItem(LS_KEY) as Theme) ?? "dark";
}

export function initTheme(): void {
  document.documentElement.setAttribute("data-theme", getTheme());
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(LS_KEY, next);
  document.documentElement.setAttribute("data-theme", next);
  return next;
}
