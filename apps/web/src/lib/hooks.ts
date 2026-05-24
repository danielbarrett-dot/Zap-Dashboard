"use client";

import useSWR from "swr";

import { apiFetcher } from "./api";
import type { AuthUser } from "@/types";

export const useCurrentUser = () => {
  const swr = useSWR<{ user: AuthUser }>("/auth/me", apiFetcher, {
    revalidateOnFocus: true
  });

  return {
    ...swr,
    user: swr.data?.user || null
  };
};
