import { CommandLine } from '@/components/command-line';
import { Reveal } from '@/components/reveal';
import { Button } from '@/components/ui/button';
import { installCommand, site } from '@/data/site';

export function Cta() {
  return (
    <section className="hairline px-5 py-24 sm:px-8">
      <Reveal className="mx-auto w-full max-w-5xl">
        <h2 className="max-w-2xl text-[2rem] sm:text-[2.5rem]">
          It runs on the box you <span className="accent-word">already</span> have.
        </h2>

        <p className="mt-5 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground">
          No account, no tier, no telemetry leaving the machine. Clone it, run one script, and close
          the SSH session.
        </p>

        <div className="mt-8 max-w-2xl">
          <CommandLine command={installCommand} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <a href={site.repo} target="_blank" rel="noreferrer noopener">
              Star it on GitHub
            </a>
          </Button>

          <Button asChild variant="outline" size="lg">
            <a href={site.docs.agentInstall} target="_blank" rel="noreferrer noopener">
              Installation guide
            </a>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
