import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import GoogleSignInButton from "../components/GoogleSignInButton";
import { useAuth } from "../context/useAuth";
import "../App.css";

function AuthPage() {
  const navigate = useNavigate();
  const isGoogleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const [authMode, setAuthMode] = useState("login");
  const [formState, setFormState] = useState({
    displayName: "",
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isAuthenticated, isAuthReady, login, loginWithGoogle, register } =
    useAuth();

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
      if (authMode === "register") {
        await register(formState);
        setAuthMessage("Account created and signed in.");
      } else {
        await login({
          email: formState.email,
          password: formState.password,
        });
        setAuthMessage("Signed in successfully.");
      }

      setFormState((current) => ({ ...current, password: "" }));
      navigate("/");
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
      navigate("/");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isAuthReady && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="auth-page-shell">
      <section className="auth-page-layout">
        <div className="auth-page-copy">
          <Link className="back-link" to="/">
            Back to home
          </Link>
          <span className="hero-tag">Account</span>
          <h1>{authMode === "register" ? "Create your account" : "Sign in"}</h1>
          <p>
            Use your email and password to access Have A Byte. If Google is
            configured for this project, you can also continue with Google.
          </p>
        </div>

        <aside className="auth-panel auth-page-panel">
          <div className="auth-copy">
            <p className="auth-kicker">Account access</p>
            <h2>
              {authMode === "register" ? "Register for Have A Byte" : "Welcome back"}
            </h2>
            <p>
              {authMode === "register"
                ? "Create a local account first, then connect it to rooms and later profile settings."
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
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {authMode === "register" ? (
              <label>
                <span>Display name</span>
                <input
                  name="displayName"
                  type="text"
                  value={formState.displayName}
                  onChange={handleFieldChange}
                  placeholder="How should we call you?"
                  autoComplete="name"
                />
              </label>
            ) : null}

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

            <button className="cta-button auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Working..."
                : authMode === "register"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          {isGoogleConfigured ? (
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
    </main>
  );
}

export default AuthPage;
