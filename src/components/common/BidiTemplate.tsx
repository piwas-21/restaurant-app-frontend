'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface BidiTemplateProps {
  translationKey: string;
  placeholder: string;
  value: string;
}

/** Keep tenant-authored names isolated inside translated sentence templates, including Arabic. */
export default function BidiTemplate({ translationKey, placeholder, value }: Readonly<BidiTemplateProps>) {
  const { t } = useTranslation();
  const marker = `\uE000${placeholder}\uE001`;
  const template = t(translationKey, { [placeholder]: marker });
  const [before, after] = template.split(marker, 2);
  if (after === undefined) return template;

  const content: ReactNode = (
    <>
      {before}
      <bdi dir="auto">{value}</bdi>
      {after}
    </>
  );
  return content;
}
