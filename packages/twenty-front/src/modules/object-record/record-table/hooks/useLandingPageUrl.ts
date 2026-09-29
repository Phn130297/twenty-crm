import { useCallback } from 'react';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';

export const useLandingPageUrl = () => {
  const client = useApolloCoreClient();

  const getUrl = useCallback(
    async (recordId: string): Promise<string | null> => {
      try {
        const cached = client.readQuery({
          query: `query Lp($id: ID!) { landingPage(id: $id) { lpPublishedUrl } }`,
          variables: { id: recordId },
        });
        return (cached as Record<string, { lpPublishedUrl?: string }> | undefined)
          ?.landingPage?.lpPublishedUrl ?? null;
      } catch {
        return null;
      }
    },
    [client],
  );

  return { getUrl };
};
