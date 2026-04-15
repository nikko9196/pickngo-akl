import { useEffect, useRef } from "react";

const GOOGLE_SCRIPT_ID = "google-identity-services";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);

    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", reject, { once: true });

      if (window.google?.accounts?.id) {
        resolve();
      }

      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function GoogleSignInButton({ onCredential, onError, disabled }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || disabled) {
      return undefined;
    }

    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) {
          return;
        }

        buttonRef.current.innerHTML = "";

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: ({ credential }) => {
            if (!credential) {
              onError?.("Google sign-in did not return a credential.");
              return;
            }

            onCredential(credential);
          },
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 320,
        });
      })
      .catch(() => {
        onError?.("Failed to load Google sign-in.");
      });

    return () => {
      cancelled = true;
    };
  }, [disabled, onCredential, onError]);

  if (!GOOGLE_CLIENT_ID) {
    return null;
  }

  return <div className="google-button-shell" ref={buttonRef} />;
}

export default GoogleSignInButton;
