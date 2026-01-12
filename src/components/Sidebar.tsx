import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { getSetting } from "../lib/tauriApi";
import { isTauriApp } from "../lib/tauriEnv";

const icons = {
  fluxo: (
    <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.765 22.85v-1.52h10.67v-1.52H4.575v1.52h10.67v1.52H1.525V32h28.95v-9.15Zm12.19 7.62h-25.9v-6.09h25.9Zm-1.52-28.95h1.52v18.29h-1.52Zm-3.05 9.14h1.52v3.05h-1.52Zm0-4.57h1.52v1.53h-1.52Z"
      />
      <path
        fill="currentColor"
        d="M6.095 27.42h19.81v1.53H6.095Zm16.77-22.85V3.04h-1.53v1.53h-1.52v1.52h1.52v3.05h-1.52v1.52h1.52v3.05h-1.52v1.52h1.52v1.53h1.53v-1.53h1.52v-1.52h-1.52v-3.05h1.52V9.14h-1.52V6.09h1.52V4.57z"
      />
      <path
        fill="currentColor"
        d="M18.285 12.19h1.53v1.52h-1.53Zm0-6.1h1.53v3.05h-1.53Zm-3.04 9.14h1.52v1.53h-1.52Zm0-3.04h1.52v1.52h-1.52Zm-4.58 3.04h3.05v1.53h-3.05Zm0-3.04h3.05v1.52h-3.05Zm-4.57 3.04h3.05v1.53h-3.05Zm0-3.04h3.05v1.52h-3.05Zm.005-1.53h10.67V3.04H6.1Zm6.1-6.09h1.52v1.52H12.2Zm-3.05 0h1.52v1.52H9.145Zm0 3.05h4.57v1.52H9.145ZM4.575 0h22.86v1.52H4.575Zm-1.52 1.52h1.52v18.29h-1.52Z"
      />
    </svg>
  ),
  entrada: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M30.48 21.34h-1.52v1.52h1.52v1.52H32v-4.57h-1.52zm-1.52 3.04h1.52v1.53h-1.52Zm0-6.09h1.52v1.52h-1.52Zm-6.1 4.57h6.1v1.52h-6.1Zm0-6.1h6.1v1.53h-6.1Zm0 9.15h6.1v1.52h-6.1Zm-1.52-7.62h1.52v1.52h-1.52Zm-1.53 4.57h-1.52v1.52h1.52v1.53h-1.52v1.52h1.52v1.52h1.53v-7.61h-1.53zm-1.52 6.09h1.52v1.53h-1.52Zm0-9.14h1.52v1.53h-1.52Zm-7.62 10.67h7.62V32h-7.62Zm0-3.05h7.62v1.52h-7.62Zm0-3.05h7.62v1.53h-7.62Zm0-6.09h7.62v1.52h-7.62Zm0-3.05v1.52h3.05v-3.04h-1.53v1.52zm0-3.05h1.52v1.53h-1.52ZM9.15 28.95h1.52v1.53H9.15Z"
      />
      <path
        fill="currentColor"
        d="M10.67 27.43v-1.52H9.15v-1.53h1.52v-1.52H9.15v-1.52H7.62v7.61h1.53v-1.52zm-1.52-7.62h1.52v1.53H9.15Zm-6.1-3.05h7.62v1.53H3.05Zm25.91-7.62V0h-9.15v1.53h1.53v1.52h1.52v1.52h-1.52V6.1h-3.05V4.57h-1.52V3.05h-1.53V1.53h-3.05v1.52h-1.52v1.52H9.15V6.1H7.62v1.52H6.1v1.52h3.05V7.62h1.52V6.1h1.52V4.57h3.05V6.1h1.53v1.52h1.52v1.52h3.05V7.62h1.52V6.1h3.05v1.52h1.52v1.52zM3.05 10.67h7.62v1.52H3.05Zm0 16.76H6.1v1.52H3.05Zm0-4.57H6.1v1.52H3.05Zm0-3.05H6.1v1.53H3.05Zm-1.52 6.1h1.52v1.52H1.53Zm0-13.72h1.52v1.53H1.53Z"
      />
      <path
        fill="currentColor"
        d="M1.53 16.76h1.52v-1.52H1.53v-1.52H0v12.19h1.53v-3.05h1.52v-1.52H1.53v-1.53h1.52v-1.52H1.53z"
      />
    </svg>
  ),
  saida: (
    <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M30.48 21.34h-1.52v1.52h1.52v1.52H32v-4.57h-1.52zm-1.52 3.04h1.52v1.53h-1.52Zm0-6.09h1.52v1.52h-1.52Zm-6.1 4.57h6.1v1.52h-6.1Zm0-6.1h6.1v1.53h-6.1Zm0 9.15h6.1v1.52h-6.1Zm-1.52-7.62h1.52v1.52h-1.52Zm-1.53 4.57h-1.52v1.52h1.52v1.53h-1.52v1.52h1.52v1.52h1.53v-7.61h-1.53zm-1.52 6.09h1.52v1.53h-1.52Zm0-9.14h1.52v1.53h-1.52Zm-7.62 10.67h7.62V32h-7.62Zm0-3.05h7.62v1.52h-7.62Zm0-3.05h7.62v1.53h-7.62Zm0-6.09h7.62v1.52h-7.62Zm0-3.05v1.52h3.05v-3.04h-1.53v1.52zm0-3.05h1.52v1.53h-1.52ZM9.15 28.95h1.52v1.53H9.15Z"
      />
      <path
        fill="currentColor"
        d="M10.67 27.43v-1.52H9.15v-1.53h1.52v-1.52H9.15v-1.52H7.62v7.61h1.53v-1.52zm-1.52-7.62h1.52v1.53H9.15Zm-6.1-3.05h7.62v1.53H3.05Zm0 3.05h4.57v1.53H3.05Zm0-9.14h7.62v1.52H3.05Zm18.29-1.53v1.53h-1.53v1.52h9.15V3.05h-1.53v1.52h-1.52V6.1h-3.05V4.57h-1.52V3.05h-1.53V1.53h-3.04v1.52h-1.53v1.52h-1.52V6.1h-3.05V4.57H9.15V3.05H7.62V1.53H6.1V0H3.05v1.53h1.53v1.52H6.1v1.52h1.52V6.1h1.53v1.52h1.52v1.52h3.05V7.62h1.52V6.1h1.53V4.57h3.04V6.1h1.53v1.52h1.52v1.52zM3.05 25.91H6.1v1.52H3.05Zm0-3.05H6.1v1.52H3.05ZM1.53 12.19h1.52v1.53H1.53Zm0 7.62h1.52v-1.52H1.53v-1.53h1.52v-1.52H1.53v-1.52H0v12.19h3.05v-1.53H1.53v-1.52h1.52v-1.52H1.53z"
      />
    </svg>
  ),
  relatorios: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 3h18v18H3zm16 2H5v14h14zM7 12h2v5H7zm10-5h-2v10h2zm-6 3h2v2h-2zm2 4h-2v3h2z"
      />
    </svg>
  ),
  config: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21 10V9h-1V7h1V5h-1V4h-1V3h-2v1h-2V3h-1V1h-4v2H9v1H7V3H5v1H4v1H3v2h1v2H3v1H1v4h2v1h1v2H3v2h1v1h1v1h2v-1h2v1h1v2h4v-2h1v-1h2v1h2v-1h1v-1h1v-2h-1v-2h1v-1h2v-4zm0 3h-1v1h-1v1h-1v2h1v2h-2v-1h-2v1h-1v1h-1v1h-2v-1h-1v-1H9v-1H7v1H5v-2h1v-2H5v-1H4v-1H3v-2h1v-1h1V9h1V7H5V5h2v1h2V5h1V4h1V3h2v1h1v1h1v1h2V5h2v2h-1v2h1v1h1v1h1z"
      />
      <path
        fill="currentColor"
        d="M16 10V9h-1V8h-1V7h-4v1H9v1H8v1H7v4h1v1h1v1h1v1h4v-1h1v-1h1v-1h1v-4zm-1 4h-1v1h-4v-1H9v-4h1V9h4v1h1z"
      />
    </svg>
  ),
  metas: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 2h8v2H8zM6 6V4h2v2zm0 6H4V6h2zm2 2H6v-2h2zm2 0H8v4h8v-4h2v-2h2V6h-2V4h-2v2h2v6h-2v2h-2v2h-4zm2-2v2h-2v-2zm0-2h2v2h-2zm0-2v2h-2V8zm0 0V6h2v2zm4 14v-2H8v2z"
      />
    </svg>
  ),
  notificacoes: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14 4V2h-4v2H5v2h14V4zm5 12H5v-4H3v6h5v4h2v-4h4v2h-4v2h6v-4h5v-6h-2V6h-2v8h2zM5 6v8h2V6z"
      />
    </svg>
  ),
  perfil: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M15 2H9v2H7v6h2V4h6zm0 8H9v2h6zm0-6h2v6h-2zM4 16h2v-2h12v2H6v4h12v-4h2v6H4z"
      />
    </svg>
  ),
};

