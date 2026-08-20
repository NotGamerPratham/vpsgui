import { CodeBlock } from '@/components/code-block';
import { CopyButton } from '@/components/copy-button';
import { Reveal } from '@/components/reveal';
import { Section, SectionHeading } from '@/components/section';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { sdkSamples } from '@/data/sdk';

export function SdkShowcase() {
  return (
    <Section id="sdks">
      <SectionHeading
        index="03"
        label="Automate it"
        title={
          <>
            The console is just a <span className="accent-word">client</span>. So is anything you
            write.
          </>
        }
        lede="There is no private channel between the UI and the agent - the browser calls the same 46 endpoints you can. SDKs are published for Node and Python, and curl is a perfectly good third option."
      />

      <Reveal className="mt-12">
        <Tabs defaultValue={sdkSamples[0].id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              {sdkSamples.map((sample) => (
                <TabsTrigger key={sample.id} value={sample.id} className="font-mono text-xs">
                  {sample.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {sdkSamples.map((sample) => (
              <TabsContent key={sample.id} value={sample.id} className="flex-none">
                <div className="flex items-center gap-1">
                  <CopyButton value={sample.install} label={sample.install} variant="ghost" />
                  <a
                    href={sample.registryUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-md px-2 py-1 text-xs text-subtle underline underline-offset-4 transition-colors hover:text-foreground"
                  >
                    {sample.id === 'curl' ? 'API docs' : 'registry'}
                  </a>
                </div>
              </TabsContent>
            ))}
          </div>

          {sdkSamples.map((sample) => (
            <TabsContent key={sample.id} value={sample.id} className="mt-4">
              <CodeBlock code={sample.code} language={sample.language} />
            </TabsContent>
          ))}
        </Tabs>
      </Reveal>

      <Reveal delay={0.06} className="mt-5">
        <p className="max-w-2xl text-xs leading-relaxed text-subtle">
          Each sample reads the token from the environment. It grants root-equivalent control of the
          host, so it belongs in a secret store - not in a committed file, an image layer or a
          frontend bundle.
        </p>
      </Reveal>
    </Section>
  );
}
