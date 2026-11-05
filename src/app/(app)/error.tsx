"use client";

import { Button, MessageBar, MessageBarBody, MessageBarTitle } from "@fluentui/react-components";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="m-6 max-w-xl space-y-3">
      <MessageBar intent="error">
        <MessageBarBody>
          <MessageBarTitle>Something went wrong</MessageBarTitle>
          The page could not be loaded. Try again, or refresh the browser.
        </MessageBarBody>
      </MessageBar>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
