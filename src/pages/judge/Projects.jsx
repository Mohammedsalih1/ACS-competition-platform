import { useEffect, useState } from "react";
import { api } from "../../api/client";
import ProjectCard from "../../components/judge/ProjectCard";

function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/submissions")
      .then((data) => setProjects(data.submissions))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <section>
        <p className="text-sm font-medium text-acs-orange">
          Project Management
        </p>

        <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-acs-purple">
              Assigned Projects
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-acs-text-muted">
              View and manage the projects assigned to you
              for evaluation.
            </p>
          </div>

          <div className="shrink-0 rounded-xl bg-acs-purple px-4 py-2.5 text-sm font-semibold text-white">
            {projects.length} Projects
          </div>
        </div>
      </section>

      {/* Projects */}
      <section>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-acs-purple border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Projects;