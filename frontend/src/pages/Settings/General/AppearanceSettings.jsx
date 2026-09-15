import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";

import {
  ArrowLeft,
  Leaf,
  Palette,
  LayoutDashboard,
  Check,
  RotateCcw,
  Type,
} from "lucide-react";

const APPEARANCE_KEY = "wellness-appearance-settings";

/* =========================================================
   DEFAULT SETTINGS
========================================================= */

const DEFAULT_SETTINGS = {
  background: "garden",
  solidColor: "#F5F5F5",

  accentMode: "default",
  accentColor: "#7FAE62",

  layout: "comfortable",

  fontStyle: "default",
};

/* =========================================================
   FONT OPTIONS
========================================================= */

const FONT_OPTIONS = [
  {
    id: "nunito",
    name: "Nunito",
    description: "Friendly and soft",
  },
  {
    id: "fredoka",
    name: "Fredoka",
    description: "Playful and rounded",
  },
  {
    id: "jakarta",
    name: "Plus Jakarta Sans",
    description: "Clean and modern",
  },
  {
    id: "kalam",
    name: "Kalam",
    description: "Handwritten and cozy",
  },
  {
    id: "poppins",
    name: "Poppins",
    description: "Smooth and geometric",
  },
  {
    id: "quicksand",
    name: "Quicksand",
    description: "Soft and friendly",
  },
  {
    id: "dm-sans",
    name: "DM Sans",
    description: "Minimal and professional",
  },
  {
    id: "manrope",
    name: "Manrope",
    description: "Modern and polished",
  },
  {
    id: "inter",
    name: "Inter",
    description: "Clear and highly readable",
  },
];

/* =========================================================
   LAYOUT OPTIONS
========================================================= */

const LAYOUTS = [
  {
    id: "comfortable",
    name: "Comfortable",
    description: "More breathing room between sections",
  },
  {
    id: "compact",
    name: "Compact",
    description: "A tighter layout with less spacing",
  },
];

/* =========================================================
   LOAD SETTINGS
========================================================= */

