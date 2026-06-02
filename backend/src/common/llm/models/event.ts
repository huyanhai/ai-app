import { z } from 'zod';

export const EventSchema = z.object({
  index: z.number().describe('The index of the event, starting from 0'),
  is_last: z.boolean().describe('Indicates if this is the last event in the sequence'),
  description: z.string().describe('A concise description of the event'),
  process_chain: z.array(z.string()).describe('A list of steps or actions that make up the event process chain'),
});

export type Event = z.infer<typeof EventSchema>;

export function formatEvent(event: Event): string {
  return [
    `<Event ${event.index}>`,
    `Description: ${event.description}`,
    `Process Chain:`,
    ...event.process_chain.map(p => `- ${p}`),
  ].join('\n');
}
