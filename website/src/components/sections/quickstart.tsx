import { CommandLine } from '@/components/command-line';
import { Reveal } from '@/components/reveal';
import { Section, SectionHeading } from '@/components/section';
import { quickstartSteps } from '@/data/quickstart';

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

      <ol className="mt-12 space-y-5">
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
