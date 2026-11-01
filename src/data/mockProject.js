const mockProject = {
    id: "project-001",
  
    name: "project 001",
  
    description:
      "a project that has been submitted by a contest",
  
    contestant: {
      id: "contestant-001",
      name: "Mohammed Ahmed",
    },
  
    liveUrl: "https://example.com",
  
    files: [
      {
        name: "src",
        type: "folder",
        path: "src",
        children: [
          {
            name: "components",
            type: "folder",
            path: "src/components",
            children: [
              {
                name: "Header.jsx",
                type: "file",
                path: "src/components/Header.jsx",
                content: `import React from "react";
  
function Header() {
  return (
    <header>
      <h1>project</h1>
    </header>
  );
}

export default Header;
`,
              },
            ],
          },
  
          {
            name: "App.jsx",
            type: "file",
            path: "src/App.jsx",
            content: `import Header from "./components/Header";
  
function App() {
  return (
    <main>
      <Header />
      <h2>Welcome to the project</h2>
    </main>
  );
}

export default App;
`,
          },
  
          {
            name: "main.jsx",
            type: "file",
            path: "src/main.jsx",
            content: `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
            
ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
          },
        ],
      },
  
      {
        name: "public",
        type: "folder",
        path: "public",
        children: [
          {
            name: "favicon.svg",
            type: "file",
            path: "public/favicon.svg",
            content: `<svg></svg>`,
          },
        ],
      },
  
      {
        name: "package.json",
        type: "file",
        path: "package.json",
        content: `{
        "name": "sijil",
        "version": "1.0.0",
        "private": true
      }`,
      },
  
      {
        name: "README.md",
        type: "file",
        path: "README.md",
        content: `# project markdown
        details about the project and everything is here
        `,
      },
    ],
  };
  
  export default mockProject;