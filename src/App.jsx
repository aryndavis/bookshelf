import * as React from "react";
import { useRoutes } from "react-router-dom";
import './App.css'
import Home from './routes/home';
import CreateBook from "./routes/createbook";
import ShelfPage from "./routes/shelfpage";
import AboutPage from "./routes/aboutpage";
import TopNav from "./Components/topNav";

function App() {


  let element = useRoutes([
    {
      path: "*",
      element: <TopNav />,
      children: [
        {
          element: <Home />,
          index:true
        },
        {
          path: "add",
          element: <CreateBook />,
        },
        { path: "shelf", element: <ShelfPage /> },
      ],
    },
    { path: "about", element: <AboutPage /> },
  ]);

  return element;
}

export default App
