export function getFileLanguage(fileName) {
  if (!fileName) {
    return "plaintext";
  }

  const extension = fileName
    .split(".")
    .pop()
    ?.toLowerCase();

  const languageMap = {
    js: "javascript",
    jsx: "javascript",

    ts: "typescript",
    tsx: "typescript",

    json: "json",

    html: "html",
    htm: "html",

    css: "css",
    scss: "scss",
    sass: "scss",
    less: "less",

    md: "markdown",
    markdown: "markdown",

    xml: "xml",
    svg: "xml",

    py: "python",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",

    go: "go",
    rs: "rust",

    php: "php",

    sql: "sql",

    sh: "shell",
    bash: "shell",

    yaml: "yaml",
    yml: "yaml",

    vue: "html",
  };

  return languageMap[extension] || "plaintext";
}

export function isSupportedCodeFile(fileName) {
  if (!fileName) {
    return false;
  }

  const extension = fileName
    .split(".")
    .pop()
    ?.toLowerCase();

  const supportedExtensions = [
    "js",
    "jsx",
    "ts",
    "tsx",
    "json",
    "html",
    "htm",
    "css",
    "scss",
    "sass",
    "less",
    "md",
    "markdown",
    "xml",
    "svg",
    "py",
    "java",
    "c",
    "cpp",
    "h",
    "hpp",
    "go",
    "rs",
    "php",
    "sql",
    "sh",
    "bash",
    "yaml",
    "yml",
    "vue",
  ];

  return supportedExtensions.includes(
    extension
  );
}