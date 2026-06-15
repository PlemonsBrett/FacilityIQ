import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * FacilityIQ animated splash screen — "The Analytical Mandala".
 *
 * Demo-only feature, gated behind the `?splash=on` URL param (see main.tsx).
 * Choreography maps to logo/facilityiq_splash_story.md:
 *   Phase 1 (0–4s)   The Noise        — chaotic unstructured data fragments
 *   Phase 2 (4–7s)   Flash            — colored spikes burst outward
 *   Phase 3 (7–11s)  Convergence      — spikes converge inward (traceability)
 *   Phase 4 (11–15s) Oasis of Clarity — blue core locks, gold IQ + logo resolve
 *
 * The sequence plays automatically on page load (no click). Music attempts to
 * autoplay for the full 15s, but browsers may block audio until the user has
 * interacted with the page — in that case the splash runs silently.
 * Drop a track at app/client/public/splash.mp3 to enable sound (silent until then).
 */

const DURATION_MS = 15_000; // hard cap per requirements
const FADE_MS = 600;
const AUDIO_SRC = "/splash.mp3";
const LOGO_SRC = "/facilityiq-logo.png";

// Brand palette (from the story doc): deep sapphire core + pink / cyan / gold accents.
const COLORS = ["#FF4D8D", "#5FD3E3", "#FFD24A"];
const SPIKE_COUNT = 24;

// Mission phrases shown ~3s in — a single problem→promise arc, not four
// standalone slogans. First two set up the pain (rendered muted); the last
// two are the FacilityIQ payoff (rendered bright). Edit to swap the messaging.
const PHRASES = [
  "Planners decide on data they can't trust.",
  "Capabilities hidden, contradictions buried.",
  "Then FacilityIQ surfaces the truth —",
  "every claim traced, every doubt flagged.",
];

// Sample chaotic-data fragments for Phase 1.
const FRAGMENTS = [
  "capacity: NULL",
  '"advanced pediatric surgery available"',
  "year_established: 1948?",
  "beds: —",
  "ICU: unknown",
  '"24x7 emergency"',
  "ownership: ???",
  "lat: 0.0  lng: 0.0",
  '"MRI? CT? unclear"',
  "staff_count: N/A",
  '"trauma center (unverified)"',
  "accreditation: ——",
  "dialysis: maybe",
  '"blood bank on-site"',
  "phone: invalid",
];

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState<"gate" | "playing">("gate");
  const [exiting, setExiting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timers = useRef<number[]>([]);
  const started = useRef(false);

  const finish = () => {
    timers.current.forEach(clearTimeout);
    setExiting(true);
    const a = audioRef.current;
    if (a) {
      // brief fade-out of the music alongside the visual fade
      const startVol = a.volume;
      const steps = 6;
      for (let i = 1; i <= steps; i++) {
        timers.current.push(
          window.setTimeout(() => {
            a.volume = Math.max(0, startVol * (1 - i / steps));
            if (i === steps) a.pause();
          }, (FADE_MS / steps) * i)
        );
      }
    }
    timers.current.push(window.setTimeout(onComplete, FADE_MS));
  };

  // Begin on the Enter click: the user gesture unlocks audio, then the timeline
  // runs. Guarded so it only fires once.
  const begin = () => {
    if (started.current) return;
    started.current = true;
    const a = audioRef.current;
    if (a) {
      a.volume = 0.8;
      a.currentTime = 0;
      // Within the click gesture, so the browser allows playback with sound.
      void a.play().catch(() => {});
    }
    setStage("playing");
    timers.current.push(window.setTimeout(finish, DURATION_MS));
  };

  // Enter key triggers the gate; Esc skips at any point.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "Enter" && stage === "gate") begin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <div className={`fiq-splash${exiting ? " fiq-splash--exit" : ""}`} role="dialog" aria-label="FacilityIQ intro">
      <style>{CSS}</style>
      <audio ref={audioRef} src={AUDIO_SRC} preload="auto" />

      {stage === "gate" ? (
        <div className="fiq-gate">
          <img className="fiq-gate__logo" src={LOGO_SRC} alt="FacilityIQ" />
          <button className="fiq-gate__btn" onClick={begin} autoFocus>
            Enter
          </button>
          <p className="fiq-gate__hint">click to begin · sound on</p>
        </div>
      ) : (
        <>
          {/* Background: a colorful bloom that grows to echo the logo, then a light
              wash that resolves the screen into the FacilityIQ logo's background. */}
          <div className="fiq-bloom" />
          <div className="fiq-wash" />

          <div className="fiq-show" onClick={finish} title="click or press Esc to skip">
          {/* Phase 1 — The Noise */}
          <div className="fiq-noise">
            {FRAGMENTS.map((t, i) => (
              <span
                key={i}
                className="fiq-frag"
                style={{
                  left: `${(i * 37) % 90 + 3}%`,
                  top: `${(i * 53) % 84 + 6}%`,
                  animationDelay: `${(i % 6) * 0.18}s`,
                }}
              >
                {t}
              </span>
            ))}
          </div>

          {/* Phases 2 & 3 — burst then converge */}
          <div className="fiq-mandala">
            {Array.from({ length: SPIKE_COUNT }).map((_, i) => (
              <span
                key={i}
                className="fiq-spike"
                style={
                  {
                    transform: `rotate(${(360 / SPIKE_COUNT) * i}deg)`,
                    "--c": COLORS[i % COLORS.length],
                  } as CSSProperties
                }
              />
            ))}
          </div>

          {/* Mission phrases — a problem→promise arc that fades in from 3s and
              persists, then clears for the reveal. First two muted, last two bright. */}
          <div className="fiq-lines">
            {PHRASES.map((t, i) => (
              <span
                key={i}
                className={`fiq-line ${i < 2 ? "fiq-line--problem" : "fiq-line--key"}`}
                style={{ animationDelay: `${3 + i * 1.7}s` }}
              >
                {t}
              </span>
            ))}
          </div>

          {/* Phase 4 — Oasis of Clarity */}
          <div className="fiq-core">
            <img className="fiq-core__logo" src={LOGO_SRC} alt="FacilityIQ" />
          </div>

          <div className="fiq-progress" />
          <button className="fiq-skip" onClick={finish}>
            Skip
          </button>
          </div>
        </>
      )}
    </div>
  );
}

