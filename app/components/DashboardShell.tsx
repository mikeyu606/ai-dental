"use client";

import { ReactNode } from "react";

type DashboardShellProps = {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  active?: "dashboard" | "verify" | "settings";
  children: ReactNode;
};

function NavIcon({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className={
        active
          ? "flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "flex h-10 w-10 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
      }
    >
      {children}
    </a>
  );
}

export function DashboardShell({
  title,
  subtitle,
  headerRight,
  active = "dashboard",
  children,
}: DashboardShellProps) {
  return (
    <div className="flex min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <aside className="hidden w-16 flex-col items-center gap-3 border-r border-zinc-200 bg-white py-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
          <span className="text-sm font-semibold">AI</span>
        </div>

        <nav className="mt-2 flex flex-1 flex-col items-center gap-2">
          <NavIcon href="/" label="Eligibility dashboard" active={active === "dashboard"}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7 20h10a2 2 0 0 0 2-2V9.5a2 2 0 0 0-.7-1.5l-4.5-4A2 2 0 0 0 12.5 3H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M9 13h6M9 17h6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </NavIcon>

          <NavIcon href="/verify" label="Insurance verification" active={active === "verify"}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M21 21l-5.2-5.2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </NavIcon>

          <NavIcon href="#" label="Settings" active={active === "settings"}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M19.4 15a7.9 7.9 0 0 0 .1-1l2-1.2-2-3.5-2.3.5a8 8 0 0 0-.8-.6l-.4-2.4h-4l-.4 2.4c-.3.2-.6.4-.8.6l-2.3-.5-2 3.5 2 1.2a7.9 7.9 0 0 0 .1 1l-2 1.2 2 3.5 2.3-.5c.3.2.5.4.8.6l.4 2.4h4l.4-2.4c.3-.2.6-.4.8-.6l2.3.5 2-3.5-2-1.2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </NavIcon>
        </nav>

        <a
          href="#"
          aria-label="Sign out"
          className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10 17l-1 3h10l-1-3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M12 3v10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M7 7a7 7 0 1 0 10 0"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </a>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              Dental AI Copilot
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                {subtitle}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {headerRight ?? (
              <>
                <a
                  href="/verify"
                  className="hidden items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:inline-flex"
                >
                  Check on-demand
                </a>
                <div className="hidden items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 sm:flex">
                  <span className="font-medium">Overjet Dental Clinic</span>
                </div>
              </>
            )}
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

