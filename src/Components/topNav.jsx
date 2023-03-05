import React from "react";
import { Link, Outlet } from "react-router-dom";
import './topNav.css'


const SideNav = () => (
    <div>
  <div className="topnav">
    <h2>Welcome to My Bookshelf 🤍</h2>
    <div className="links">
    <Link style={{ color: "black", margin: "30px" }} to={`/`}>
      Home
    </Link>
    <Link style={{ color: "black", margin: "30px" }} to={`/add`}>
      Add a Book!
    </Link>
    <Link style={{ color: "black", margin: "30px" }} to={`/shelf`}>
      Bookshelf!
    </Link>
   </div>
   
  </div>
  <div>
    <Outlet />
  </div>

  </div>
);

export default SideNav;