"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import { Eye, EyeOff, LogIn, UserPlus, AlertCircle, CheckCircle } from "lucide-react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import gsap from "gsap";

type Tab = "login" | "signup";

export function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [tab, setTab] = useState<Tab>("login");
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  // Animation refs
  const logoWrapRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLParagraphElement>(null);
  const tabLoginRef = useRef<HTMLButtonElement>(null);
  const tabSignupRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      const logoImg = logoWrapRef.current?.querySelector("img") ?? null;

      // Make logo wrapper visible immediately (it starts opacity:0)
      tl.set(logoWrapRef.current, { opacity: 1 });

      if (logoImg) {
        // Phase 1 — elastic spring entry: scaleY 0→1 from bottom, same as HomeHero
        tl.fromTo(
          logoImg,
          {
            scaleY: 0,
            scaleX: 0.6,
            opacity: 0,
            transformOrigin: "bottom center",
            filter: "blur(8px)",
          },
          {
            scaleY: 1,
            scaleX: 1,
            opacity: 1,
            filter: "blur(0px)",
            duration: 0.75,
            ease: "elastic.out(1, 0.55)",
          }
        );

        // Phase 2 — golden halo pulse once after landing
        tl.fromTo(
          logoImg,
          {
            filter:
              "drop-shadow(0 0 30px rgba(255,193,7,0.4)) drop-shadow(0 0 60px rgba(255,140,0,0.2))",
          },
          {
            filter:
              "drop-shadow(0 0 70px rgba(255,214,0,0.9)) drop-shadow(0 0 130px rgba(255,140,0,0.55))",
            duration: 0.25,
            ease: "power2.out",
            yoyo: true,
            repeat: 1,
          },
          "-=0.05"
        );

        // Phase 3 — breathing loop (starts after halo settles)
        tl.to(
          logoImg,
          {
            scale: 1.045,
            duration: 2.9,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          },
          "+=0.05"
        );
      }

      // Tagline fade + slide-up — overlap agressif avec le spring
      tl.fromTo(
        taglineRef.current,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
        logoImg ? "-=0.55" : 0
      );

      // Auth card fade + slide-up
      tl.fromTo(
        cardRef.current,
        { opacity: 0, y: 28, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "power3.out" },
        "-=0.25"
      );

      // Footer fade
      tl.fromTo(
        footerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3 },
        "-=0.1"
      );
    });

    return () => ctx.revert();
  }, []);

  function handleTabChange(t: Tab) {
    setTab(t);
    setError(null);
    setSuccess(null);
  }

  // Tab hover animations
  function handleTabEnter(ref: React.RefObject<HTMLButtonElement | null>, isActive: boolean) {
    if (isActive) return;
    gsap.to(ref.current, {
      backgroundColor: "rgba(255,214,0,0.06)",
      duration: 0.2,
      ease: "power2.out",
    });
  }

  function handleTabLeave(ref: React.RefObject<HTMLButtonElement | null>, isActive: boolean) {
    if (isActive) return;
    gsap.to(ref.current, {
      backgroundColor: "transparent",
      duration: 0.25,
      ease: "power3.out",
    });
  }

  function getErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      if (err.message === "ACCESS_DENIED") {
        return "User not granted to use the app. Contact an administrator to get access.";
      }
      if (err.message.includes("credentials")) {
        return "Invalid email or password.";
      }
      if (err.message.includes("already exists") || err.message.includes("Unique")) {
        return "An account with this email already exists.";
      }
      return err.message;
    }
    return "An unexpected error occurred. Please try again.";
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const result = await signIn.email({ email, password });

        if (result.error) {
          if (
            result.error.message === "ACCESS_DENIED" ||
            result.error.message?.includes("session")
          ) {
            setError(
              "User not granted to use the app. Contact an administrator to get access."
            );
          } else {
            setError(result.error.message ?? "Invalid email or password.");
          }
          return;
        }

        router.push(redirect);
        router.refresh();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  }

  function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await signUp.email({
          email,
          password,
          name: name.trim(),
        });

        if (result.error) {
          setError("User not granted to use the app.");
          return;
        }

        setSuccess("Account created! You can now sign in.");
        setEmail("");
        setPassword("");
        setName("");
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  }

  const inputBase: React.CSSProperties = {
    backgroundColor: "var(--bg-input)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: "0.75rem",
    outline: "none",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600&display=swap');

        .auth-tagline {
          font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
          font-size: clamp(0.85rem, 2vw, 1.1rem);
          font-weight: 600;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          background: linear-gradient(90deg, #FFD600 0%, #FF8C00 55%, #FFD600 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .auth-tab-active {
          background: linear-gradient(135deg, rgba(255,214,0,0.15) 0%, rgba(255,140,0,0.10) 100%);
          border-bottom: 2px solid var(--accent-primary);
          color: var(--accent-primary-light);
        }

        .auth-tab-inactive {
          border-bottom: 2px solid transparent;
        }

        .auth-input:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(255,214,0,0.12);
        }
      `}</style>

      <div
        className="flex min-h-screen items-center justify-center px-4 py-12"
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        <div className="w-full max-w-md">

          {/* Logo + branding */}
          <div
            ref={logoWrapRef}
            className="mb-8 flex flex-col items-center gap-4"
            style={{ opacity: 0 }}
          >
            <Image
              src="/images/palmera_trading.png"
              alt="Palmera Trading"
              width={280}
              height={280}
              className="object-contain"
              style={{
                height: "auto",
                filter:
                  "drop-shadow(0 0 30px rgba(255,193,7,0.4)) drop-shadow(0 0 60px rgba(255,140,0,0.2))",
                transformOrigin: "bottom center",
              }}
              priority
            />
            <h1
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "clamp(1.5rem, 4vw, 2rem)",
                fontWeight: 500,
                letterSpacing: "0.02em",
                color: "#F5C518",
                margin: 0,
              }}
            >
              Welcome to Palmera Trading
            </h1>
            <p ref={taglineRef} className="auth-tagline">
              Track your trading edge
            </p>
          </div>

          {/* Card */}
          <div
            ref={cardRef}
            className="overflow-hidden rounded-2xl"
            style={{
              opacity: 0,
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
            }}
          >
            {/* Tabs */}
            <div
              className="flex"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <button
                ref={tabLoginRef}
                type="button"
                onClick={() => handleTabChange("login")}
                onMouseEnter={() => handleTabEnter(tabLoginRef, tab === "login")}
                onMouseLeave={() => handleTabLeave(tabLoginRef, tab === "login")}
                className={[
                  "flex flex-1 items-center justify-center gap-2 px-6 py-4 text-sm font-semibold transition-colors duration-150",
                  tab === "login" ? "auth-tab-active" : "auth-tab-inactive",
                ].join(" ")}
                style={
                  tab !== "login" ? { color: "var(--text-secondary)" } : {}
                }
              >
                <LogIn size={15} />
                Sign In
              </button>
              <button
                ref={tabSignupRef}
                type="button"
                onClick={() => handleTabChange("signup")}
                onMouseEnter={() => handleTabEnter(tabSignupRef, tab === "signup")}
                onMouseLeave={() => handleTabLeave(tabSignupRef, tab === "signup")}
                className={[
                  "flex flex-1 items-center justify-center gap-2 px-6 py-4 text-sm font-semibold transition-colors duration-150",
                  tab === "signup" ? "auth-tab-active" : "auth-tab-inactive",
                ].join(" ")}
                style={
                  tab !== "signup" ? { color: "var(--text-secondary)" } : {}
                }
              >
                <UserPlus size={15} />
                Create Account
              </button>
            </div>

            {/* Form content */}
            <div className="p-8">
              {/* Error alert */}
              {error && (
                <div
                  className="mb-6 flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
                  style={{
                    backgroundColor: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    color: "#f87171",
                  }}
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Success alert */}
              {success && (
                <div
                  className="mb-6 flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
                  style={{
                    backgroundColor: "rgba(0,200,150,0.1)",
                    border: "1px solid rgba(0,200,150,0.3)",
                    color: "var(--accent-tertiary-light)",
                  }}
                >
                  <CheckCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              {/* LOGIN FORM */}
              {tab === "login" && (
                <form onSubmit={handleLogin} className="space-y-5" noValidate>
                  <div>
                    <label
                      htmlFor="login-email"
                      className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Email
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="trader@example.com"
                      className="auth-input block w-full px-3.5 py-2.5 text-sm transition-all placeholder:opacity-40"
                      style={inputBase}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="auth-input block w-full px-3.5 py-2.5 pr-11 text-sm transition-all placeholder:opacity-40"
                        style={inputBase}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <PrimaryButton
                    type="submit"
                    disabled={isPending}
                    fullWidth
                    size="md"
                  >
                    <LogIn size={15} />
                    {isPending ? "Signing in…" : "Sign In"}
                  </PrimaryButton>
                </form>
              )}

              {/* SIGNUP FORM */}
              {tab === "signup" && (
                <form onSubmit={handleSignup} className="space-y-5" noValidate>
                  <div>
                    <label
                      htmlFor="signup-name"
                      className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Full Name
                    </label>
                    <input
                      id="signup-name"
                      type="text"
                      autoComplete="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      className="auth-input block w-full px-3.5 py-2.5 text-sm transition-all placeholder:opacity-40"
                      style={inputBase}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="signup-email"
                      className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Email
                    </label>
                    <input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="trader@example.com"
                      className="auth-input block w-full px-3.5 py-2.5 text-sm transition-all placeholder:opacity-40"
                      style={inputBase}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="signup-password"
                      className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Password
                      <span
                        className="ml-2 normal-case font-normal tracking-normal"
                        style={{ color: "var(--text-muted)", fontSize: "10px" }}
                      >
                        (min. 8 characters)
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="auth-input block w-full px-3.5 py-2.5 pr-11 text-sm transition-all placeholder:opacity-40"
                        style={inputBase}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <PrimaryButton
                    type="submit"
                    disabled={isPending}
                    fullWidth
                    size="md"
                  >
                    <UserPlus size={15} />
                    {isPending ? "Creating account…" : "Create Account"}
                  </PrimaryButton>

                  <p className="text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Access is restricted. Your email must be authorized before you can register.
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* Footer */}
          <p
            ref={footerRef}
            className="mt-6 text-center text-[11px]"
            style={{ opacity: 0, color: "var(--text-muted)" }}
          >
            MyJournal — Palmera Trading
          </p>
        </div>
      </div>
    </>
  );
}
