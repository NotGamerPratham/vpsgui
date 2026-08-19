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

      <dl className="mt-12 max-w-3xl">
        {limits.map((limit, i) => (
          <Reveal key={limit.claim} delay={i * 0.04}>
            <div className="hairline grid gap-2 py-6 sm:grid-cols-[15rem_1fr] sm:gap-8">
              <dt className="text-[0.9375rem] text-foreground">{limit.claim}</dt>
              <dd className="text-[0.875rem] leading-relaxed text-muted-foreground text-pretty">
                {limit.detail}
              </dd>
            </div>
          </Reveal>
        ))}
      </dl>
    </Section>
  );
}
