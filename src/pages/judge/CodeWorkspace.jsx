import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  FileCode2,
  Folder,
  FolderOpen,
  Copy,
  Check,
  ChevronsUpDown,
  ChevronsDownUp,
  FileText,
} from 'lucide-react';

function TreeNode({
  node,
  depth = 0,
  expandedFolders,
  onToggleFolder,
  onSelectFile,
  selectedPath,
}) {
  const isFolder = node.type === 'directory' || Boolean(node.children);
  const isExpanded = expandedFolders.has(node.path);

  if (isFolder) {
    return (
      <div>
        <button
          type="button"
          onClick={() => onToggleFolder(node.path)}
          className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/50 group-hover:text-white" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/50 group-hover:text-white" />
          )}
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-amber-400" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-amber-400/80" />
          )}
          <span className="truncate font-medium">{node.name}</span>
          {node.children && (
            <span className="ml-auto text-[10px] text-white/30 group-hover:text-white/50">
              {node.children.length}
            </span>
          )}
        </button>
        {isExpanded && node.children && node.children.length > 0 && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
                selectedPath={selectedPath}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = selectedPath === node.path;
  return (
    <button
      type="button"
      onClick={() => onSelectFile(node)}
      className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
        isSelected
          ? 'bg-acs-orange/20 font-semibold text-acs-orange border-l-2 border-acs-orange'
          : 'text-white/70 hover:bg-white/8 hover:text-white'
      }`}
      style={{ paddingLeft: `${22 + depth * 14}px` }}
    >
      <FileCode2
        className={`h-3.5 w-3.5 shrink-0 ${
          isSelected ? 'text-acs-orange' : 'text-sky-400'
        }`}
      />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

const collectAllFolderPaths = (nodes) => {
  const paths = [];
  const recurse = (list) => {
    if (!list) return;
    for (const item of list) {
      if (item.type === 'directory' || item.children) {
        paths.push(item.path);
        recurse(item.children);
      }
    }
  };
  recurse(nodes);
  return paths;
};

const getInitialExpanded = (nodes) => {
  const set = new Set();
  if (!nodes || nodes.length === 0) return set;

  // If single root folder (common in ZIP archives)
  if (nodes.length === 1 && (nodes[0].type === 'directory' || nodes[0].children)) {
    set.add(nodes[0].path);
    (nodes[0].children || []).forEach((c) => {
      if (c.type === 'directory' || c.children) set.add(c.path);
    });
  } else {
    // Expand direct top-level folders
    nodes.forEach((n) => {
      if (n.type === 'directory' || n.children) set.add(n.path);
    });
  }
  return set;
};

export default function CodeWorkspace() {
  const { projectId } = useParams();
  const [tree, setTree] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [content, setContent] = useState('');
  const [notice, setNotice] = useState('Select a readable source file to preview it.');
  const [fileMeta, setFileMeta] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api(`/files/${projectId}`)
      .then((data) => {
        const rootTree = data.tree || [];
        setTree(rootTree);
        setExpandedFolders(getInitialExpanded(rootTree));
      })
      .catch((err) => setNotice(err.message));
  }, [projectId]);

  const allFolderPaths = useMemo(() => collectAllFolderPaths(tree), [tree]);

  const toggleFolder = (folderPath) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedFolders(new Set(allFolderPaths));
  };

  const collapseAll = () => {
    setExpandedFolders(new Set());
  };

  const open = async (file) => {
    if (file.type !== 'file') return;
    setSelected(file);
    setLoading(true);
    setNotice('Loading…');
    try {
      const result = await api(
        `/files/${projectId}/content?path=${encodeURIComponent(file.path)}`
      );
      setContent(result.content || '');
      setNotice(result.notice || '');
      setFileMeta(result.metadata || null);
    } catch (err) {
      setContent('');
      setNotice(err.message);
      setFileMeta(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-[#120b1c] text-slate-200">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <Link
          to={`/judge/projects/${projectId}`}
          className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Project details
        </Link>
        <Link
          to={`/judge/projects/${projectId}/evaluate`}
          className="rounded-lg bg-acs-orange px-4 py-2 text-sm font-bold text-acs-purple-dark hover:bg-acs-orange-light transition-colors"
        >
          Open evaluation
        </Link>
      </header>

      <div className="grid flex-1 lg:grid-cols-[300px_1fr]">
        {/* Sidebar / Tree */}
        <aside className="flex flex-col max-h-[38vh] border-b border-white/10 bg-black/15 lg:max-h-none lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">
              Project files
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={expandAll}
                title="Expand all folders"
                className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={collapseAll}
                title="Collapse all folders"
                className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
              >
                <ChevronsDownUp className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-2">
            {tree.length === 0 ? (
              <p className="p-3 text-xs text-white/40">No files found</p>
            ) : (
              tree.map((node) => (
                <TreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  expandedFolders={expandedFolders}
                  onToggleFolder={toggleFolder}
                  onSelectFile={open}
                  selectedPath={selected?.path}
                />
              ))
            )}
          </div>
        </aside>

        {/* Code View Pane */}
        <main className="flex flex-col min-w-0 overflow-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#120b1c]/95 px-5 py-2.5 backdrop-blur">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 shrink-0 text-white/40" />
              <span className="truncate text-xs font-mono text-white/70">
                {selected?.path || 'No file selected'}
              </span>
              {fileMeta?.language && (
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/60 uppercase">
                  {fileMeta.language}
                </span>
              )}
              {fileMeta?.lineCount !== undefined && (
                <span className="text-[11px] text-white/40">
                  {fileMeta.lineCount} lines
                </span>
              )}
            </div>

            {content && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md bg-white/8 px-2.5 py-1 text-xs text-white/70 hover:bg-white/15 hover:text-white transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="p-10 text-center text-sm text-white/40">
                Loading file content…
              </div>
            ) : content ? (
              <pre className="min-w-max p-5 font-mono text-[13px] leading-6 text-slate-200">
                <code>{content}</code>
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center p-16 text-center text-sm text-white/45">
                <FileCode2 className="mb-3 h-10 w-10 text-white/20" />
                <p>{notice}</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
