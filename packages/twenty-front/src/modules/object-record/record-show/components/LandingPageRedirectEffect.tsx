import { useEffect } from 'react';

import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { useGenerateDepthRecordGqlFieldsFromObject } from '@/object-record/graphql/record-gql-fields/hooks/useGenerateDepthRecordGqlFieldsFromObject';

export const LandingPageRedirectEffect = ({
  objectNameSingular,
  objectRecordId,
}: {
  objectNameSingular: string;
  objectRecordId: string;
}) => {
  const { recordGqlFields: depthOneFields } =
    useGenerateDepthRecordGqlFieldsFromObject({
      objectNameSingular,
      depth: 1,
    });

  const { record, loading } = useFindOneRecord({
    objectNameSingular,
    objectRecordId,
    recordGqlFields: depthOneFields,
  });

  useEffect(() => {
    if (loading || objectNameSingular !== 'landingPage') return;

    const url = (record as Record<string, string | undefined> | undefined)
      ?.lpPublishedUrl;

    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [loading, objectNameSingular, record]);

  return null;
};
