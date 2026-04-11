import '@fontsource/suez-one';
import '@fontsource/sriracha';
import './Navbar.css';

export default function Navbar() {
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
