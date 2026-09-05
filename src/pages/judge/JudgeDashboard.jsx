import { Link } from "react-router-dom";
import { mockProjects } from "../../data/mockProjects";
import ProjectCard from "../../components/judge/ProjectCard";

function JudgeDashboard() {
  // Show only a small preview on the dashboard.
  const recentProjects = mockProjects.slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Header */}
      <section>
        <p className="text-sm font-medium text-acs-orange">
          Welcome back
        </p>

        <h1 className="mt-1 text-3xl font-bold tracking-tight text-acs-purple">
          Judge Dashboard
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-acs-text-muted">
          Review and manage the projects assigned to you for
          the ACS National Competition.
        </p>
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Assigned Projects"
          value={mockProjects.length}
          description="Projects assigned to you"
        />

        <StatCard
          title="Submitted"
          value={
            mockProjects.filter(
              (project) => project.status === "submitted"
            ).length
          }
          description="Ready for review"
        />

        <StatCard
          title="Under Review"
          value={
            mockProjects.filter(
              (project) => project.status === "under_review"
            ).length
          }
          description="Currently being reviewed"
        />

        <StatCard
          title="Completed"
          value={
            mockProjects.filter(
              (project) => project.status === "judged"
            ).length
          }
          description="Review completed"
        />
      </section>

      {/* Recent Projects */}
      <section>
        {/* Section Header */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-acs-orange">
              Your Projects
            </p>

            <h2 className="mt-1 text-xl font-bold text-acs-purple">
              Recent Projects
            </h2>

            <p className="mt-1 text-sm text-acs-text-muted">
              Projects recently assigned to you.
            </p>
          </div>

          <Link
            to="/judge/projects"
            className="text-sm font-semibold text-acs-purple transition hover:text-acs-orange"
          >
            View all projects →
          </Link>
        </div>

        {/* Project Cards */}
        {recentProjects.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {recentProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
              />
            ))}
          </div>
        ) : (
          <EmptyProjects />
        )}
      </section>
    </div>
  );
}

function StatCard({ title, value, description }) {
  return (
    <div className="rounded-2xl border border-acs-border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-acs-text-muted">
          {title}
        </p>

        <span className="h-2.5 w-2.5 rounded-full bg-acs-orange" />
      </div>

      <div className="mt-4">
        <span className="text-3xl font-bold text-acs-purple">
          {value}
        </span>
      </div>

      <p className="mt-2 text-xs text-acs-text-muted">
        {description}
      </p>
    </div>
  );
}

function EmptyProjects() {
  return (
    <div className="rounded-2xl border border-dashed border-acs-border bg-white p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-acs-purple/10 text-xl text-acs-purple">
        📁
      </div>

      <h3 className="mt-4 text-base font-bold text-acs-purple">
        No projects assigned
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-acs-text-muted">
        There are currently no projects assigned to you.
      </p>
    </div>
  );
}

export default JudgeDashboard;