import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { PLAN_TRIP } from "../graphql/mutations";

function Spinner() {
  return (
    <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function ArcGauge({ value }) {
  const cx = 54, cy = 56, r = 38;
  const startAngle = 225;
  const totalSweep = 270;
  const pct = Math.min(Math.max(value, 0) / 70, 1);

  function pt(deg) {
    const rad = (deg - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function arc(deg, sw) {
    const s = pt(deg), e = pt(deg + sw);
    return `M${s.x.toFixed(1)} ${s.y.toFixed(1)} A${r} ${r} 0 ${sw > 180 ? 1 : 0} 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
  }

  const color = pct >= 0.8 ? "#f87171" : pct >= 0.55 ? "#fbbf24" : "#34d399";
  const status = pct >= 0.8 ? "Critical" : pct >= 0.55 ? "High use" : "Available";

  return (
    <svg viewBox="0 0 108 108" width="92" height="92" style={{ flexShrink: 0 }}>
      <path d={arc(startAngle, totalSweep)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" strokeLinecap="round" />
      {pct > 0.01 && (
        <path d={arc(startAngle, totalSweep * pct)} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${color}99)` }} />
      )}
      <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="800" fill={color} fontFamily="system-ui, -apple-system, sans-serif">
        {value.toFixed(1)}
      </text>
      <text x={cx} y={cy + 11} textAnchor="middle" fontSize="7.5" fill="rgba(255,255,255,0.35)" fontFamily="system-ui, -apple-system, sans-serif">
        {status}
      </text>
    </svg>
  );
}

const STOPS = [
  { id: "currentLocation", n: "01", label: "Origin",   placeholder: "Chicago, IL",       color: "#38bdf8", glowBg: "rgba(56,189,248,0.12)",  glowBorder: "rgba(56,189,248,0.35)" },
  { id: "pickupLocation",  n: "02", label: "Pickup",   placeholder: "Indianapolis, IN",   color: "#4ade80", glowBg: "rgba(74,222,128,0.12)",  glowBorder: "rgba(74,222,128,0.35)" },
  { id: "dropoffLocation", n: "03", label: "Dropoff",  placeholder: "Nashville, TN",      color: "#fb923c", glowBg: "rgba(251,146,60,0.12)",  glowBorder: "rgba(251,146,60,0.35)" },
];

