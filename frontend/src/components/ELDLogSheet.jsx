import { useEffect, useRef, useState } from "react";

// Canvas layout constants (logical pixels — retina scaling applied separately)
const W = 1100;
const MARGIN_L = 16;
const MARGIN_R = 16;
const HEADER_H = 110;
const GRID_LABEL_W = 130;   // left column for row labels
const TOTALS_W = 48;        // right column for row totals
const GRID_LEFT = MARGIN_L + GRID_LABEL_W;
const GRID_TOP = HEADER_H + 30;
const GRID_W = W - GRID_LEFT - TOTALS_W - MARGIN_R;
const ROW_H = 54;
const GRID_H = ROW_H * 4;
const REMARKS_TOP = GRID_TOP + GRID_H + 8;
const REMARKS_H = 120;
const FOOTER_TOP = REMARKS_TOP + REMARKS_H + 8;
const H = FOOTER_TOP + 28;   // derived — footer line + text + bottom margin, no blank space

const STATUSES = ["OFF_DUTY", "SLEEPER_BERTH", "DRIVING", "ON_DUTY_NOT_DRIVING"];
const ROW_LABELS = ["1. Off Duty", "2. Sleeper Berth", "3. Driving", "4. On Duty\n(not driving)"];

const ROW_Y = {};
STATUSES.forEach((s, i) => { ROW_Y[s] = GRID_TOP + i * ROW_H; });
const LINE_Y = {};
STATUSES.forEach((s) => { LINE_Y[s] = ROW_Y[s] + ROW_H / 2; });

const STATUS_COLORS = {
  DRIVING: "#1d4ed8",
  ON_DUTY_NOT_DRIVING: "#15803d",
  OFF_DUTY: "#6b7280",
  SLEEPER_BERTH: "#7c3aed",
};

function timeToX(isoStr, dayStartMs) {
  const ms = new Date(isoStr).getTime() - dayStartMs;
  const hours = ms / 3_600_000;
  const clamped = Math.max(0, Math.min(24, hours));
  return GRID_LEFT + (clamped / 24) * GRID_W;
}

function drawGrid(ctx) {
  // Outer border
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(GRID_LEFT, GRID_TOP, GRID_W, GRID_H);

  // Hour lines + tick marks
  for (let h = 0; h <= 24; h++) {
    const x = GRID_LEFT + (h / 24) * GRID_W;
    const isMajor = h === 0 || h === 12 || h === 24;
    ctx.strokeStyle = isMajor ? "#374151" : "#9ca3af";
    ctx.lineWidth = isMajor ? 1.5 : 0.5;
    ctx.beginPath();
    ctx.moveTo(x, GRID_TOP);
    ctx.lineTo(x, GRID_TOP + GRID_H);
    ctx.stroke();

    // Hour label (above grid)
    if (h > 0 && h < 24) {
      ctx.fillStyle = "#374151";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      const label = h === 12 ? "Noon" : h > 12 ? String(h - 12) : String(h);
      ctx.fillText(label, x, GRID_TOP - 2);
    }
  }

  // "Midnight" labels at left and right
  ctx.fillStyle = "#374151";
  ctx.font = "bold 8px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("Mid-\nnght", GRID_LEFT, GRID_TOP - 2);
  ctx.fillText("Mid-\nnght", GRID_LEFT + GRID_W, GRID_TOP - 2);

  // 15-min tick marks along the top of the grid
  for (let q = 1; q < 96; q++) {
    if (q % 4 === 0) continue; // skip full hours (already drawn)
    const x = GRID_LEFT + (q / 96) * GRID_W;
    const tickH = q % 2 === 0 ? 6 : 4; // 30-min ticks taller
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, GRID_TOP);
    ctx.lineTo(x, GRID_TOP + tickH);
    ctx.stroke();
  }

  // Row dividers + labels
  STATUSES.forEach((status, i) => {
    const y = ROW_Y[status];
    // Row divider
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 0.8;
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(GRID_LEFT, y);
      ctx.lineTo(GRID_LEFT + GRID_W + TOTALS_W, y);
      ctx.stroke();
    }

    // Row labels (left column)
    ctx.fillStyle = "#1f2937";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const lines = ROW_LABELS[i].split("\n");
    if (lines.length === 1) {
      ctx.fillText(lines[0], GRID_LEFT - 6, y + ROW_H / 2);
    } else {
      ctx.fillText(lines[0], GRID_LEFT - 6, y + ROW_H / 2 - 7);
      ctx.fillText(lines[1], GRID_LEFT - 6, y + ROW_H / 2 + 7);
    }
  });
}

