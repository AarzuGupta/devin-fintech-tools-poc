"use client";

import {
  createDOMRenderer,
  FluentProvider,
  RendererProvider,
  renderToStyleElements,
  SSRProvider,
  Toaster,
  webLightTheme,
  type Theme,
} from "@fluentui/react-components";
import { useServerInsertedHTML } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

export const TOASTER_ID = "app-toaster";

const BRAND = "#0066cc";
const BRAND_HOVER = "#0058b3";
const BRAND_PRESSED = "#004a99";

/** Fluent tokens aligned with the app's neutral, system-font visual language (see globals.css). */
const appTheme: Theme = {
  ...webLightTheme,
  fontFamilyBase: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSizeBase300: "13px",
  borderRadiusSmall: "4px",
  borderRadiusMedium: "8px",
  borderRadiusLarge: "10px",
  borderRadiusXLarge: "12px",
  colorBrandBackground: BRAND,
  colorBrandBackgroundHover: BRAND_HOVER,
  colorBrandBackgroundPressed: BRAND_PRESSED,
  colorBrandBackgroundSelected: BRAND_HOVER,
  colorCompoundBrandBackground: BRAND,
  colorCompoundBrandBackgroundHover: BRAND_HOVER,
  colorCompoundBrandBackgroundPressed: BRAND_PRESSED,
  colorCompoundBrandStroke: BRAND,
  colorCompoundBrandStrokeHover: BRAND_HOVER,
  colorCompoundBrandStrokePressed: BRAND_PRESSED,
  colorBrandForeground1: BRAND,
  colorBrandForegroundLink: BRAND,
  colorBrandStroke1: BRAND,
  colorStrokeFocus2: BRAND,
  colorNeutralForeground1: "#1d1d1f",
  colorNeutralForeground2: "#3a3a3c",
  colorNeutralForeground3: "#6e6e73",
  colorNeutralStroke1: "#d2d2d7",
  colorNeutralStroke1Hover: "#b8b8bf",
  colorNeutralStroke1Pressed: "#a1a1a8",
  colorNeutralStroke2: "#e5e5ea",
  colorNeutralStrokeAccessible: "#8e8e93",
  colorNeutralBackground1Hover: "#f5f5f7",
  colorSubtleBackgroundHover: "rgba(0, 0, 0, 0.05)",
  colorSubtleBackgroundPressed: "rgba(0, 0, 0, 0.08)",
  shadow16: "0 8px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)",
  shadow64: "0 24px 56px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.04)",
};

/** Fluent UI v9 + Griffel SSR wiring for the Next.js App Router. */
export function Providers({ children }: { children: ReactNode }) {
  const [renderer] = useState(() => createDOMRenderer());
  const didInsert = useRef(false);

  useServerInsertedHTML(() => {
    if (didInsert.current) return null;
    didInsert.current = true;
    return <>{renderToStyleElements(renderer)}</>;
  });

  return (
    <RendererProvider renderer={renderer}>
      <SSRProvider>
        <FluentProvider theme={appTheme} style={{ height: "100%", background: "transparent" }}>
          {children}
          <Toaster toasterId={TOASTER_ID} position="top-end" />
        </FluentProvider>
      </SSRProvider>
    </RendererProvider>
  );
}
