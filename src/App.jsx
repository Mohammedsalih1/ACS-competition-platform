import { BrowserRouter } from 'react-router-dom'
import JudgeRoutes from "./routes/JudgeRoutes";

import './App.css'

function App() {

  return (
    <>
    <BrowserRouter>
      <JudgeRoutes />
    </BrowserRouter>

    </>
  )
}

export default App
