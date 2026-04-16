import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import GoogleSignInButton from "../components/GoogleSignInButton";
import foodPatternBackground from "../assets/background - pattern - food 1.png";
import logoPointer from "../assets/Polygon 1.svg";
import { useAuth } from "../context/useAuth";
import "./AuthPage.css";

function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isGoogleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const [authMode, setAuthMode] = useState("login");
  const [formState, setFormState] = useState({
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isAuthenticated, isAuthReady, continueAsGuest, login, loginWithGoogle, register } =
    useAuth();
  const redirectTo = location.state?.redirectTo || "/";

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");
    setIsSubmitting(true);

    try {
      if (authMode === "visitor") {
        await continueAsGuest();
        setAuthMessage("Continuing as visitor.");
        navigate(redirectTo);
        return;
      }

      if (authMode === "register") {
        await register({
          email: formState.email,
          password: formState.password,
        });
        setAuthMessage("Account created and signed in.");
      } else {
        await login({
          email: formState.email,
          password: formState.password,
        });
        setAuthMessage("Signed in successfully.");
      }

      setFormState((current) => ({ ...current, password: "" }));
      navigate(redirectTo);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin(credential) {
    setAuthError("");
    setAuthMessage("");
    setIsSubmitting(true);

    try {
      await loginWithGoogle(credential);
      setAuthMessage("Signed in with Google.");
      navigate(redirectTo);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isAuthReady && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <main className="auth-page-shell">
      <section className="auth-page-frame">
        <div
          className="landing-pattern auth-page-pattern"
          aria-hidden="true"
          style={{ "--landing-background-image": `url("${foodPatternBackground}")` }}
        />

        <header className="top-banner">
          <div className="brand-lockup">
            <div className="brand-name" aria-label="PICK n GO AKL">
              <span className="brand-word brand-word-left">PICK</span>
              <span className="brand-word brand-word-connector">n</span>
              <span className="brand-word brand-word-right">GO</span>
            </div>
            <div className="brand-city">
              <span>AKL</span>
              <img src={logoPointer} alt="" aria-hidden="true" />
            </div>
          </div>
        </header>

        <section className="auth-page-layout">
          <aside className="auth-panel auth-page-panel">
            <div className="auth-copy">
              <p className="auth-kicker">Account access</p>
              <h2>
                {authMode === "register"
                  ? "Register for Have A Byte"
                  : authMode === "visitor"
                    ? "Continue as visitor"
                    : "Welcome back"}
              </h2>
              <p>
                {authMode === "register"
                  ? "Create a local account first, then connect it to rooms and later profile settings."
                  : authMode === "visitor"
                    ? "Browse the app without signing in. You can still join the homepage flow and come back to create an account later."
                    : "Sign in to continue to the app."}
              </p>
            </div>

            <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
              <button
                className={authMode === "login" ? "auth-tab active" : "auth-tab"}
                type="button"
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
              <button
                className={authMode === "register" ? "auth-tab active" : "auth-tab"}
                type="button"
                onClick={() => setAuthMode("register")}
              >
                Register
              </button>
              <button
                className={authMode === "visitor" ? "auth-tab active" : "auth-tab"}
                type="button"
                onClick={() => setAuthMode("visitor")}
              >
                Visitor
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {authMode === "visitor" ? (
                <p className="auth-visitor-copy">
                  Continue without an account. You can sign in or register later if you want to save rooms.
                </p>
              ) : (
                <>
                  <label>
                    <span>Email</span>
                    <input
                      name="email"
                      type="email"
                      value={formState.email}
                      onChange={handleFieldChange}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </label>

                  <label>
                    <span>Password</span>
                    <input
                      name="password"
                      type="password"
                      value={formState.password}
                      onChange={handleFieldChange}
                      placeholder="At least 8 characters"
                      autoComplete={
                        authMode === "register" ? "new-password" : "current-password"
                      }
                    />
                  </label>
                </>
              )}

              <button className="cta-button auth-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Working..."
                  : authMode === "register"
                    ? "Create account"
                    : authMode === "visitor"
                      ? "Continue as visitor"
                      : "Sign in"}
              </button>
            </form>

            {isGoogleConfigured && authMode === "login" ? (
              <>
                <div className="auth-divider">
                  <span>or</span>
                </div>

                <GoogleSignInButton
                  disabled={isSubmitting}
                  onCredential={handleGoogleLogin}
                  onError={setAuthError}
                />
              </>
            ) : null}

            {!isAuthReady ? <p className="auth-status">Restoring session...</p> : null}
            {authError ? <p className="auth-status error">{authError}</p> : null}
            {authMessage ? <p className="auth-status success">{authMessage}</p> : null}
          </aside>
        </section>
      </section>
    </main>
  );
}

export default AuthPage;
