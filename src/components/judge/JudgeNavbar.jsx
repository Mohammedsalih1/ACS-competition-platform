function JudgeNavbar({ onMenuClick }) {
  return (
    <header className="flex h-20 shrink-0 items-center justify-between border-b border-acs-border bg-white px-4 sm:px-6 lg:px-8">
      {/* Left Side */}
      <div className="flex min-w-0 items-center gap-3">
        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 cursor-pointer shrink-0 items-center justify-center rounded-xl border border-acs-border text-acs-purple transition hover:bg-acs-purple/5 lg:hidden"
          aria-label="Open navigation menu"
        >
          <MenuIcon />
        </button>

        {/* Page Info */}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-acs-text-muted">
            ACS National Competition
          </p>

          <h2 className="mt-1 truncate text-lg font-bold text-acs-purple">
            Judge Panel
          </h2>
        </div>
      </div>

      {/* Judge Info */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-acs-text">
            Judge
          </p>

          <p className="text-xs text-acs-text-muted">
            Competition Judge
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-acs-purple font-semibold text-white ring-4 ring-acs-purple/10">
          J
        </div>
      </div>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

export default JudgeNavbar;