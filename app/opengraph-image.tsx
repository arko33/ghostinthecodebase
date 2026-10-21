import { ImageResponse } from "next/og";

export const alt =
  "GhostInTheCodebase — See what the AI builds. Know when it breaks it.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const bars = [46, 74, 58, 96, 64, 122, 88, 142, 76, 108, 62, 134, 92, 54, 118];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(145deg, #05060A 0%, #0B0D14 58%, #11141D 100%)",
          color: "#EDEFF5",
          padding: "64px 72px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: "-120px",
            top: "-160px",
            width: "560px",
            height: "560px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(139,124,255,0.30) 0%, rgba(103,232,249,0.06) 48%, transparent 70%)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "10px",
            position: "absolute",
            left: "72px",
            right: "72px",
            bottom: "42px",
            height: "180px",
            opacity: 0.22,
          }}
        >
          {bars.map((height, index) => (
            <div
              key={index}
              style={{
                flex: 1,
                height: `${height}px`,
                background:
                  index === 5
                    ? "linear-gradient(180deg, #FF7A6B, rgba(255,122,107,0.05))"
                    : "linear-gradient(180deg, #8B7CFF, rgba(103,232,249,0.06))",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              width: 34,
              height: 34,
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 9,
              fontSize: 18,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: "#8B7CFF",
              }}
            />
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: "#67E8F9",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              fontSize: 20,
              letterSpacing: "-0.02em",
            }}
          >
            <span>Ghost</span>
            <span style={{ color: "#9AA3B8" }}>in the codebase</span>
          </div>
          <div
            style={{
              marginLeft: "auto",
              fontSize: 12,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#9AA3B8",
            }}
          >
            Built for TestSprite Season 4
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 78,
              lineHeight: 0.96,
              letterSpacing: "-0.045em",
              display: "flex",
              flexDirection: "column",
              fontFamily: "Georgia, serif",
            }}
          >
            <span>See what the AI builds.</span>
            <span>
              Know when it{" "}
              <span
                style={{
                  color: "#B6A8FF",
                  fontStyle: "italic",
                }}
              >
                breaks it.
              </span>
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              fontSize: 16,
              color: "#9AA3B8",
            }}
          >
            <span>Shadow commits</span>
            <span style={{ color: "#8B7CFF" }}>·</span>
            <span>Turn-level attribution</span>
            <span style={{ color: "#8B7CFF" }}>·</span>
            <span>One-click rollback</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
