import { AlertTriangle } from 'lucide-react';

import { CommandLine } from '@/components/command-line';
import { Reveal } from '@/components/reveal';
import { Section, SectionHeading } from '@/components/section';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { installTargets, quickstartSteps } from '@/data/quickstart';

export function Quickstart() {
  return (
    <Section id="install">
      <SectionHeading
        index="02"
        label="Install"
        title={
          <>
            Four steps, and the third one is the <span className="accent-word">important</span> one.
          </>
        }
        lede="The deploy script builds the frontend, publishes it, supervises the agent with pm2 and writes the nginx vhost. Run it again on an existing install and it keeps your token and file roots rather than regenerating them."
      />

      <Reveal className="clay mt-12 rounded-2xl p-6 sm:p-8">
        <h3 className="text-[1.0625rem]">Pick your target</h3>
        <p className="mt-2 max-w-xl text-[0.875rem] leading-relaxed text-muted-foreground text-pretty">
          The deploy script is written for the Debian family. On anything else it still builds and
          installs, but two of its assumptions do not hold and you finish those by hand.
        </p>

        <Tabs defaultValue={installTargets[0].id} className="mt-6">
          <TabsList>
            {installTargets.map((target) => (
              <TabsTrigger key={target.id} value={target.id} className="text-xs">
                {target.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {installTargets.map((target) => (
            <TabsContent key={target.id} value={target.id} className="mt-5 space-y-3">
              {/* Say it on the tab that is not fully supported rather than only in the note
                  underneath, which is the part people skip. */}
              {!target.supported ? (
                <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-600 dark:text-amber-500">
                  <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
                  <span>Not a one-command install. Two manual steps are required.</span>
                </p>
              ) : null}

              {target.commands.map((command) => (
                <CommandLine key={command} command={command} />
              ))}

              <p className="max-w-xl text-xs leading-relaxed text-subtle">{target.note}</p>
            </TabsContent>
          ))}
        </Tabs>
      </Reveal>

      <ol className="mt-5 space-y-5">
        {quickstartSteps.map((step, i) => (
          <li key={step.n}>
            <Reveal
              delay={i * 0.04}
              className="clay grid gap-5 rounded-2xl p-6 sm:grid-cols-[auto_1fr] sm:gap-7 sm:p-8"
            >
              <span
                aria-hidden
                className="clay-inset flex size-11 shrink-0 items-center justify-center rounded-full font-mono text-sm text-primary tabular"
              >
                {String(step.n).padStart(2, '0')}
              </span>

              <div className="min-w-0 space-y-4">
                <div className="space-y-2">
                  <h3 className="text-[1.0625rem]">{step.title}</h3>
                  <p className="max-w-xl text-[0.875rem] leading-relaxed text-muted-foreground text-pretty">
                    {step.body}
                  </p>
                </div>

                {step.command ? <CommandLine command={step.command} /> : null}

                {step.note ? (
                  <p className="max-w-xl text-xs leading-relaxed text-subtle">{step.note}</p>
                ) : null}
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  );
}
