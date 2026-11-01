import {
    ChevronDown,
    ChevronRight,
    FileCode2,
    FileJson,
    FileText,
    Folder,
    FolderOpen,
  } from "lucide-react";
  
  function FileTreeItem({
    item,
    level = 0,
    selectedFile,
    onFileSelect,
    expandedFolders,
    onToggleFolder,
  }) {
    const isFolder = item.type === "folder";
    const isExpanded = expandedFolders.has(item.path);
    const isSelected = selectedFile === item.path;
  
    const paddingLeft = 12 + level * 16;
  
    if (isFolder) {
      return (
        <div>
          <button
            type="button"
            onClick={() => onToggleFolder(item.path)}
            className="flex cursor-pointer w-full items-center gap-1 rounded-lg py-1.5 pr-2 text-left text-sm transition hover:bg-acs-purple/5"
            style={{ paddingLeft }}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-acs-text-muted">
              {isExpanded ? (
                <ChevronDown size={15} />
              ) : (
                <ChevronRight size={15} />
              )}
            </span>
  
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-acs-orange">
              {isExpanded ? (
                <FolderOpen size={17} />
              ) : (
                <Folder size={17} />
              )}
            </span>
  
            <span className="min-w-0 truncate font-medium text-acs-text">
              {item.name}
            </span>
          </button>
  
          {isExpanded && item.children?.length > 0 && (
            <div>
              {item.children.map((child) => (
                <FileTreeItem
                  key={child.path}
                  item={child}
                  level={level + 1}
                  selectedFile={selectedFile}
                  onFileSelect={onFileSelect}
                  expandedFolders={expandedFolders}
                  onToggleFolder={onToggleFolder}
                />
              ))}
            </div>
          )}
        </div>
      );
    }
  
    return (
      <button
        type="button"
        onClick={() => onFileSelect(item)}
        className={`flex cursor-pointer w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm transition ${
          isSelected
            ? "bg-acs-purple text-white"
            : "text-acs-text hover:bg-acs-purple/5"
        }`}
        style={{ paddingLeft: paddingLeft + 20 }}
        title={item.path}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center ${
            isSelected ? "text-acs-orange-light" : "text-acs-text-muted"
          }`}
        >
          <FileIcon fileName={item.name} />
        </span>
  
        <span className="min-w-0 truncate">{item.name}</span>
      </button>
    );
  }
  
  function FileIcon({ fileName }) {
    const extension = fileName
      .split(".")
      .pop()
      ?.toLowerCase();
  
    if (extension === "json") {
      return <FileJson size={16} />;
    }
  
    if (
      [
        "js",
        "jsx",
        "ts",
        "tsx",
        "css",
        "scss",
        "html",
        "py",
        "java",
        "php",
        "go",
        "rs",
        "cpp",
        "c",
      ].includes(extension)
    ) {
      return <FileCode2 size={16} />;
    }
  
    return <FileText size={16} />;
  }
  
  export default FileTreeItem;