import { Reveal } from '@/components/reveal';
import { Section, SectionHeading } from '@/components/section';
import { features } from '@/data/features';

/**
 * A two-column definition list, not a card grid. Nine identical bordered cards
 * each with its own colour is the most recognisable shape a generated landing
 * page takes; hairlines and typography carry this instead.
 */
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

      <div className="mt-14 grid gap-x-12 sm:grid-cols-2">
        {features.map((feature, i) => {
          const Icon = feature.icon;

          return (
            <Reveal key={feature.id} delay={(i % 2) * 0.05}>
              <div className="hairline py-6">
                <div className="flex items-center gap-2.5">
                  <Icon aria-hidden className="size-4 text-subtle" />
                  <h3 className="text-[0.9375rem]">{feature.title}</h3>
                </div>

                <p className="mt-2.5 text-[0.875rem] leading-relaxed text-muted-foreground text-pretty">
                  {feature.description}
                </p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
