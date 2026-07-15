"use client";

// OTP-only sign-in: enter your email, get a one-time code, type it, you're in.
// One flow for new and returning users (the code creates the account when the
// email is new). No passwords anywhere. The email Supabase sends also carries
// a sign-in link — tapping it works too — but the code keeps everything on
// this device, in this modal. The project's email OTP length is 6 digits.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button, Modal, TextInput } from "@/components/ui";
import { Turnstile, captchaEnabled } from "@/components/auth/turnstile";

const RESEND_COOLDOWN_S = 30;

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  const emailValid = /\S+@\S+\.\S+/.test(email);
  const codeValid = /^\d{6}$/.test(code.trim());
  const captchaReady = !captchaEnabled || Boolean(captchaToken);

  // The modal stays mounted across open/close — start over on close (keep the
  // email; it's convenient on reopen).
  useEffect(() => {
    if (open) return;
    setStep("email");
    setCode("");
    setMsg(null);
    setCooldown(0);
  }, [open]);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    if (!supabase || busy || cooldown > 0) return;
    if (!emailValid) {
      setMsg({ tone: "error", text: "Enter a valid email first." });
      return;
    }
    if (!captchaReady) {
      setMsg({ tone: "error", text: "Complete the verification below first." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true, // new email → account created on verify
          emailRedirectTo: `${window.location.origin}/app`, // emailed link works too
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      if (error) throw error;
      setStep("code");
      setCooldown(RESEND_COOLDOWN_S);
      setMsg({ tone: "ok", text: "Code sent — check your inbox." });
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Couldn’t send the code." });
    } finally {
      // Tokens are single-use — mint a fresh challenge for any retry/resend.
      setCaptchaToken(null);
      setCaptchaReset((k) => k + 1);
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!supabase || busy || !codeValid) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
      // Record ToS/Privacy acceptance (the consent line is shown on the form).
      const uid = data?.user?.id;
      if (uid) {
        void supabase
          .from("profiles")
          .update({ accepted_terms_at: new Date().toISOString() })
          .eq("id", uid);
      }
      onClose(); // session is live; AppShell reacts via onAuthStateChange
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      setMsg({
        tone: "error",
        text: /expired|invalid/i.test(raw)
          ? "That code didn’t match or has expired — check the digits or resend."
          : raw || "Couldn’t verify the code.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Sign in" size="md">
      {step === "email" ? (
        <>
          <p className="mb-4 text-sm text-muted">
            Enter your email and we’ll send a one-time sign-in code. New here? The same code creates
            your account — no password, ever.
          </p>
          <TextInput
            type="email"
            placeholder="you@example.com"
            value={email}
            autoComplete="email"
            autoFocus
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && emailValid && sendCode()}
          />
          <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />
          {msg && (
            <p className={cn("mt-3 text-sm", msg.tone === "error" ? "text-danger" : "text-teal")}>{msg.text}</p>
          )}
          <Button className="mt-4 w-full" disabled={!emailValid || !captchaReady || busy} onClick={sendCode}>
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <Mail size={16} /> Email me a code
              </>
            )}
          </Button>
          <p className="mt-3 text-center text-[12px] text-faint">
            By continuing you agree to the{" "}
            <Link href="/terms" className="underline hover:text-fg">Terms of Service</Link> and{" "}
            <Link href="/privacy" className="underline hover:text-fg">Privacy Policy</Link>.
          </p>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            We sent a sign-in code to <span className="font-semibold text-fg">{email.trim()}</span>.
            Type it here — or tap the link in the same email.
          </p>
          <TextInput
            ref={codeRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            value={code}
            className="text-center font-mono !text-2xl tracking-[0.35em]"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && codeValid && verifyCode()}
          />
          {msg && (
            <p className={cn("mt-3 text-sm", msg.tone === "error" ? "text-danger" : "text-teal")}>{msg.text}</p>
          )}
          <Button className="mt-4 w-full" disabled={!codeValid || busy} onClick={verifyCode}>
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <KeyRound size={16} /> Verify &amp; sign in
              </>
            )}
          </Button>
          <div className="mt-3 flex items-center justify-between text-[13px] text-muted">
            <button
              className="font-medium text-accent-2 hover:underline"
              onClick={() => {
                setStep("email");
                setCode("");
                setMsg(null);
              }}
            >
              Change email
            </button>
            <button
              className={cn("font-medium", cooldown > 0 ? "text-faint" : "text-accent-2 hover:underline")}
              disabled={cooldown > 0 || busy}
              onClick={sendCode}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
