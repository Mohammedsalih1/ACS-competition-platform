import { Link } from "react-router-dom";
import ProjectStatus from "./ProjectStatus";

function ProjectCard({ project }) {
  return (
    <article className="group flex h-full flex-col rounded-2xl border border-acs-border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-acs-purple/20 hover:shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-acs-purple text-sm font-bold text-white">
            {project.name.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-acs-purple">
              {project.name}
            </h3>

            <p className="mt-0.5 truncate text-xs text-acs-text-muted">
              {project.contestant.name}
            </p>
          </div>
        </div>

        <ProjectStatus status={project.status} />
      </div>

      {/* Description */}
      <p className="mt-5 line-clamp-2 text-sm leading-6 text-acs-text-muted">
        {project.description}
      </p>

      {/* Meta */}
      <div className="mt-5 space-y-2 border-t border-acs-border pt-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-acs-text-muted">
            Submitted
          </span>

          <span className="text-sm font-medium text-acs-text">
            {formatDate(project.submittedAt)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-acs-text-muted">
            Live URL
          </span>

          <a
            href={project.liveUrl}
            target="_blank"
            rel="noreferrer"
            className="max-w-[180px] truncate text-sm font-semibold text-acs-purple hover:text-acs-orange"
          >
            View Project ↗
          </a>
        </div>
      </div>

      {/* Action */}
      <div className="mt-5 pt-1">
        <Link
          to={`/judge/projects/${project.id}`}
          className="flex w-full items-center justify-center rounded-xl bg-acs-purple px-4 py-3 text-sm font-semibold text-white transition hover:bg-acs-purple-light"
        >
          View Project Details
        </Link>
      </div>
    </article>
  );
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default ProjectCard;