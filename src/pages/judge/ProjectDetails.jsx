import { Link, useParams } from "react-router-dom";
import { mockProjects } from "../../data/mockProjects";
import ProjectStatus from "../../components/judge/ProjectStatus";

function ProjectDetails() {
  const { projectId } = useParams();

  const project = mockProjects.find(
    (item) => item.id === projectId
  );

  // Project not found
  if (!project) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-acs-purple/10 text-2xl text-acs-purple">
            ?
          </div>

          <h1 className="mt-5 text-2xl font-bold text-acs-purple">
            Project Not Found
          </h1>

          <p className="mt-2 text-sm leading-6 text-acs-text-muted">
            The project you're looking for does not exist
            or is no longer available.
          </p>

          <Link
            to="/judge/projects"
            className="mt-6 inline-flex items-center rounded-xl bg-acs-purple px-5 py-3 text-sm font-semibold text-white transition hover:bg-acs-purple-light"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link
          to="/judge/projects"
          className="text-acs-text-muted transition hover:text-acs-purple"
        >
          Projects
        </Link>

        <span className="text-acs-text-muted">/</span>

        <span className="font-medium text-acs-purple">
          {project.name}
        </span>
      </nav>

      {/* Project Header */}
      <section className="rounded-2xl border border-acs-border bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-acs-purple text-xl font-bold text-white">
              {project.name.charAt(0).toUpperCase()}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-acs-purple sm:text-3xl">
                  {project.name}
                </h1>

                <ProjectStatus status={project.status} />
              </div>

              <p className="mt-2 text-sm text-acs-text-muted">
                Submitted by{" "}
                <span className="font-semibold text-acs-text">
                  {project.contestant.name}
                </span>
              </p>
            </div>
          </div>

          {/* Live Project */}
          <a
            href={project.liveUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-acs-orange px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-acs-orange-dark"
          >
            Open Live Project ↗
          </a>
        </div>
      </section>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Description */}
        <section className="rounded-2xl border border-acs-border bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-acs-orange">
              Overview
            </p>

            <h2 className="mt-1 text-xl font-bold text-acs-purple">
              Project Description
            </h2>
          </div>

          <p className="text-sm leading-7 text-acs-text-muted">
            {project.description}
          </p>
        </section>

        {/* Submission Information */}
        <section className="rounded-2xl border border-acs-border bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-acs-orange">
              Submission
            </p>

            <h2 className="mt-1 text-xl font-bold text-acs-purple">
              Project Information
            </h2>
          </div>

          <div className="space-y-5">
            <InfoRow
              label="Contestant"
              value={project.contestant.name}
            />

            <InfoRow
              label="Status"
              value={<ProjectStatus status={project.status} />}
            />

            <InfoRow
              label="Submitted"
              value={formatDate(project.submittedAt)}
            />

            <InfoRow
              label="Project ID"
              value={project.id}
            />
          </div>
        </section>
      </div>

      {/* Review Section */}
      <section className="rounded-2xl border border-acs-purple/10 bg-acs-purple p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-acs-orange">
              Evaluation
            </p>

            <h2 className="mt-1 text-xl font-bold text-white">
              Ready to review this project?
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">
              Open the review workspace to inspect the project
              and evaluate it according to the competition
              criteria.
            </p>
          </div>

          <button
            type="button"
            className="shrink-0 rounded-xl bg-white px-6 py-3 text-sm font-bold text-acs-purple transition hover:bg-acs-orange hover:text-white"
          >
            Review Project
          </button>
        </div>
      </section>

      {/* Back */}
      <div>
        <Link
          to="/judge/projects"
          className="inline-flex items-center gap-2 text-sm font-semibold text-acs-purple transition hover:text-acs-orange"
        >
          ← Back to Projects
        </Link>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-acs-border pb-4 last:border-0 last:pb-0">
      <span className="text-xs font-medium text-acs-text-muted">
        {label}
      </span>

      <span className="max-w-[60%] text-right text-sm font-semibold text-acs-text">
        {value}
      </span>
    </div>
  );
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(date));
}

export default ProjectDetails;