import { Reveal } from '@/components/reveal';
import { Section, SectionHeading } from '@/components/section';
import { features } from '@/data/features';

export function Features() {
  return (
    <Section id="features">
      <SectionHeading
        index="01"
        label="What it does"
        title={
          <>
            Nine surfaces, and an <span className="accent-word">empty state</span> wherever the box
            has no answer.
          </>
        }
        lede="Every panel is one call to the agent running on your host. When the agent cannot determine a value it returns null and the UI shows nothing, because a confident wrong number about a production machine is worse than a blank."
      />

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, i) => {
          const Icon = feature.icon;

          return (
            <Reveal key={feature.id} delay={(i % 3) * 0.05}>
              <article className="clay clay-press h-full rounded-2xl p-6">
                <span className="clay-inset mb-4 flex size-11 items-center justify-center rounded-full text-primary">
                  <Icon aria-hidden className="size-5" />
                </span>

                <h3 className="text-[0.9375rem]">{feature.title}</h3>

                <p className="mt-2.5 text-[0.875rem] leading-relaxed text-muted-foreground text-pretty">
                  {feature.description}
                </p>
              </article>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
