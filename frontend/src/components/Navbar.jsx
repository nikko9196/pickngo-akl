import '@fontsource/suez-one';
import '@fontsource/sriracha';
import { useNavigate } from "react-router-dom";

import logoPointer from "../assets/Polygon 1.svg";
import './Navbar.css';

export default function Navbar({ variant = "default", className = "", homePath = "/" }) {
  const navigate = useNavigate();

  if (variant === "brand") {
    const classes = ["top-banner", className].filter(Boolean).join(" ");

    return (
      <header className={classes}>
        <button
          className="brand-lockup brand-lockup-button"
          type="button"
          onClick={() => navigate(homePath)}
        >
          <div className="brand-name" aria-label="PICK n GO AKL">
            <span className="brand-word brand-word-left">PICK</span>
            <span className="brand-word brand-word-connector">n</span>
            <span className="brand-word brand-word-right">GO</span>
          </div>
          <div className="brand-city">
            <span>AKL</span>
            <img src={logoPointer} alt="" aria-hidden="true" />
          </div>
        </button>
      </header>
    );
  }

  return (
    <div className="nav">
        <div className="nav-brand">
        <a className="nav-pick-n-go">PICKnGO</a>
        <a className="nav-akl">AKL
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="white"
        >
          <polygon points="4,2 20,12 4,22" />
        </svg>
        </a>
        </div>
    </div>
  );
}