export default function TripForm({ onResult }) {
  const [form, setForm] = useState({
    currentLocation: "Chicago, IL",
    pickupLocation: "Kansas City, MO",
    dropoffLocation: "Dallas, TX",
    cycleHoursUsed: "24.5",
  });
  const [errors, setErrors] = useState({});

  const [planTrip, { loading, error }] = useMutation(PLAN_TRIP, {
    onCompleted: (data) => onResult(data.planTrip),
  });

  function validate() {
    const errs = {};
    STOPS.forEach(({ id }) => { if (!form[id].trim()) errs[id] = "Required"; });
    const hrs = parseFloat(form.cycleHoursUsed);
    if (isNaN(hrs) || hrs < 0 || hrs > 70) errs.cycleHoursUsed = "Enter 0–70";
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    planTrip({
      variables: {
        currentLocation: form.currentLocation,
        pickupLocation: form.pickupLocation,
        dropoffLocation: form.dropoffLocation,
        cycleHoursUsed: parseFloat(form.cycleHoursUsed),
      },
    });
  }

  const cycleHrs  = Math.min(70, Math.max(0, parseFloat(form.cycleHoursUsed) || 0));
  const cyclePct  = (cycleHrs / 70) * 100;
  const cycleColor = cyclePct >= 80 ? "#f87171" : cyclePct >= 55 ? "#fbbf24" : "#34d399";

  return (
    <form onSubmit={handleSubmit} style={{ padding: "24px 20px 20px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: "linear-gradient(135deg,#2563eb,#4f46e5,#7c3aed)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px rgba(99,102,241,0.5)",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </div>
        <div>
          <div style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>Plan Your Trip</div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 2 }}>HOS-compliant route generation</div>
        </div>
      </div>

      {/* ── Route ── */}
      <div style={{ marginBottom: 22 }}>
        <SectionLabel>Route</SectionLabel>

        <div style={{ position: "relative", paddingLeft: 48 }}>
          {/* Connector gradient line */}
          <div style={{
            position: "absolute", left: 17, top: 39, bottom: 44,
            width: 2,
            background: "linear-gradient(to bottom, #38bdf8 0%, #4ade80 50%, #fb923c 100%)",
            borderRadius: 2, opacity: 0.45,
          }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {STOPS.map(({ id, n, label, placeholder, color, glowBg, glowBorder }) => (
              <div key={id} style={{ position: "relative" }}>
                {/* Step badge */}
                <div style={{
                  position: "absolute", left: -48, top: 22,
                  width: 34, height: 34, borderRadius: 9,
                  background: glowBg,
                  border: `1.5px solid ${glowBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 14px ${color}22`,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: "0.02em" }}>{n}</span>
                </div>

                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>
                  {label}
                </div>
                <input
                  type="text"
                  value={form[id]}
                  placeholder={placeholder}
                  onChange={(e) => setForm({ ...form, [id]: e.target.value })}
                  className="trip-input"
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.05)",
                    border: `1.5px solid ${errors[id] ? "rgba(248,113,113,0.6)" : "rgba(255,255,255,0.1)"}`,
                    borderLeft: `3px solid ${errors[id] ? "#f87171" : color}`,
                    borderRadius: 8,
                    padding: "9px 12px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#e2e8f0",
                    outline: "none",
                    transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
                    boxShadow: errors[id] ? "0 0 0 3px rgba(248,113,113,0.12)" : "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.background = "rgba(255,255,255,0.08)";
                    if (!errors[id]) {
                      e.target.style.borderColor = color;
                      e.target.style.boxShadow = `0 0 0 3px ${color}18`;
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.background = "rgba(255,255,255,0.05)";
                    if (!errors[id]) {
                      e.target.style.borderColor = "rgba(255,255,255,0.1)";
                      e.target.style.boxShadow = "none";
                    }
                  }}
                />
                {errors[id] && (
                  <p style={{ fontSize: 11, color: "#f87171", marginTop: 4, fontWeight: 500 }}>{errors[id]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Cycle Hours ── */}
      <div style={{
        marginBottom: 20,
        padding: "16px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.07)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
            Cycle Hours
          </span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: cycleColor, fontVariantNumeric: "tabular-nums" }}>
            {cycleHrs.toFixed(1)} / 70 hrs
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <ArcGauge value={cycleHrs} />
          <div style={{ flex: 1 }}>
            <input
              type="number" min="0" max="70" step="0.5"
              value={form.cycleHoursUsed}
              onChange={(e) => setForm({ ...form, cycleHoursUsed: e.target.value })}
              className="trip-input"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: `1.5px solid ${errors.cycleHoursUsed ? "rgba(248,113,113,0.6)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 15, fontWeight: 700,
                color: "#e2e8f0",
                outline: "none",
                marginBottom: 10,
              }}
            />
            <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
              <div style={{
                height: "100%", borderRadius: 99,
                width: `${cyclePct}%`,
                background: `linear-gradient(90deg, #3b82f6, ${cycleColor})`,
                transition: "width 0.5s ease, background-color 0.5s ease",
              }} />
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.4 }}>
              On-duty hours in rolling 8-day window
            </p>
          </div>
        </div>
        {errors.cycleHoursUsed && (
          <p style={{ fontSize: 11, color: "#f87171", marginTop: 10, fontWeight: 500 }}>{errors.cycleHoursUsed}</p>
        )}
      </div>

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "13px 20px",
          borderRadius: 10, border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: 14, fontWeight: 700, color: "#fff",
          background: loading ? "rgba(255,255,255,0.08)" : "#2563eb",
          boxShadow: loading ? "none" : "0 4px 20px rgba(37,99,235,0.35), 0 1px 3px rgba(0,0,0,0.2)",
          transition: "all 0.2s ease",
          letterSpacing: "0.02em",
          marginBottom: 12,
        }}
      >
        {loading ? (
          <><Spinner /><span>Planning route…</span></>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            <span>Generate ELD Plan</span>
          </>
        )}
      </button>

      {error && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          borderRadius: 10, padding: "12px 14px", marginBottom: 12,
          background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#fca5a5",
          fontSize: 13,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error.message}
        </div>
      )}

      {/* ── Assumptions ── */}
      <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ padding: "8px 14px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>
            Assumptions
          </span>
        </div>
        {[
          ["Speed",             "55 mph avg"],
          ["Fuel stops",        "Every 1,000 mi"],
          ["Pickup / Dropoff",  "1 hr each"],
          ["Pre-trip inspect",  "15 min"],
        ].map(([k, v], i, arr) => (
          <div key={k} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "7px 14px",
            borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
          }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{k}</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>

    </form>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", whiteSpace: "nowrap" }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
    </div>
  );
}
