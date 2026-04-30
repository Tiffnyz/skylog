import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar-brand">SkyLog</NavLink>
      <NavLink to="/" className={({ isActive }) => isActive ? "active" : ""} end>
        My Flights
      </NavLink>
    </nav>
  );
}