const CSS = `
.fiq-splash {
  position: fixed; inset: 0; z-index: 9999;
  background: radial-gradient(circle at 50% 45%, #11343f 0%, #0B2026 60%, #060f12 100%);
  color: #fff; overflow: hidden;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  display: flex; align-items: center; justify-content: center;
  animation: fiqFadeIn .5s ease both;
}
.fiq-splash--exit { animation: fiqFadeOut .6s ease forwards; }
@keyframes fiqFadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes fiqFadeOut { from { opacity: 1 } to { opacity: 0; visibility: hidden } }

/* ---------- Gate (click to enable audio) ---------- */
.fiq-gate {
  text-align: center; padding: 0 24px;
  display: flex; flex-direction: column; align-items: center; gap: 22px;
  animation: fiqGateIn .7s cubic-bezier(0.25,1,0.5,1) both;
}
.fiq-gate__logo {
  width: min(72vw, 460px); height: auto; display: block; border-radius: 18px;
  box-shadow: 0 24px 70px rgba(0,0,0,.45), 0 0 60px rgba(95,211,227,.20);
}
.fiq-gate__btn {
  padding: 13px 46px; font-size: 16px; font-weight: 600; color: #0B2026;
  background: linear-gradient(135deg, #FFD24A, #FF4D8D); border: 0; border-radius: 999px; cursor: pointer;
  box-shadow: 0 6px 26px rgba(255,77,141,.4); transition: transform .15s ease, box-shadow .15s ease;
}
.fiq-gate__btn:hover { transform: translateY(-2px); box-shadow: 0 10px 34px rgba(255,77,141,.55); }
.fiq-gate__hint { margin: 0; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,.32); }
@keyframes fiqGateIn { from { opacity: 0; transform: translateY(12px) scale(.98) } to { opacity: 1; transform: none } }

/* ---------- Background bloom + resolve-to-logo wash ---------- */
.fiq-bloom {
  position: absolute; inset: -25%; pointer-events: none; filter: blur(14px);
  background: radial-gradient(ellipse 60% 55% at 50% 46%,
    rgba(95,211,227,.32) 0%, rgba(255,196,74,.20) 28%,
    rgba(255,107,129,.15) 48%, rgba(120,160,220,.11) 66%, transparent 80%);
  animation: fiqBloom 15s ease-in-out both;
}
@keyframes fiqBloom {
  0% { opacity: .25; transform: scale(.5); }
  40% { opacity: .7; transform: scale(.95); }
  72% { opacity: .95; transform: scale(1.3); }   /* bloom grows to fill the frame */
  100% { opacity: .55; transform: scale(1.45); }
}
.fiq-wash {
  position: absolute; inset: 0; opacity: 0; pointer-events: none;
  background: linear-gradient(125deg, #e9f1f8 0%, #fdf7f0 55%, #f5eef9 100%);
  animation: fiqWash 15s ease both;
}
@keyframes fiqWash {
  0%, 70% { opacity: 0; }
  88%, 100% { opacity: 1; }
}

/* ---------- Show ---------- */
.fiq-show { position: absolute; inset: 0; cursor: pointer; }

/* Phase 1 — noise fragments */
.fiq-noise { position: absolute; inset: 0; }
.fiq-frag {
  position: absolute; font-family: 'SF Mono', ui-monospace, monospace; font-size: 13px;
  color: rgba(180,200,210,.55); white-space: nowrap; transform: translate(-50%, -50%);
  animation: fiqNoise 6s ease-in-out both;
}
@keyframes fiqNoise {
  0% { opacity: 0; filter: blur(4px); transform: translate(-50%,-50%) scale(.9); }
  12% { opacity: .8; filter: blur(0); }
  40% { opacity: .7; }
  60% { opacity: 0; filter: blur(6px); transform: translate(-50%,-50%) scale(1.1); }
  100% { opacity: 0; }
}

/* Phases 2 & 3 — radial spikes burst then converge */
.fiq-mandala {
  position: absolute; left: 50%; top: 50%; width: 0; height: 0;
  animation: fiqMandala 15s cubic-bezier(0.25,1,0.5,1) both, fiqSpin 15s linear both;
}
.fiq-spike {
  position: absolute; left: 0; top: 0; width: 4px; height: 168px;
  margin-left: -2px; transform-origin: 50% 0;
  background: linear-gradient(to bottom, var(--c), transparent);
  border-radius: 4px; box-shadow: 0 0 12px var(--c);
}
@keyframes fiqMandala {
  0%, 26% { opacity: 0; transform: translate(-50%,-50%) scale(0); }
  33% { opacity: 1; transform: translate(-50%,-50%) scale(1.7); }   /* burst outward */
  47% { opacity: 1; transform: translate(-50%,-50%) scale(1.85); }
  73% { opacity: 1; transform: translate(-50%,-50%) scale(.92); }   /* converge inward + lock */
  82% { opacity: .9; transform: translate(-50%,-50%) scale(.92); }
  92%, 100% { opacity: 0; transform: translate(-50%,-50%) scale(.8); } /* fade out so the logo stands alone */
}
@keyframes fiqSpin {
  0%, 26% { rotate: -40deg; }
  73% { rotate: 8deg; }
  100% { rotate: 0deg; }
}

/* Phase 4 — brand banner reveal (landscape logo lockup) */
.fiq-core {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  animation: fiqCore 15s cubic-bezier(0.25,1,0.5,1) both;
}
.fiq-core__logo {
  width: min(74vw, 540px); height: auto; display: block;
  border-radius: 18px;
  animation: fiqLogo 15s ease both;
}
@keyframes fiqCore {
  0%, 70% { opacity: 0; transform: scale(.4); }
  78% { opacity: 1; transform: scale(.92); }
  88% { opacity: 1; transform: scale(1.03); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes fiqLogo {
  /* starts as a glowing card over the dark bloom, then settles seamlessly
     onto the light wash so the screen becomes the logo's own background */
  0%, 80% { opacity: 0; transform: scale(.97); box-shadow: 0 24px 70px rgba(0,0,0,.5), 0 0 70px rgba(95,211,227,.25); }
  90% { opacity: 1; transform: scale(1); box-shadow: 0 16px 46px rgba(80,120,160,.22); }
  100% { opacity: 1; transform: scale(1); box-shadow: 0 8px 30px rgba(120,150,180,.14); }
}

/* mission phrases — fade in staggered, persist, then clear before the reveal */
.fiq-lines {
  position: absolute; inset: 0; padding: 0 24px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 16px; text-align: center; pointer-events: none;
  animation: fiqLinesOut 15s ease both;
}
.fiq-line {
  letter-spacing: .2px; opacity: 0;
  text-shadow: 0 2px 26px rgba(0,0,0,.85), 0 0 8px rgba(0,0,0,.5);
  animation: fiqLineIn .9s cubic-bezier(0.25,1,0.5,1) both;
}
/* problem setup — quieter */
.fiq-line--problem { font-size: clamp(16px, 2.5vw, 25px); font-weight: 500; color: rgba(214,224,230,.62); }
/* FacilityIQ payoff — louder, set apart from the problem lines above */
.fiq-line--key { font-size: clamp(20px, 3.1vw, 33px); font-weight: 700; color: #fff; }
.fiq-line--key:nth-of-type(3) { margin-top: 18px; color: #FFD24A; }
@keyframes fiqLineIn {
  from { opacity: 0; transform: translateY(16px); filter: blur(6px); }
  to { opacity: 1; transform: none; filter: blur(0); }
}
@keyframes fiqLinesOut {
  0%, 68% { opacity: 1; }
  80%, 100% { opacity: 0; }
}
.fiq-progress {
  position: absolute; left: 0; bottom: 0; height: 3px;
  background: linear-gradient(90deg, #FF4D8D, #5FD3E3, #FFD24A);
  animation: fiqProgress 15s linear both;
}
@keyframes fiqProgress { from { width: 0 } to { width: 100% } }
.fiq-skip {
  position: absolute; top: 20px; right: 20px; padding: 7px 16px; font-size: 12px;
  color: rgba(255,255,255,.7); background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.15);
  border-radius: 999px; cursor: pointer; backdrop-filter: blur(4px);
}
.fiq-skip:hover { background: rgba(255,255,255,.16); color: #fff; }

@media (prefers-reduced-motion: reduce) {
  .fiq-noise, .fiq-mandala { display: none; }
  .fiq-core, .fiq-core__logo, .fiq-lines { animation-duration: .6s; }
}
`;
