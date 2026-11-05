"use client";

import {
  createDOMRenderer,
  FluentProvider,
  RendererProvider,
  renderToStyleElements,
  SSRProvider,
  Toaster,
  webLightTheme,
} from "@fluentui/react-components";
import { useServerInsertedHTML } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

export const TOASTER_ID = "app-toaster";

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
        <FluentProvider theme={webLightTheme} style={{ height: "100%", background: "transparent" }}>
          {children}
          <Toaster toasterId={TOASTER_ID} position="top-end" />
        </FluentProvider>
      </SSRProvider>
    </RendererProvider>
  );
}
