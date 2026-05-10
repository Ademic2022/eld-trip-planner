const STOP_META = {
  PICKUP:         { label: "Pickup",         dot: "#4ade80", badge: "rgba(74,222,128,0.15)",  text: "#4ade80"  },
  DROPOFF:        { label: "Dropoff",        dot: "#fb923c", badge: "rgba(251,146,60,0.15)",  text: "#fb923c"  },
  FUEL:           { label: "Fuel Stop",      dot: "#f97316", badge: "rgba(249,115,22,0.15)",  text: "#fdba74"  },
  OVERNIGHT_REST: { label: "Overnight Rest", dot: "#818cf8", badge: "rgba(129,140,248,0.15)", text: "#818cf8"  },
  REST_BREAK:     { label: "30-min Break",   dot: "#22d3ee", badge: "rgba(34,211,238,0.15)",  text: "#22d3ee"  },
};

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatDuration(hrs) {
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function StopList({ stops, totalMiles, totalDurationHours }) {
  if (!stops?.length) return null;

  const restStops = stops.filter(s => s.stopType === "OVERNIGHT_REST" || s.stopType === "REST_BREAK").length;

  return (
    <div>
      {/* Section header */}
      <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "-0.01em" }}>Route Summary</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 20 }}>
          {stops.length} stops
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {[
          { val: totalMiles?.toFixed(0),          unit: "miles"      },
          { val: totalDurationHours?.toFixed(1),   unit: "drive hrs"  },
          { val: restStops,                        unit: "rest stops" },
        ].map(({ val, unit }, i) => (
          <div key={unit} style={{
            padding: "12px 0",
            display: "flex", flexDirection: "column", alignItems: "center",
            borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
          }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>{val}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{unit}</span>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ padding: "14px 20px 16px", position: "relative" }}>
        {/* Vertical connector */}
        <div style={{
          position: "absolute", left: 27, top: 26, bottom: 26,
          width: 1, background: "rgba(255,255,255,0.07)",
        }} />

        <div style={{ display: "flex", flexDirection: "column" }}>
          {stops.map((stop, i) => {
            const meta = STOP_META[stop.stopType] || { label: stop.stopType, dot: "#64748b", badge: "rgba(100,116,139,0.15)", text: "#94a3b8" };
            return (
              <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", position: "relative", alignItems: "flex-start" }}>
                {/* Dot */}
                <div style={{
                  flexShrink: 0, width: 14, height: 14, borderRadius: "50%",
                  background: meta.dot,
                  border: "2px solid rgba(12,22,40,1)",
                  boxShadow: `0 0 8px ${meta.dot}55`,
                  marginTop: 2, zIndex: 1,
                }} />
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                        background: meta.badge, color: meta.text,
                      }}>
                        {meta.label}
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
                        {formatDuration(stop.durationHours)}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {stop.location}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      {formatTime(stop.arrivalTime)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
