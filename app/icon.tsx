import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0A0A0B",
          width: 32,
          height: 32,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Vinyl record circle */}
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#D4A843",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 0 3px #1a1a1c, 0 0 0 5px #D4A843",
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#0A0A0B",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
