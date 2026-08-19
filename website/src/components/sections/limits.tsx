import { Reveal } from '@/components/reveal';
import { Section, SectionHeading } from '@/components/section';
import { limits } from '@/data/limits';

export function Limits() {
  return (
    <Section id="limits">
      <SectionHeading
        index="04"
        label="What it is not"
        title={
          <>
            The parts a landing page usually <span className="accent-word">leaves out</span>.
          </>
        }
        lede="Worth knowing before you install rather than after."
      />

      <Reveal className="mt-12">
        <dl className="clay divide-y divide-border/70 overflow-hidden rounded-2xl">
          {limits.map((limit) => (
            <div
              key={limit.claim}
              className="grid gap-2 p-6 sm:grid-cols-[16rem_1fr] sm:gap-8 sm:p-7"
            >
              <dt className="text-[0.9375rem]">{limit.claim}</dt>
              <dd className="text-[0.875rem] leading-relaxed text-muted-foreground text-pretty">
                {limit.detail}
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </Section>
  );
}
