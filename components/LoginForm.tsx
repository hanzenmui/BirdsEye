"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export function LoginForm() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    if (res.ok) {
      router.push("/explore");
    } else {
      const data = await res.json();
      setError(data.error ?? "Invalid passcode");
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-card">
        <section className="login-story">
          <div className="login-logo">
            <Image src="/logo-birdseye.png" alt="" width={31} height={31} className="login-logo-icon" priority />
            <span>Birds<span className="logo-eye">eye</span></span>
          </div>
          <div className="login-story-copy">
            <span className="login-kicker">Bible people atlas</span>
            <h1>See the people behind the story.</h1>
            <p>Trace families, compare lives across centuries, and find every person inside every book.</p>
          </div>
          <div className="login-lineage" aria-hidden="true">
            {["Adam", "Abraham", "David", "Jesus"].map((name, index) => (
              <div key={name} className={index === 3 ? "final" : ""}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{name}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="login-entry">
          <span className="login-kicker">Private study library</span>
          <h2>Welcome back.</h2>
          <p className="login-subtitle">Enter your passcode to open Birdseye.</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="birdseye-passcode">Passcode</label>
              <input
                id="birdseye-passcode"
                className="form-input"
                type="password"
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                placeholder="Enter passcode"
                autoFocus
                autoComplete="current-password"
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>
            {error ? <div id="login-error" className="login-error" role="alert">{error}</div> : null}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
            >
              {loading ? "Checking…" : "Enter Birdseye"}
            </button>
          </form>
          <div className="login-footnote">Built for close reading, family lines, and biblical context.</div>
        </section>
      </div>
    </main>
  );
}
