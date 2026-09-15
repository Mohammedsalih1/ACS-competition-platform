import { NavLink } from "react-router-dom";
import acsLogo from "../../assets/acs-logo.png";
import { LayoutDashboard, FolderKanban } from "lucide-react";


function JudgeSidebar({ isOpen, onClose }) {
  const navItems = [
    {
      label: "Dashboard",
      path: "/judge/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Projects",
      path: "/judge/projects",
      icon: FolderKanban,
    },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col
          bg-acs-purple shadow-2xl
          transition-transform duration-300 ease-in-out
          lg:fixed lg:z-50 lg:w-64 lg:translate-x-0 lg:shadow-none
          ${
            isOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >
        {/* Logo Header */}
        <div className="flex h-24 shrink-0 items-center justify-between border-b border-white/10 px-6">
          <img
            src={acsLogo}
            alt="ACS National Competition"
            className="h-auto w-full max-w-[170px] object-contain"
          />

          {/* Mobile Close */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation menu"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-7">
          <p className="mb-4 px-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">
            Main Menu
          </p>

          <div className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-white text-acs-purple shadow-lg"
                      : "text-white/65 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                        isActive
                          ? "bg-acs-orange text-white"
                          : "bg-white/10 text-white/70 group-hover:bg-white/15"
                      }`}
                    >
                      <Icon size={18} strokeWidth={2} />
                    </span>

                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
          </div>
        </nav>

        {/* Competition Info */} 
        {/* <div className="shrink-0 border-t border-white/10 p-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-acs-orange text-white">
              ⚡
            </div>

            <p className="text-xs font-medium text-white/40">
              Competition
            </p>

            <p className="mt-1 text-sm font-semibold text-white">
              ACS National Competition
            </p>

            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-3/4 rounded-full bg-acs-orange" />
            </div>

            <p className="mt-2 text-[11px] text-white/40">
              Judge Panel
            </p>
          </div>
        </div> */}
      </aside>
    </>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

export default JudgeSidebar;