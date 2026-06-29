import { ImageResponse } from "next/og";

export const alt = "Sensei — split event expenses, settle up fast";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Warm-paper editorial OG card, mirroring the app's design tokens.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f3f2ec",
          color: "#16150f",
          padding: "80px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Sensei
          </div>
          <div style={{ fontSize: 34, color: "#a9791f", fontStyle: "italic" }}>
            split &amp; settle
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: "900px",
            }}
          >
            Split the bill. Settle in the fewest payments.
          </div>
          <div style={{ fontSize: 32, color: "#57554c", maxWidth: "880px" }}>
            Track shared event expenses with friends — Sensei works out exactly who
            pays whom.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            fontSize: 26,
            color: "#8c897e",
          }}
        >
          <span>No accounts</span>
          <span>·</span>
          <span>Share a join code</span>
          <span>·</span>
          <span>Settle up fast</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
