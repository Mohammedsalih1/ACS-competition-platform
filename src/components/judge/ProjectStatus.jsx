const statusConfig = {
    submitted: {
      label: "Submitted",
      className:
        "bg-acs-orange/10 text-acs-orange border-acs-orange/20",
    },
  
    under_review: {
      label: "Under Review",
      className:
        "bg-status-info/10 text-status-info border-status-info/20",
    },
  
    judged: {
      label: "Judged",
      className:
        "bg-status-success/10 text-status-success border-status-success/20",
    },
  };
  
  function ProjectStatus({ status }) {
    const config = statusConfig[status] || {
      label: "Unknown",
      className:
        "bg-gray-100 text-gray-600 border-gray-200",
    };
  
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${config.className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
  
        {config.label}
      </span>
    );
  }
  
  export default ProjectStatus;