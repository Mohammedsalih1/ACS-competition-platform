import { useEffect, useState } from "react";
import { FolderTree, Search } from "lucide-react";
import FileTreeItem from "./FileTreeItem";

function FileExplorer({
  files,
  selectedFile,
  onFileSelect,
}) {
  const [expandedFolders, setExpandedFolders] = useState(
    () => new Set()
  );

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const firstLevelFolders = files
      .filter((item) => item.type === "folder")
      .map((item) => item.path);

    setExpandedFolders(new Set(firstLevelFolders));
  }, [files]);

  const toggleFolder = (path) => {
    setExpandedFolders((current) => {
      const next = new Set(current);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  };

  const filteredFiles = searchQuery.trim()
    ? filterTree(files, searchQuery.trim().toLowerCase())
    : files;

  return (
    <section className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-2xl border border-acs-border bg-acs-surface shadow-sm lg:min-h-0">
      {/* Header */}
      <div className="shrink-0 border-b border-acs-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-acs-purple/10 text-acs-purple">
            <FolderTree size={18} />
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-acs-orange">
              Project
            </p>

            <h3 className="mt-0.5 text-sm font-bold text-acs-purple">
              File Explorer
            </h3>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-acs-text-muted"
          />

          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search files..."
            className="h-9 w-full rounded-lg border border-acs-border bg-acs-background pl-9 pr-3 text-xs text-acs-text outline-none transition placeholder:text-acs-text-muted focus:border-acs-purple/30 focus:ring-2 focus:ring-acs-purple/10"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {filteredFiles.length > 0 ? (
          <div className="space-y-0.5">
            {filteredFiles.map((item) => (
              <FileTreeItem
                key={item.path}
                item={item}
                selectedFile={selectedFile}
                onFileSelect={onFileSelect}
                expandedFolders={expandedFolders}
                onToggleFolder={toggleFolder}
              />
            ))}
          </div>
        ) : (
          <div className="px-3 py-8 text-center">
            <p className="text-xs font-medium text-acs-text">
              No files found
            </p>

            <p className="mt-1 text-[11px] text-acs-text-muted">
              Try a different search term.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function filterTree(items, query) {
  return items
    .map((item) => {
      if (item.type === "file") {
        return item.name.toLowerCase().includes(query)
          ? item
          : null;
      }

      const matchingChildren = filterTree(
        item.children || [],
        query
      );

      if (
        item.name.toLowerCase().includes(query) ||
        matchingChildren.length > 0
      ) {
        return {
          ...item,
          children: matchingChildren,
        };
      }

      return null;
    })
    .filter(Boolean);
}

export default FileExplorer;