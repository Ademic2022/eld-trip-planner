import { useState } from "react";
import { ApolloProvider } from "@apollo/client/react";
import client from "./apollo";
import TripForm from "./components/TripForm";
import MapView from "./components/MapView";
import StopList from "./components/StopList";
import ELDLogSheet from "./components/ELDLogSheet";

function TruckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v4h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  );
}

function MapPlaceholder() {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, background: "#fafbfc" }}>
      <div style={{ position: "relative" }}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
          <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
        </svg>
        <div style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>Route map will appear here</p>
        <p style={{ fontSize: 12, color: "#94a3b8" }}>Submit the form to generate your ELD-compliant route</p>
      </div>
    </div>
  );
}

function AppInner() {
  const [result, setResult] = useState(null);

  return (
    <div className="app-root">

      {/* Header */}
      <header style={{
        background: "#060d1a",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
        position: "relative",
        zIndex: 10,
      }}>
        <div style={{ maxWidth: 1800, margin: "0 auto", padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#fff" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg,#2563eb,#4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(79,70,229,0.45)",
            }}>
              <TruckIcon />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>ELD Trip Planner</div>
              <div className="header-sub">FMCSA-compliant hours of service</div>
            </div>
          </div>

          <div className="header-badges">
            {["70 hr / 8-day cycle", "Property carrier"].map(label => (
              <span key={label} style={{
                fontSize: 11, fontWeight: 500,
                padding: "4px 12px", borderRadius: 20,
                background: "rgba(59,130,246,0.1)",
                color: "#60a5fa",
                border: "1px solid rgba(59,130,246,0.18)",
              }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* Split body */}
      <div className="app-body">

        {/* Dark sidebar */}
        <div className="app-sidebar">
          <TripForm onResult={setResult} />
          {result && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} className="fade-in">
              <StopList
                stops={result.stops}
                totalMiles={result.route.totalMiles}
                totalDurationHours={result.route.totalDurationHours}
              />
            </div>
          )}
        </div>

        {/* Light content area */}
        <div className="app-content">
          <div className="app-content-pad">

            {/* Map */}
            <div className="map-card" style={{
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.06)",
              border: "1px solid rgba(226,232,240,0.8)",
              overflow: "hidden",
            }}>
              {result
                ? <MapView polyline={result.route.polyline} stops={result.stops} />
                : <MapPlaceholder />
              }
            </div>

            {/* ELD logs */}
            {result?.eldLogs?.length > 0 && (
              <div style={{
                background: "#fff",
                borderRadius: 16,
                boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.06)",
                border: "1px solid rgba(226,232,240,0.8)",
                overflow: "hidden",
              }} className="fade-in">
                <ELDLogSheet eldLogs={result.eldLogs} />
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

export default function App() {
  return (
    <ApolloProvider client={client}>
      <AppInner />
    </ApolloProvider>
  );
}
