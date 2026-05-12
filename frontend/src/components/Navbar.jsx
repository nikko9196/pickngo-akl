import '@fontsource/suez-one';
import '@fontsource/sriracha';
import { useNavigate } from "react-router-dom";

import logoPointer from "../assets/Polygon 1.svg";
import './Navbar.css';

export default function Navbar({ className = "", homePath = "/" }) {
  const navigate = useNavigate();

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