const navItems = [
  { label: "Fluxo", to: "/", icon: icons.fluxo },
  { label: "Entradas", to: "/entradas", icon: icons.entrada },
  { label: "Saídas", to: "/saidas", icon: icons.saida },
  { label: "Relatórios", to: "/relatorios", icon: icons.relatorios },
  { label: "Notificações", to: "/notificacoes", icon: icons.notificacoes },
  { label: "Metas", to: "/metas", icon: icons.metas },
  { label: "Editar perfil", to: "/perfil", icon: icons.perfil },
  { label: "Configurações", to: "/config", icon: icons.config },
];

type SidebarProps = {
  unreadCount?: number;
};

function Sidebar({ unreadCount = 0 }: SidebarProps) {
  const [profileName, setProfileName] = useState("Seu nome");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  const loadProfile = async () => {
    if (!isTauriApp()) {
      return;
    }
    try {
      const [nameValue, photoValue] = await Promise.all([
        getSetting("profile_name"),
        getSetting("profile_photo"),
      ]);
      setProfileName(nameValue?.trim() || "Seu nome");
      setProfilePhoto(photoValue || null);
    } catch {
      setProfileName("Seu nome");
      setProfilePhoto(null);
    }
  };

  useEffect(() => {
    loadProfile();
    const handler = () => {
      loadProfile();
    };
    window.addEventListener("profile-updated", handler);
    return () => window.removeEventListener("profile-updated", handler);
  }, []);

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white/80 px-6 py-8 backdrop-blur">
      <div className="mb-10 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-dashed border-slate-200 bg-slate-50 text-slate-400">
          {profilePhoto ? (
            <img
              src={profilePhoto}
              alt="Foto do perfil"
              className="h-full w-full object-cover"
            />
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <path
                fill="currentColor"
                d="M15 2H9v2H7v6h2V4h6zm0 8H9v2h6zm0-6h2v6h-2zM4 16h2v-2h12v2H6v4h12v-4h2v6H4z"
              />
            </svg>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">
            Olá, seja bem-vindo
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {profileName}
          </p>
        </div>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                isActive
                  ? "bg-slate-900 text-white shadow-soft"
                  : "text-slate-600 hover:bg-slate-100",
              ].join(" ")
            }
          >
            <span className="text-slate-400">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.to === "/notificacoes" && unreadCount > 0 ? (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                {unreadCount}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