function drawStatusLines(ctx, events, dayStartMs) {
  events.forEach((ev) => {
    const x1 = timeToX(ev.startTime, dayStartMs);
    const x2 = timeToX(ev.endTime, dayStartMs);
    if (x2 - x1 < 0.5) return;
    const y = LINE_Y[ev.status];
    ctx.strokeStyle = STATUS_COLORS[ev.status] || "#374151";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "square";
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.lineCap = "butt";
  });
}

function drawTransitions(ctx, events, dayStartMs) {
  // Red dot at the very start of the day's log
  if (events.length > 0) {
    const x0 = timeToX(events[0].startTime, dayStartMs);
    const y0 = LINE_Y[events[0].status];
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(x0, y0, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];
    if (prev.status === curr.status) continue;
    const x = timeToX(prev.endTime, dayStartMs);
    const y1 = LINE_Y[prev.status];
    const y2 = LINE_Y[curr.status];

    // Vertical connector line
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();

    // Red filled dots at both ends of the transition line
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(x, y1, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y2, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRemarks(ctx, events, dayStartMs) {
  const remarksY = REMARKS_TOP;
  // Section label
  ctx.fillStyle = "#374151";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Remarks", MARGIN_L, remarksY + 2);

  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 0.8;
  ctx.strokeRect(GRID_LEFT, remarksY, GRID_W, REMARKS_H);

  // Solid drop lines + 45° labels anchored at the bottom (rising toward grid)
  // Rules: skip the midnight gap-fill (i=0), skip same-location re-visits
  let lastLoc = null;
  events.forEach((ev, i) => {
    if (i === 0) return;                              // midnight gap-fill — nothing happened
    if (events[i - 1].status === ev.status) return;  // no status change
    if (ev.location === lastLoc) return;              // same location, already labelled

    lastLoc = ev.location;
    const x = timeToX(ev.startTime, dayStartMs);
    const lineBottom = remarksY + REMARKS_H - 12;

    // Solid drop line from grid bottom through the full remarks box
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x, GRID_TOP + GRID_H);
    ctx.lineTo(x, lineBottom);
    ctx.stroke();

    // Small horizontal tick at the base
    ctx.beginPath();
    ctx.moveTo(x - 4, lineBottom);
    ctx.lineTo(x + 4, lineBottom);
    ctx.stroke();

    // Build label: first two location parts (city, county/state) + event notes
    const parts = ev.location.split(",").map(s => s.trim());
    const shortLoc = parts.slice(0, 2).join(", ");
    const note = ev.notes && ev.notes !== "Off duty" && ev.notes !== "" ? ` / ${ev.notes}` : "";
    const label = `${shortLoc}${note}`;
    const text = label.length > 32 ? label.slice(0, 30) + "…" : label;

    // 45° label anchored at the base tick — text rises upper-right
    ctx.save();
    ctx.translate(x + 3, lineBottom - 2);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = "#1f2937";
    ctx.font = "9.5px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(text, 0, 0);
    ctx.restore();
  });
}

function drawTotals(ctx, totals) {
  const labels = {
    OFF_DUTY: totals.totalOffDuty,
    SLEEPER_BERTH: totals.totalSleeperBerth,
    DRIVING: totals.totalDriving,
    ON_DUTY_NOT_DRIVING: totals.totalOnDuty,
  };
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  STATUSES.forEach((status) => {
    const y = LINE_Y[status];
    const val = labels[status] ?? 0;
    const hrs = Math.floor(val);
    const mins = Math.round((val - hrs) * 60);
    const label = `${hrs}:${String(mins).padStart(2, "0")}`;
    ctx.fillStyle = STATUS_COLORS[status] || "#374151";
    ctx.fillText(label, GRID_LEFT + GRID_W + TOTALS_W / 2, y);
  });

  // "Total Hours" column header
  ctx.fillStyle = "#374151";
  ctx.font = "8px sans-serif";
  ctx.fillText("Total", GRID_LEFT + GRID_W + TOTALS_W / 2, GRID_TOP - 14);
  ctx.fillText("Hours", GRID_LEFT + GRID_W + TOTALS_W / 2, GRID_TOP - 5);
}

function drawHeader(ctx, log) {
  const date = new Date(log.date + "T00:00:00Z");
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });

  // Title
  ctx.fillStyle = "#111827";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Driver's Daily Log", MARGIN_L, 10);

  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#374151";
  ctx.fillText("(24 Hours)", MARGIN_L, 32);

  // Date
  ctx.font = "bold 12px sans-serif";
  ctx.fillStyle = "#1d4ed8";
  ctx.textAlign = "right";
  ctx.fillText(dateStr, W - MARGIN_R, 10);

  // Info line
  ctx.font = "10px sans-serif";
  ctx.fillStyle = "#6b7280";
  ctx.textAlign = "right";
  ctx.fillText("Property-Carrying Driver · 70hr/8-Day Cycle", W - MARGIN_R, 28);

  // Total miles
  ctx.font = "bold 11px sans-serif";
  ctx.fillStyle = "#1f2937";
  ctx.textAlign = "left";
  ctx.fillText(`Total Miles Today: ${log.totalMiles?.toFixed(0) ?? 0}`, MARGIN_L, 52);

  // Hour labels header
  ctx.font = "bold 9px sans-serif";
  ctx.fillStyle = "#374151";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const hoursRow = "1   2   3   4   5   6   7   8   9  10  11 Noon  1   2   3   4   5   6   7   8   9  10  11";
  ctx.fillText(hoursRow, GRID_LEFT + GRID_W / 2, GRID_TOP - 14);

  // Color legend
  const legend = [
    { label: "Driving", color: STATUS_COLORS.DRIVING },
    { label: "On Duty ND", color: STATUS_COLORS.ON_DUTY_NOT_DRIVING },
    { label: "Off Duty", color: STATUS_COLORS.OFF_DUTY },
    { label: "Sleeper", color: STATUS_COLORS.SLEEPER_BERTH },
  ];
  let lx = MARGIN_L;
  legend.forEach(({ label, color }) => {
    ctx.fillStyle = color;
    ctx.fillRect(lx, 70, 12, 8);
    ctx.fillStyle = "#374151";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, lx + 15, 74);
    lx += 80;
  });
}