function loadSettings() {
  try {
    const saved = localStorage.getItem(APPEARANCE_KEY);

    if (!saved) {
      return { ...DEFAULT_SETTINGS };
    }

    const parsed = JSON.parse(saved);

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch (error) {
    console.warn(
      "Could not load appearance settings.",
      error
    );

    return { ...DEFAULT_SETTINGS };
  }
}

/* =========================================================
   COLOR HELPERS
========================================================= */

function hexToRgb(hex) {
  const clean = String(hex || "")
    .replace("#", "")
    .trim();

  if (clean.length !== 6) {
    return {
      r: 127,
      g: 174,
      b: 98,
    };
  }

  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((value) =>
        Math.max(
          0,
          Math.min(255, Math.round(value))
        )
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

function lightenColor(hex, amount = 30) {
  const { r, g, b } = hexToRgb(hex);

  return rgbToHex(
    r + (255 - r) * (amount / 100),
    g + (255 - g) * (amount / 100),
    b + (255 - b) * (amount / 100)
  );
}

function darkenColor(hex, amount = 20) {
  const { r, g, b } = hexToRgb(hex);

  return rgbToHex(
    r * (1 - amount / 100),
    g * (1 - amount / 100),
    b * (1 - amount / 100)
  );
}

/* =========================================================
   BACKGROUND STYLE
========================================================= */

function getBackgroundStyle(settings) {
  if (settings.background === "solid") {
    return {
      backgroundColor:
        settings.solidColor || "#F5F5F5",
      backgroundImage: "none",
    };
  }

  return {
    backgroundColor: "#EAF3E2",
    backgroundImage: "none",
  };
}

/* =========================================================
   FONT SETTINGS
========================================================= */

function getFontFamily(fontStyle) {
  switch (fontStyle) {
    case "nunito":
      return '"Nunito", sans-serif';

    case "fredoka":
      return '"Fredoka", sans-serif';

    case "jakarta":
      return '"Plus Jakarta Sans", sans-serif';

    case "kalam":
      return '"Kalam", cursive';

    case "poppins":
      return '"Poppins", sans-serif';

    case "quicksand":
      return '"Quicksand", sans-serif';

    case "dm-sans":
      return '"DM Sans", sans-serif';

    case "manrope":
      return '"Manrope", sans-serif';

    case "inter":
      return '"Inter", sans-serif';

    default:
      return "";
  }
}

/* =========================================================
   APPLY APPEARANCE
========================================================= */

function applyAppearance(settings) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const body = document.body;
  const appRoot = document.getElementById("root");

  const background = getBackgroundStyle(settings);

  const backgroundMode =
    settings.background === "solid"
      ? "solid"
      : "garden";

  const layout =
    settings.layout === "compact"
      ? "compact"
      : "comfortable";

  const fontStyle =
    settings.fontStyle || "default";

  root.dataset.background = backgroundMode;
  root.dataset.layout = layout;
  root.dataset.fontStyle = fontStyle;

  root.dataset.accent =
    settings.accentMode === "custom"
      ? "custom"
      : "default";

  root.style.setProperty(
    "--appearance-bg",
    background.backgroundColor
  );

  root.style.setProperty(
    "--appearance-tint",
    backgroundMode === "garden"
      ? "#DCE8D0"
      : lightenColor(
          settings.solidColor || "#F5F5F5",
          10
        )
  );

  root.style.setProperty(
    "--appearance-decoration",
    background.backgroundImage
  );

  const selectedFont = getFontFamily(fontStyle);

  if (selectedFont) {
    root.style.setProperty(
      "--appearance-font-family",
      selectedFont
    );
  } else {
    root.style.removeProperty(
      "--appearance-font-family"
    );
  }

  body.style.setProperty(
    "background-color",
    background.backgroundColor,
    "important"
  );

  body.style.setProperty(
    "background-image",
    background.backgroundImage,
    "important"
  );

  body.style.setProperty(
    "background-attachment",
    "fixed",
    "important"
  );

  body.style.setProperty(
    "background-repeat",
    "no-repeat",
    "important"
  );

  body.style.setProperty(
    "background-size",
    "cover",
    "important"
  );

  if (appRoot) {
    appRoot.style.setProperty(
      "background",
      "transparent",
      "important"
    );

    appRoot.style.setProperty(
      "background-color",
      "transparent",
      "important"
    );
  }

  document
    .querySelectorAll(".leaf-bg")
    .forEach((element) => {
      element.style.setProperty(
        "background",
        "transparent",
        "important"
      );

      element.style.setProperty(
        "background-color",
        "transparent",
        "important"
      );
    });

  /* =======================================================
     ACCENT COLORS
  ======================================================= */

  if (settings.accentMode === "custom") {
    const accent =
      settings.accentColor ||
      DEFAULT_SETTINGS.accentColor;

    root.style.setProperty(
      "--cozy-primary",
      accent
    );

    root.style.setProperty(
      "--cozy-primary-dark",
      darkenColor(accent, 20)
    );

    root.style.setProperty(
      "--cozy-secondary",
      lightenColor(accent, 35)
    );

    root.style.setProperty(
      "--cozy-accent",
      lightenColor(accent, 15)
    );

    root.style.setProperty(
      "--cozy-border",
      `${accent}55`
    );
  } else {
    root.style.setProperty(
      "--cozy-primary",
      "#7FAE62"
    );

    root.style.setProperty(
      "--cozy-primary-dark",
      "#5B8A44"
    );

    /*
      Keep the default secondary tone soft and neutral.
      This avoids the pink appearance in dark mode.
    */
    root.style.setProperty(
      "--cozy-secondary",
      "#DCE8D0"
    );

    root.style.setProperty(
      "--cozy-accent",
      "#B8D99D"
    );

    root.style.setProperty(
      "--cozy-border",
      "#D8E2CF"
    );
  }
}

/* =========================================================
   COMPONENT
========================================================= */

export default function AppearanceSettings() {
  const navigate = useNavigate();

  const [settings, setSettings] =
    useState(loadSettings);

  /* Backend is the source of truth */
  const loadedFromBackend = useRef(false);

  useEffect(() => {
    api
      .get("/settings")
      .then(({ data }) => {
        const appearance = data?.appearance;

        loadedFromBackend.current = true;

        if (!appearance) {
          return;
        }

        setSettings((previous) => ({
          ...previous,
          background:
            appearance.background ??
            previous.background,

          solidColor:
            appearance.solid_color ??
            previous.solidColor,

          accentMode:
            appearance.accent_mode ??
            previous.accentMode,

          accentColor:
            appearance.accent_color ??
            previous.accentColor,

          layout:
            appearance.layout ??
            previous.layout,

          fontStyle:
            appearance.font_style ??
            previous.fontStyle,
        }));
      })
      .catch(() => {
        loadedFromBackend.current = true;
      });
  }, []);

  useEffect(() => {
    applyAppearance(settings);

    try {
      localStorage.setItem(
        APPEARANCE_KEY,
        JSON.stringify(settings)
      );
    } catch (error) {
      console.warn(
        "Could not save appearance settings.",
        error
      );
    }

    window.dispatchEvent(
      new CustomEvent(
        "appearanceSettingsUpdated",
        {
          detail: settings,
        }
      )
    );

    if (loadedFromBackend.current) {
      api
        .put("/settings", {
          appearance: {
            background: settings.background,
            solid_color: settings.solidColor,
            accent_mode: settings.accentMode,
            accent_color: settings.accentColor,
            layout: settings.layout,
            font_style: settings.fontStyle,
          },
        })
        .catch(() => {});
    }
  }, [settings]);

  /* =======================================================
     BACKGROUND
  ======================================================= */

  const selectDefaultBackground = () => {
    setSettings((previous) => ({
      ...previous,
      background: "garden",
    }));
  };

  const selectCustomBackground = () => {
    setSettings((previous) => ({
      ...previous,
      background: "solid",
    }));
  };

  const changeSolidColor = (event) => {
    setSettings((previous) => ({
      ...previous,
      background: "solid",
      solidColor: event.target.value,
    }));
  };

  /* =======================================================
     ACCENT
  ======================================================= */

  const selectDefaultAccent = () => {
    setSettings((previous) => ({
      ...previous,
      accentMode: "default",
      accentColor:
        DEFAULT_SETTINGS.accentColor,
    }));
  };

  const selectCustomAccent = () => {
    setSettings((previous) => ({
      ...previous,
      accentMode: "custom",
    }));
  };

  const changeAccent = (event) => {
    setSettings((previous) => ({
      ...previous,
      accentMode: "custom",
      accentColor: event.target.value,
    }));
  };

  /* =======================================================
     LAYOUT
  ======================================================= */

  const selectLayout = (layout) => {
    setSettings((previous) => ({
      ...previous,
      layout,
    }));
  };

  /* =======================================================
     FONT
  ======================================================= */

  const selectFontStyle = (event) => {
    setSettings((previous) => ({
      ...previous,
      fontStyle: event.target.value,
    }));
  };

  const selectDefaultFont = () => {
    setSettings((previous) => ({
      ...previous,
      fontStyle: "default",
    }));
  };

  /* =======================================================
     RESET
  ======================================================= */

  const resetAppearance = () => {
    setSettings({
      ...DEFAULT_SETTINGS,
    });
  };

  const selectedFont =
    FONT_OPTIONS.find(
      (font) =>
        font.id === settings.fontStyle
    );

  const previewFont =
    getFontFamily(settings.fontStyle) ||
    '"Nunito", sans-serif';

  /* =======================================================
     ICON STYLE
     High contrast in both light and dark mode.
  ======================================================= */

  const sectionIconStyle = {
    width: "38px",
    height: "38px",
    borderRadius: "12px",
    display: "grid",
    placeItems: "center",
    background: "var(--cozy-primary)",
    color: "#ffffff",
    flexShrink: 0,
  };

  return (
    <div
      style={{
        maxWidth: "760px",
        margin: "0 auto",
        padding: "8px 0 30px",
        fontFamily: previewFont,
        color: "var(--cozy-text)",
        transition: "font-family 0.2s ease",
      }}
    >
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          marginBottom: "28px",
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/settings")}
          aria-label="Back to Settings"
          title="Back to Settings"
          style={{
            width: "42px",
            height: "42px",
            flexShrink: 0,
            borderRadius: "13px",
            border:
              "1px solid var(--cozy-border)",
            background:
              "var(--cozy-surface)",
            color: "var(--cozy-text)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            transition:
              "transform 0.2s ease, background 0.2s ease",
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.transform =
              "translateX(-2px)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.transform =
              "translateX(0)";
          }}
        >
          <ArrowLeft size={20} />
        </button>

        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: 800,
              color: "var(--cozy-text)",
            }}
          >
            Appearance
          </h2>

          <p
            style={{
              marginTop: "6px",
              marginBottom: 0,
              color: "var(--cozy-muted)",
              fontSize: "14px",
            }}
          >
            Personalize how your MyWellness
            space feels.
          </p>
        </div>
      </div>

      {/* =====================================================
          BACKGROUND
      ===================================================== */}

      <section
        style={{
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "14px",
          }}
        >
          <div style={sectionIconStyle}>
            <Leaf
              size={19}
              strokeWidth={2.5}
            />
          </div>

          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "17px",
                fontWeight: 800,
                color: "var(--cozy-text)",
              }}
            >
              Background
            </h3>

            <p
              style={{
                margin: "2px 0 0",
                fontSize: "12px",
                color: "var(--cozy-muted)",
              }}
            >
              Choose your wellness background
              color.
            </p>
          </div>
        </div>

        {/* DEFAULT BACKGROUND */}

        <button
          type="button"
          onClick={selectDefaultBackground}
          style={{
            width: "100%",
            position: "relative",
            textAlign: "left",
            padding: "18px",
            borderRadius: "16px",
            border:
              settings.background === "garden"
                ? "2px solid var(--cozy-primary)"
                : "1px solid var(--cozy-border)",
            background:
              "var(--cozy-surface)",
            cursor: "pointer",
            transition:
              "transform 0.2s ease, box-shadow 0.2s ease",
            boxShadow:
              settings.background === "garden"
                ? "0 6px 18px rgba(0,0,0,0.06)"
                : "none",
          }}
        >
          {settings.background === "garden" && (
            <div
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background:
                  "var(--cozy-primary)",
                color: "white",
              }}
            >
              <Check size={14} />
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "58px",
                height: "58px",
                flexShrink: 0,
                borderRadius: "15px",
                background: "#EAF3E2",
                border:
                  "2px solid rgba(127,174,98,0.25)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#DCE8D0",
                  top: "7px",
                  left: "7px",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#B8D99D",
                  bottom: "7px",
                  right: "7px",
                }}
              />
            </div>

            <div
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 800,
                  color: "var(--cozy-text)",
                }}
              >
                MyWellness Default
              </div>

              <div
                style={{
                  marginTop: "4px",
                  fontSize: "12px",
                  lineHeight: 1.45,
                  color: "var(--cozy-muted)",
                  maxWidth: "480px",
                }}
              >
                Soft green wellness palette with
                subtle leaf, cloud, and sparkle
                decorations.
              </div>
            </div>
          </div>
        </button>

        {/* CUSTOM BACKGROUND */}

        <div
          style={{
            marginTop: "12px",
            position: "relative",
            borderRadius: "16px",
            border:
              settings.background === "solid"
                ? "2px solid var(--cozy-primary)"
                : "1px solid var(--cozy-border)",
            background:
              "var(--cozy-surface)",
            padding: "14px 16px",
          }}
        >
          {settings.background === "solid" && (
            <div
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background:
                  "var(--cozy-primary)",
                color: "white",
                zIndex: 2,
              }}
            >
              <Check size={14} />
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <label
              style={{
                position: "relative",
                width: "58px",
                height: "58px",
                flexShrink: 0,
                borderRadius: "15px",
                overflow: "hidden",
                border:
                  "2px solid rgba(0,0,0,0.10)",
                cursor: "pointer",
                background:
                  settings.solidColor,
              }}
              title="Choose custom background color"
            >
              <input
                type="color"
                value={settings.solidColor}
                onChange={changeSolidColor}
                aria-label="Choose custom background color"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  cursor: "pointer",
                }}
              />
            </label>

            <div
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                }}
              >
                <Palette
                  size={16}
                  color="var(--cozy-primary)"
                  strokeWidth={2.5}
                />

                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 800,
                    color: "var(--cozy-text)",
                  }}
                >
                  Custom Color
                </div>
              </div>

              <div
                style={{
                  marginTop: "3px",
                  fontSize: "12px",
                  color: "var(--cozy-muted)",
                }}
              >
                Choose any solid color for your
                background.
              </div>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "13px",
                  fontWeight: 800,
                  color:
                    "var(--cozy-primary-dark)",
                }}
              >
                {settings.solidColor.toUpperCase()}
              </div>
            </div>

            <button
              type="button"
              onClick={selectCustomBackground}
              style={{
                flexShrink: 0,
                padding: "8px 12px",
                borderRadius: "10px",
                border:
                  settings.background === "solid"
                    ? "2px solid var(--cozy-primary)"
                    : "1px solid var(--cozy-border)",
                background:
                  settings.background === "solid"
                    ? "var(--cozy-secondary)"
                    : "var(--cozy-surface)",
                color: "var(--cozy-text)",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              {settings.background === "solid"
                ? "Selected"
                : "Use Color"}
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================
          ACCENT COLOR
      ===================================================== */}

      <section
        style={{
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "14px",
          }}
        >
          <div style={sectionIconStyle}>
            <Palette
              size={19}
              strokeWidth={2.5}
            />
          </div>

          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "17px",
                fontWeight: 800,
                color: "var(--cozy-text)",
              }}
            >
              Accent Color
            </h3>

            <p
              style={{
                margin: "2px 0 0",
                fontSize: "12px",
                color: "var(--cozy-muted)",
              }}
            >
              Choose your own wellness color.
            </p>
          </div>
        </div>

        {/* DEFAULT ACCENT */}

        <button
          type="button"
          onClick={selectDefaultAccent}
          style={{
            width: "100%",
            position: "relative",
            textAlign: "left",
            padding: "16px",
            borderRadius: "16px",
            border:
              settings.accentMode === "default"
                ? "2px solid var(--cozy-primary)"
                : "1px solid var(--cozy-border)",
            background:
              "var(--cozy-surface)",
            cursor: "pointer",
            marginBottom: "12px",
          }}
        >
          {settings.accentMode === "default" && (
            <div
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background:
                  "var(--cozy-primary)",
                color: "white",
              }}
            >
              <Check size={14} />
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "14px",
                background: "#7FAE62",
                flexShrink: 0,
              }}
            />

            <div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "var(--cozy-text)",
                }}
              >
                MyWellness Default
              </div>

              <div
                style={{
                  marginTop: "3px",
                  fontSize: "12px",
                  color: "var(--cozy-muted)",
                }}
              >
                Original Wellness Garden green
              </div>
            </div>
          </div>
        </button>

        {/* CUSTOM ACCENT */}

        <div
          style={{
            position: "relative",
            border:
              settings.accentMode === "custom"
                ? "2px solid var(--cozy-primary)"
                : "1px solid var(--cozy-border)",
            borderRadius: "16px",
            padding: "18px",
            background:
              "var(--cozy-surface)",
          }}
        >
          {settings.accentMode === "custom" && (
            <div
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background:
                  "var(--cozy-primary)",
                color: "white",
              }}
            >
              <Check size={14} />
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <input
              type="color"
              value={settings.accentColor}
              onChange={changeAccent}
              aria-label="Choose custom accent color"
              style={{
                width: "58px",
                height: "58px",
                padding: "4px",
                borderRadius: "14px",
                border:
                  "1px solid var(--cozy-border)",
                background: "white",
                cursor: "pointer",
              }}
            />

            <div
              style={{
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color:
                    "var(--cozy-muted)",
                  marginBottom: "3px",
                }}
              >
                Custom color
              </div>

              <div
                style={{
                  fontSize: "20px",
                  fontWeight: 800,
                  color: "var(--cozy-text)",
                }}
              >
                {settings.accentColor.toUpperCase()}
              </div>
            </div>

            <button
              type="button"
              onClick={selectCustomAccent}
              style={{
                padding: "9px 13px",
                borderRadius: "10px",
                border:
                  settings.accentMode === "custom"
                    ? "2px solid var(--cozy-primary)"
                    : "1px solid var(--cozy-border)",
                background:
                  settings.accentMode === "custom"
                    ? "var(--cozy-secondary)"
                    : "var(--cozy-surface)",
                color: "var(--cozy-text)",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              {settings.accentMode === "custom"
                ? "Selected"
                : "Use Color"}
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================
          LAYOUT
      ===================================================== */}

      <section
        style={{
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "14px",
          }}
        >
          <div style={sectionIconStyle}>
            <LayoutDashboard
              size={19}
              strokeWidth={2.5}
            />
          </div>

          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "17px",
                fontWeight: 800,
                color: "var(--cozy-text)",
              }}
            >
              Layout
            </h3>

            <p
              style={{
                margin: "2px 0 0",
                fontSize: "12px",
                color: "var(--cozy-muted)",
              }}
            >
              Adjust the spacing of your
              dashboard.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "12px",
          }}
        >
          {LAYOUTS.map((item) => {
            const selected =
              settings.layout === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  selectLayout(item.id)
                }
                style={{
                  position: "relative",
                  textAlign: "left",
                  padding: "16px",
                  borderRadius: "16px",
                  border: selected
                    ? "2px solid var(--cozy-primary)"
                    : "1px solid var(--cozy-border)",
                  background:
                    "var(--cozy-surface)",
                  cursor: "pointer",
                  transition:
                    "transform 0.2s ease, box-shadow 0.2s ease",
                  boxShadow: selected
                    ? "0 6px 18px rgba(0,0,0,0.06)"
                    : "none",
                }}
              >
                {selected && (
                  <div
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background:
                        "var(--cozy-primary)",
                      color: "white",
                    }}
                  >
                    <Check size={14} />
                  </div>
                )}

                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "15px",
                    color: "var(--cozy-text)",
                  }}
                >
                  {item.name}
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "12px",
                    lineHeight: 1.45,
                    color: "var(--cozy-muted)",
                  }}
                >
                  {item.description}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* =====================================================
          FONT STYLE
      ===================================================== */}

      <section
        style={{
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "14px",
          }}
        >
          <div style={sectionIconStyle}>
            <Type
              size={19}
              strokeWidth={2.5}
            />
          </div>

          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "17px",
                fontWeight: 800,
                color: "var(--cozy-text)",
              }}
            >
              Font Style
            </h3>

            <p
              style={{
                margin: "2px 0 0",
                fontSize: "12px",
                color: "var(--cozy-muted)",
              }}
            >
              Choose the typography used across
              Wellness Garden.
            </p>
          </div>
        </div>

        {/* DEFAULT FONT */}

        <button
          type="button"
          onClick={selectDefaultFont}
          style={{
            width: "100%",
            position: "relative",
            textAlign: "left",
            padding: "16px",
            borderRadius: "16px",
            border:
              settings.fontStyle === "default"
                ? "2px solid var(--cozy-primary)"
                : "1px solid var(--cozy-border)",
            background:
              "var(--cozy-surface)",
            cursor: "pointer",
            marginBottom: "12px",
          }}
        >
          {settings.fontStyle === "default" && (
            <div
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background:
                  "var(--cozy-primary)",
                color: "white",
              }}
            >
              <Check size={14} />
            </div>
          )}

          <div
            style={{
              fontSize: "17px",
              fontWeight: 800,
              color: "var(--cozy-text)",
            }}
          >
            Default
          </div>

          <div
            style={{
              marginTop: "4px",
              fontSize: "12px",
              color: "var(--cozy-muted)",
            }}
          >
            Keep the current mixed fonts used
            throughout the app.
          </div>
        </button>

        {/* CUSTOM FONT */}

        <div
          style={{
            position: "relative",
            border:
              settings.fontStyle !== "default"
                ? "2px solid var(--cozy-primary)"
                : "1px solid var(--cozy-border)",
            borderRadius: "16px",
            padding: "16px",
            background:
              "var(--cozy-surface)",
          }}
        >
          {settings.fontStyle !== "default" && (
            <div
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background:
                  "var(--cozy-primary)",
                color: "white",
                pointerEvents: "none",
              }}
            >
              <Check size={14} />
            </div>
          )}

          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--cozy-muted)",
              marginBottom: "8px",
            }}
          >
            Custom Font
          </div>

          <select
            value={
              settings.fontStyle === "default"
                ? ""
                : settings.fontStyle
            }
            onChange={selectFontStyle}
            aria-label="Choose custom font"
            style={{
              width: "100%",
              padding: "12px 14px",
              paddingRight: "42px",
              borderRadius: "12px",
              border:
                "1px solid var(--cozy-border)",
              background:
                "var(--cozy-surface)",
              color: "var(--cozy-text)",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: previewFont,
            }}
          >
            <option value="" disabled>
              Select a font
            </option>

            {FONT_OPTIONS.map((font) => (
              <option
                key={font.id}
                value={font.id}
              >
                {font.name} — {font.description}
              </option>
            ))}
          </select>

          {selectedFont && (
            <div
              style={{
                marginTop: "10px",
                padding: "10px 12px",
                borderRadius: "10px",
                background:
                  "var(--cozy-secondary)",
                color: "var(--cozy-text)",
                fontSize: "13px",
                fontWeight: 700,
                fontFamily: previewFont,
              }}
            >
              Selected: {selectedFont.name}
            </div>
          )}
        </div>
      </section>

      {/* =====================================================
          RESET
      ===================================================== */}

      <div
        style={{
          marginTop: "28px",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={resetAppearance}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            padding: "9px 14px",
            borderRadius: "10px",
            border:
              "1px solid var(--cozy-border)",
            background:
              "var(--cozy-surface)",
            color: "var(--cozy-text)",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "12px",
          }}
        >
          <RotateCcw size={14} />
          Reset Appearance
        </button>
      </div>
    </div>
  );
}