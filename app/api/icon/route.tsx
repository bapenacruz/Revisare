import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "#0a0a0f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 96,
        }}
      >
        <div
          style={{
            width: 240,
            height: 240,
            background: "#7c3aed",
            borderRadius: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 140, color: "white" }}>R</span>
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
