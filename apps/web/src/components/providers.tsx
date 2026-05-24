"use client";

import { SWRConfig } from "swr";
import type { PropsWithChildren } from "react";

export function Providers({ children }: PropsWithChildren) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        shouldRetryOnError: false
      }}
    >
      {children}
    </SWRConfig>
  );
}

