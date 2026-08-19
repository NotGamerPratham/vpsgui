import { Reveal } from '@/components/reveal';
import { Section, SectionHeading } from '@/components/section';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { faqs } from '@/data/faq';
import { site } from '@/data/site';

export function Faq() {
  return (
    <Section id="faq">
      <SectionHeading index="06" label="Questions" title="Asked often enough to write down." />

      <Reveal className="mt-10 max-w-3xl">
        <Accordion type="single" collapsible>
          {faqs.map((faq) => (
            <AccordionItem key={faq.id} value={faq.id}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="mt-8 text-sm text-subtle">
          Something missing?{' '}
          <a
            href={site.issues}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Open an issue
          </a>{' '}
          and the answer ends up here.
        </p>
      </Reveal>
    </Section>
  );
}
