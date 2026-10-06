import { QueryClient } from '@tanstack/react-query';

/** One client for the whole app, so sign-out and expired sessions can wipe every cached answer. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: (failureCount, error: unknown) => {
        // Do not retry 4xx problem details errors (validation, not found, forbidden)
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});
