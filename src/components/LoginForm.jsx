import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RobotScene } from "./RobotScene";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function LoginForm() {
    const optimusRef = useRef(null);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [eyesCovered, setEyesCovered] = useState(false);
    const [focusedField, setFocusedField] = useState("none");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [submitted, setSubmitted] = useState(false);
    const [triggerClip, setTriggerClip] = useState(null);


    const handleReady = useCallback((handle) => {
        optimusRef.current = handle;
    }, []);

    const fireClip = useCallback((clip) => {
        if (optimusRef.current) {
            optimusRef.current.playClip(clip);
        } else {
            setTriggerClip(null);
            requestAnimationFrame(() => setTriggerClip(clip));
        }
    }, []);

    const handleFieldFocus = useCallback((field) => {
        setFocusedField(field);
    }, []);

    const handleFieldBlur = useCallback(() => {
        setFocusedField("none");
    }, []);

    /*
     * Clicking the password eye button toggles Optimus:
     * - Click -> covers his eyes (CoverEyes) and reveals password
     * - Unclick -> uncovers his eyes (UncoverEyes) and hides password
     */
    const togglePasswordVisibility = useCallback(
        (e) => {
            if (e) e.preventDefault();
            setEyesCovered((prevCovered) => {
                const nextCovered = !prevCovered;
                setPasswordVisible(nextCovered);
                fireClip(nextCovered ? "coverEyes" : "uncoverEyes");
                return nextCovered;
            });
        },
        [fireClip]
    );

    async function handleSubmit(e) {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        setError(null);

        if (eyesCovered) {
            setEyesCovered(false);
        }

        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error ?? "AUTOBOT SECURITY OVERRIDE: ACCESS DENIED");
                fireClip("loginError");
                setLoading(false);
                return;
            }

            fireClip("loginSuccess");
            setSubmitted(true);
            setLoading(false);

            if (typeof window !== "undefined" && data.access_token) {
                try {
                    localStorage.setItem("shackles_token", data.access_token);
                } catch (_) {}
            }
        } catch (err) {
            // Offline / Demo fallback: if email & password (>= 4 chars) are provided,
            // demonstrate the LoginSuccess Thumbs-Up sequence; otherwise trigger LoginError.
            if (email.trim() && password.length >= 4 && password !== "error") {
                fireClip("loginSuccess");
                setSubmitted(true);
                setLoading(false);
            } else {
                setError("DECEPTICON INTRUSION DETECTED — INVALID CREDENTIALS");
                fireClip("loginError");
                setLoading(false);
            }
        }
    }

    const handleResetDemo = () => {
        setSubmitted(false);
        setError(null);
        setLoading(false);
        setEyesCovered(false);
        setPasswordVisible(false);
        fireClip("idle");
    };

    return (
        <main className="login-page">
            <div className="login-canvas-wrap">
                <RobotScene
                    onReady={handleReady}
                    triggerClip={triggerClip}
                    trackingEnabled={!submitted && !eyesCovered && focusedField !== "password"}
                />
            </div>

            <div className="login-body">

                {/* Right-side Movie-Style Login Panel */}
                <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="login-panel"
                >
                    <div className="login-card">
                        <div className="login-card__corner login-card__corner--tl" />
                        <div className="login-card__corner login-card__corner--tr" />
                        <div className="login-card__corner login-card__corner--bl" />
                        <div className="login-card__corner login-card__corner--br" />

                        <div className="login-card__header">
                            <div className="login-card__insignia-row">
                                <svg
                                    className="autobot-crest"
                                    viewBox="0 0 64 64"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M10 10L24 16L32 8L40 16L54 10L58 24L50 38L54 52L38 58L32 50L26 58L10 52L14 38L6 24L10 10Z"
                                        stroke="#4dd0ff"
                                        strokeWidth="2.4"
                                        fill="rgba(77, 208, 255, 0.08)"
                                    />
                                    <path
                                        d="M20 26L30 30V44L22 40L20 26ZM44 26L34 30V44L42 40L44 26Z"
                                        fill="#e83c3c"
                                    />
                                    <path d="M29 14H35V26H29V14Z" fill="#4dd0ff" />
                                </svg>
                                <div>
                                    <p className="login-card__eyebrow">
                                        AUTOBOT SUPREME COMMAND // N.E.S.T.
                                    </p>
                                    <h1 className="login-card__title">
                                        TRANSFORM<span>ERS</span>
                                    </h1>
                                </div>
                            </div>
                            <div className="login-card__divider" />
                        </div>

                        <form onSubmit={handleSubmit} className="login-form">
                            <div className="login-field">
                                <label className="login-field__label">
                                    OPERATOR CALLSIGN / EMAIL
                                </label>
                                <input
                                    type="email"
                                    placeholder="prime@autobot.cybertron"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onFocus={() => handleFieldFocus("email")}
                                    onBlur={() => handleFieldBlur("email")}
                                    required
                                    autoComplete="email"
                                    disabled={loading || submitted}
                                    className="login-field__input"
                                />
                            </div>

                            <div className="login-field">
                                <label className="login-field__label" style={{ marginBottom: "0.45rem" }}>
                                    ALLSPARK ENCRYPTION KEY
                                </label>
                                <div className="login-field__wrap">
                                    <input
                                        type={passwordVisible ? "text" : "password"}
                                        placeholder="••••••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onFocus={() => handleFieldFocus("password")}
                                        onBlur={() => handleFieldBlur("password")}
                                        required
                                        autoComplete="current-password"
                                        disabled={loading || submitted}
                                        className="login-field__input login-field__input--password"
                                    />
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={togglePasswordVisibility}
                                        disabled={loading || submitted}
                                        title={
                                            eyesCovered
                                                ? "Click to Uncover Optimus's Eyes"
                                                : "Click to Make Optimus Cover His Eyes"
                                        }
                                        aria-label={
                                            eyesCovered ? "Uncover model eyes" : "Cover model eyes"
                                        }
                                        className={`login-field__toggle ${eyesCovered ? "login-field__toggle--covered" : ""}`}
                                    >
                                        {eyesCovered ? (
                                            /* Shielded / Covered Eye Icon */
                                            <svg
                                                width="19"
                                                height="19"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                            </svg>
                                        ) : (
                                            /* Open Eye Icon */
                                            <svg
                                                width="19"
                                                height="19"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                <span className="login-field__hint">
                                    Click the eye icon to toggle Optimus covering &amp; uncovering his eyes
                                </span>
                            </div>

                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        className="login-error"
                                    >
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {!submitted ? (
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="login-submit"
                                >
                                    {loading ? "AUTHENTICATING MATRIX..." : "INITIATE ENERGON LINK"}
                                </button>
                            ) : (
                                <div className="login-success-box">
                                    <div className="login-success-box__title">
                                        ACCESS GRANTED // THUMBS-UP CONFIRMED
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleResetDemo}
                                        className="login-reset-btn"
                                    >
                                        RESET TERMINAL
                                    </button>
                                </div>
                            )}
                        </form>

                        <div className="login-links">
                            <a href="#register" onClick={(e) => { e.preventDefault(); fireClip("look"); }}>
                                Enlist Autobot
                            </a>
                            <a href="#forgot" onClick={(e) => { e.preventDefault(); fireClip("loginError"); }}>
                                Matrix Recovery?
                            </a>
                        </div>
                    </div>


                </motion.div>
            </div>

            <div className="scanlines" />
            <div className="vignette" />
        </main>
    );
}
