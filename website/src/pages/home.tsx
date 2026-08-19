import { Cta } from '@/components/sections/cta';
import { Faq } from '@/components/sections/faq';
import { Features } from '@/components/sections/features';
import { Hero } from '@/components/sections/hero';
import { Limits } from '@/components/sections/limits';
import { Quickstart } from '@/components/sections/quickstart';
import { SdkShowcase } from '@/components/sections/sdk-showcase';
import { SecurityPreview } from '@/components/sections/security-preview';
import { site } from '@/data/site';
import { usePageMeta } from '@/hooks/use-page-meta';

export default function HomePage() {
  usePageMeta({
    title: 'VPSGUI — run your Linux servers from a browser tab',
    description: site.description,
  });

  return (
    <>
      <Hero />
      <Features />
      <Quickstart />
      <SdkShowcase />
      <Limits />
      <SecurityPreview />
      <Faq />
      <Cta />
    </>
  );
}