function drawFooter(ctx, log) {
  const y = FOOTER_TOP;
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(MARGIN_L, y);
  ctx.lineTo(W - MARGIN_R, y);
  ctx.stroke();

  ctx.fillStyle = "#6b7280";
  ctx.font = "9px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(
    "Driver certifies that the information herein is true and correct. " +
    "Use time standard of home terminal.",
    MARGIN_L, y + 4
  );
}

function drawLog(ctx, log) {
  const dayStartMs = new Date(log.date + "T00:00:00Z").getTime();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Outer card border
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  drawHeader(ctx, log);
  drawGrid(ctx);
  drawStatusLines(ctx, log.events, dayStartMs);
  drawTransitions(ctx, log.events, dayStartMs);
  drawRemarks(ctx, log.events, dayStartMs);
  drawTotals(ctx, log);
  drawFooter(ctx, log);
}

const TOTALS_CONFIG = [
  { key: "totalDriving",      label: "Driving",     color: "#1d4ed8", bg: "#eff6ff" },
  { key: "totalOnDuty",       label: "On Duty ND",  color: "#15803d", bg: "#f0fdf4" },
  { key: "totalOffDuty",      label: "Off Duty",    color: "#4b5563", bg: "#f9fafb" },
  { key: "totalSleeperBerth", label: "Sleeper",     color: "#6d28d9", bg: "#f5f3ff" },
];

