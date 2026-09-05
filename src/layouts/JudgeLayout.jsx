// import { Outlet } from "react-router-dom";
// import JudgeSidebar from "../components/judge/JudgeSidebar";
// import JudgeNavbar from "../components/judge/JudgeNavbar";

// function JudgeLayout() {
//   return (
//     <div className="min-h-screen bg-[#0F0B1A] text-white">
//       <div className="flex min-h-screen">
//         {/* Sidebar */}
//         <JudgeSidebar />

//         {/* Main Content */}
//         <div className="flex min-w-0 flex-1 flex-col">
//           <JudgeNavbar />

//           <main className="flex-1 p-4 sm:p-6 lg:p-8">
//             <Outlet />
//           </main>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default JudgeLayout;

// import { Outlet } from "react-router-dom";
// import JudgeSidebar from "../components/judge/JudgeSidebar";
// import JudgeNavbar from "../components/judge/JudgeNavbar";

// function JudgeLayout() {
//   return (
//     <div className="min-h-screen bg-acs-background text-acs-text">
//       <div className="flex min-h-screen">
//         <JudgeSidebar />

//         <div className="flex min-w-0 flex-1 flex-col">
//           <JudgeNavbar />

//           <main className="flex-1 p-4 sm:p-6 lg:p-8">
//             <Outlet />
//           </main>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default JudgeLayout;


import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import JudgeSidebar from "../components/judge/JudgeSidebar";
import JudgeNavbar from "../components/judge/JudgeNavbar";

function JudgeLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close sidebar when pressing Escape
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Prevent body scrolling while mobile sidebar is open
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isSidebarOpen]);

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-acs-background text-acs-text">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <JudgeSidebar
          isOpen={isSidebarOpen}
          onClose={closeSidebar}
        />

        {/* Main Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <JudgeNavbar
            onMenuClick={() => setIsSidebarOpen(true)}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export default JudgeLayout;