import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BiometricLoginView, isBiometricSupported } from "@/components/auth/BiometricLoginView";
import apiClient from "@/lib/apiClient";
import { startAuthentication } from "@simplewebauthn/browser";

jest.mock("@/lib/apiClient", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

jest.mock("@simplewebauthn/browser", () => ({
  __esModule: true,
  startAuthentication: jest.fn(),
}));

const mockLogin = jest.fn();
jest.mock("@/lib/store/authStore", () => ({
  useAuthStore: (selector: (state: { login: typeof mockLogin }) => unknown) =>
    selector({ login: mockLogin }),
}));

const mockPost = apiClient.post as jest.Mock;
const mockStartAuthentication = startAuthentication as jest.Mock;

function setPlatformAuthenticatorAvailable(resolvedValue: boolean) {
  Object.defineProperty(window, "PublicKeyCredential", {
    configurable: true,
    writable: true,
    value: {
      isUserVerifyingPlatformAuthenticatorAvailable: jest.fn().mockResolvedValue(resolvedValue),
    } as unknown as typeof window.PublicKeyCredential,
  });
}

function removePublicKeyCredentialSupport() {
  Object.defineProperty(window, "PublicKeyCredential", {
    configurable: true,
    writable: true,
    value: undefined,
  });
}

const originalError = console.error;
beforeAll(() => {
  // jsdom logs a "not implemented: navigation" error for the dashboard redirect; keep test output clean.
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPost.mockResolvedValue({ data: {} });
});

afterEach(() => {
  removePublicKeyCredentialSupport();
});

describe("isBiometricSupported", () => {
  it("returns false when PublicKeyCredential is unavailable", async () => {
    removePublicKeyCredentialSupport();
    await expect(isBiometricSupported()).resolves.toBe(false);
  });

  it("returns true when a platform authenticator is available", async () => {
    setPlatformAuthenticatorAvailable(true);
    await expect(isBiometricSupported()).resolves.toBe(true);
  });

  it("returns false when the availability check throws", async () => {
    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      writable: true,
      value: {
        isUserVerifyingPlatformAuthenticatorAvailable: jest.fn().mockRejectedValue(new Error("boom")),
      } as unknown as typeof window.PublicKeyCredential,
    });
    await expect(isBiometricSupported()).resolves.toBe(false);
  });
});

describe("BiometricLoginView", () => {
  it("renders password login directly without the biometric option on unsupported browsers", async () => {
    removePublicKeyCredentialSupport();
    const onFallback = jest.fn();
    render(<BiometricLoginView onFallback={onFallback} />);

    await waitFor(() => expect(onFallback).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: /sign in with biometrics/i })).not.toBeInTheDocument();
  });

  it("renders the biometric button when a platform authenticator is available", async () => {
    setPlatformAuthenticatorAvailable(true);
    render(<BiometricLoginView />);

    expect(await screen.findByRole("button", { name: /sign in with biometrics/i })).toBeInTheDocument();
  });

  it("shows a cancelled message and increments the retry counter on NotAllowedError", async () => {
    setPlatformAuthenticatorAvailable(true);
    mockStartAuthentication.mockRejectedValue(Object.assign(new Error("cancelled"), { name: "NotAllowedError" }));

    render(<BiometricLoginView />);
    fireEvent.click(await screen.findByRole("button", { name: /sign in with biometrics/i }));

    expect(await screen.findByText("Authentication was cancelled. Please try again.")).toBeInTheDocument();
    expect(screen.getByText(/2 attempts remaining/i)).toBeInTheDocument();
  });

  it("shows the HTTPS requirement message on SecurityError", async () => {
    setPlatformAuthenticatorAvailable(true);
    mockStartAuthentication.mockRejectedValue(Object.assign(new Error("insecure"), { name: "SecurityError" }));

    render(<BiometricLoginView />);
    fireEvent.click(await screen.findByRole("button", { name: /sign in with biometrics/i }));

    expect(await screen.findByText("Biometric login requires a secure (HTTPS) connection.")).toBeInTheDocument();
  });

  it("shows a re-enrollment message on InvalidStateError", async () => {
    setPlatformAuthenticatorAvailable(true);
    mockStartAuthentication.mockRejectedValue(Object.assign(new Error("invalid state"), { name: "InvalidStateError" }));

    render(<BiometricLoginView />);
    fireEvent.click(await screen.findByRole("button", { name: /sign in with biometrics/i }));

    expect(
      await screen.findByText("No biometric credential is set up for this account. Please use your password."),
    ).toBeInTheDocument();
  });

  it("never displays the raw DOMException message", async () => {
    setPlatformAuthenticatorAvailable(true);
    mockStartAuthentication.mockRejectedValue(
      Object.assign(new Error("raw-internal-webauthn-detail"), { name: "NotAllowedError" }),
    );

    render(<BiometricLoginView />);
    fireEvent.click(await screen.findByRole("button", { name: /sign in with biometrics/i }));

    await screen.findByText("Authentication was cancelled. Please try again.");
    expect(screen.queryByText(/raw-internal-webauthn-detail/i)).not.toBeInTheDocument();
  });

  it("hides itself and falls back to password login on NotSupportedError", async () => {
    setPlatformAuthenticatorAvailable(true);
    mockStartAuthentication.mockRejectedValue(
      Object.assign(new Error("not supported"), { name: "NotSupportedError" }),
    );
    const onFallback = jest.fn();

    render(<BiometricLoginView onFallback={onFallback} />);
    fireEvent.click(await screen.findByRole("button", { name: /sign in with biometrics/i }));

    await waitFor(() => expect(onFallback).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: /sign in with biometrics/i })).not.toBeInTheDocument();
  });

  it("disables biometric login for the session after 3 failed attempts", async () => {
    setPlatformAuthenticatorAvailable(true);
    mockStartAuthentication.mockRejectedValue(Object.assign(new Error("cancelled"), { name: "NotAllowedError" }));

    render(<BiometricLoginView />);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const button = await screen.findByRole("button", { name: /sign in with biometrics/i });
      fireEvent.click(button);
      await screen.findByText("Authentication was cancelled. Please try again.");
    }

    expect(
      await screen.findByText("Biometric login has been disabled for this session. Please use your password below."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign in with biometrics/i })).not.toBeInTheDocument();
  });

  it("logs the user in and calls onSuccess when authentication succeeds", async () => {
    setPlatformAuthenticatorAvailable(true);
    mockStartAuthentication.mockResolvedValue({ id: "cred-id" });
    mockPost.mockImplementation((url: string) => {
      if (url === "/auth/biometric/login-options") return Promise.resolve({ data: { challenge: "abc" } });
      if (url === "/auth/biometric/login-verify") {
        return Promise.resolve({ data: { access_token: "token", user: { id: "1" } } });
      }
      return Promise.resolve({ data: {} });
    });
    const onSuccess = jest.fn();

    render(<BiometricLoginView onSuccess={onSuccess} />);
    fireEvent.click(await screen.findByRole("button", { name: /sign in with biometrics/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith({ access_token: "token", user: { id: "1" } }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