const REMARK_DOT = {
  DRIVING:             "#1d4ed8",
  ON_DUTY_NOT_DRIVING: "#15803d",
  OFF_DUTY:            "#4b5563",
  SLEEPER_BERTH:       "#6d28d9",
};

function fmtHrs(val) {
  const h = Math.floor(val ?? 0);
  const m = Math.round(((val ?? 0) - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function fmtRemarkTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

function getRemarkItems(events) {
  const items = [];
  let lastLoc = null;
  events.forEach((ev, i) => {
    if (i === 0) return;
    if (events[i - 1].status === ev.status) return;
    if (ev.location === lastLoc) return;
    lastLoc = ev.location;
    const parts = ev.location.split(",").map(s => s.trim());
    const shortLoc = parts.slice(0, 2).join(", ");
    const note = ev.notes && ev.notes !== "Off duty" ? ev.notes : "";
    items.push({ startTime: ev.startTime, status: ev.status, shortLoc, note });
  });
  return items;
}

function SingleLog({ log }) {
  const ref = useRef();

  useEffect(() => {
    if (!ref.current || !log) return;
    const canvas = ref.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    drawLog(ctx, log);
  }, [log]);

  return (
    <div className="eld-scroll" style={{ background: "#f8fafc" }}>
      <canvas ref={ref} style={{ width: W, height: H, display: "block" }} />
    </div>
  );
}

export default function ELDLogSheet({ eldLogs }) {
  const [activeIdx, setActiveIdx] = useState(0);
  if (!eldLogs?.length) return null;

  const log = eldLogs[activeIdx];

  return (
    <div>
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">ELD Daily Logs</h2>
          <p className="text-xs text-slate-400 mt-0.5">{eldLogs.length} day{eldLogs.length !== 1 ? "s" : ""} · FMCSA Driver's Daily Log</p>
        </div>
        {eldLogs.length > 1 && (
          <div className="flex gap-1.5 flex-wrap justify-end">
            {eldLogs.map((l, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-150"
                style={i === activeIdx
                  ? { background: "#1d4ed8", color: "#fff", boxShadow: "0 2px 8px rgba(29,78,216,0.3)" }
                  : { background: "#f1f5f9", color: "#475569" }
                }
              >
                Day {i + 1} <span className="opacity-60 ml-1">{l.date}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
        {TOTALS_CONFIG.map(({ key, label, color, bg }) => (
          <div key={key} className="py-3 flex flex-col items-center" style={{ background: bg }}>
            <span className="text-sm font-bold tabular-nums" style={{ color }}>{fmtHrs(log[key])}</span>
            <span className="text-xs mt-0.5" style={{ color, opacity: 0.7 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Canvas */}
      <SingleLog log={log} />

      {/* Text remarks list — readable summary of duty status changes */}
      {(() => {
        const items = getRemarkItems(log.events);
        if (!items.length) return null;
        return (
          <div style={{ borderTop: "1px solid #f1f5f9", padding: "14px 20px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 10 }}>
              Duty Status Changes
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: "2px 32px" }}>
              {items.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #f8fafc" }}>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontVariantNumeric: "tabular-nums", minWidth: 58, whiteSpace: "nowrap" }}>
                    {fmtRemarkTime(item.startTime)}
                  </span>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: REMARK_DOT[item.status] || "#6b7280", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{item.shortLoc}</span>
                  {item.note && (
                    <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 2 }}>— {item.note}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Footer note */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        Scroll horizontally to view the full 24-hour log. Times shown in UTC.
      </div>
    </div>
  );
}

