"use client";

import { useEffect, useState } from "react";
import { Fingerprint, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/lib/store/authStore";
import apiClient from "@/lib/apiClient";
import { Button } from "@/components/ui/Button";

interface BiometricLoginViewProps {
  onSuccess?: () => void;
  onFallback?: () => void;
}

const MAX_RETRIES = 3;

/** Feature-detects a platform authenticator (Touch ID/Face ID/Windows Hello/etc). */
export async function isBiometricSupported(): Promise<boolean> {
  if (typeof window === "undefined" || window.PublicKeyCredential === undefined) {
    return false;
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Maps a WebAuthn failure to a user-friendly, actionable message.
 * The raw DOMException.message is intentionally never surfaced to the user.
 */
function getBiometricErrorMessage(err: unknown): { message: string; isUnsupported: boolean } {
  const name = typeof err === "object" && err !== null ? (err as { name?: string }).name : undefined;

  switch (name) {
    case "NotAllowedError":
      return { message: "Authentication was cancelled. Please try again.", isUnsupported: false };
    case "NotSupportedError":
      return {
        message: "Biometric authentication is not supported on this device or browser.",
        isUnsupported: true,
      };
    case "InvalidStateError":
      return {
        message: "No biometric credential is set up for this account. Please use your password.",
        isUnsupported: false,
      };
    case "SecurityError":
      return {
        message: "Biometric login requires a secure (HTTPS) connection.",
        isUnsupported: false,
      };
    default:
      break;
  }

  const responseMessage = (err as { response?: { data?: { message?: string } } } | undefined)?.response?.data
    ?.message;

  return {
    message: responseMessage || "Biometric authentication failed. Please try again or use password login.",
    isUnsupported: false,
  };
}

export function BiometricLoginView({ onSuccess, onFallback }: BiometricLoginViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isDisabledForSession, setIsDisabledForSession] = useState(false);
  const login = useAuthStore((s) => s.login);

  useEffect(() => {
    let isMounted = true;

    isBiometricSupported().then((supported) => {
      if (!isMounted) return;
      setIsSupported(supported);
      if (!supported) onFallback?.();
    });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBiometricLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: options } = await apiClient.post("/auth/biometric/login-options");

      // Import dynamically to avoid SSR issues
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const credential = await startAuthentication(options);

      const { data: authResult } = await apiClient.post("/auth/biometric/login-verify", {
        credential,
      });

      login({
        access_token: authResult.access_token,
        user: authResult.user,
      });

      onSuccess?.();

      if (typeof window !== "undefined") {
        window.location.href = "/dashboard";
      }
    } catch (err: unknown) {
      const { message, isUnsupported } = getBiometricErrorMessage(err);
      setError(message);

      if (isUnsupported) {
        // The platform genuinely doesn't support WebAuthn — hide entirely and let
        // the parent fall back to password login.
        setIsSupported(false);
        onFallback?.();
        return;
      }

      const nextRetryCount = retryCount + 1;
      setRetryCount(nextRetryCount);
      if (nextRetryCount >= MAX_RETRIES) {
        setIsDisabledForSession(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Still checking for platform authenticator support — render nothing to avoid a flash.
  if (isSupported === null) {
    return null;
  }

  // Not supported — hide entirely and rely on the password login fallback rendered by the parent.
  if (!isSupported) {
    return null;
  }

  const attemptsRemaining = MAX_RETRIES - retryCount;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-mint rounded-full mb-4">
          <Fingerprint className="w-8 h-8 text-text" />
        </div>
        <h3 className="text-lg font-semibold text-text mb-2">Biometric Login</h3>
        <p className="text-sm text-text-secondary mb-4">
          Use your fingerprint, face, or other biometric to sign in securely.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-700">{error}</p>
            {!isDisabledForSession && retryCount > 0 && attemptsRemaining > 0 && (
              <p className="text-xs text-red-600 mt-1">
                {attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining before biometric login is
                disabled for this session.
              </p>
            )}
            {isDisabledForSession && (
              <p className="text-xs text-red-600 mt-1">
                Biometric login has been disabled for this session. Please use your password below.
              </p>
            )}
          </div>
        </div>
      )}

      {!isDisabledForSession && (
        <Button
          type="button"
          onClick={handleBiometricLogin}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Authenticating...
            </>
          ) : (
            <>
              <Fingerprint className="w-4 h-4 mr-2" />
              Sign in with Biometrics
            </>
          )}
        </Button>
      )}

      {onFallback && (
        <Button
          type="button"
          variant="ghost"
          onClick={onFallback}
          className="w-full text-text-secondary hover:text-text"
        >
          Use password instead
        </Button>
      )}
    </div>
  );
}
