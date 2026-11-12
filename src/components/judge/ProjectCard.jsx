import { Link } from 'react-router-dom';
import ProjectStatus from './ProjectStatus';

export default function ProjectCard({ project }) {
  return <article className="flex h-full flex-col rounded-2xl border border-acs-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
    <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-acs-purple text-sm font-bold text-white">{project.title.charAt(0).toUpperCase()}</div><div className="min-w-0"><h3 className="truncate text-base font-bold text-acs-purple">{project.title}</h3><p className="mt-0.5 truncate text-xs text-acs-text-muted">{project.contestant?.name}</p></div></div><ProjectStatus status={project.status} /></div>
    <p className="mt-5 line-clamp-2 text-sm leading-6 text-acs-text-muted">{project.description || 'No description provided.'}</p>
    <div className="mt-5 space-y-2 border-t border-acs-border pt-4"><Meta label="Stage" value={project.stageName || project.stageParticipation?.stage?.name || 'Not assigned'} /><Meta label="Submitted" value={formatDate(project.submittedAt)} /><Meta label="My evaluation" value={project.myEvaluationStatus?.replace('_', ' ') || 'Not started'} /><Meta label="Progress" value={`${project.completedEvaluationCount || 0} / ${project.requiredEvaluations || 3}`} /></div>
    <div className="mt-auto pt-5"><Link to={`/judge/projects/${project.id}`} className="flex w-full items-center justify-center rounded-xl bg-acs-purple px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-acs-purple-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acs-orange">Open project</Link></div>
  </article>;
}

const Meta = ({ label, value }) => <div className="flex items-center justify-between gap-4"><span className="text-sm text-acs-text-muted">{label}</span><span className="text-sm font-medium text-acs-text">{value}</span></div>;
const formatDate = (date) => date ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date)) : 'Not submitted';
