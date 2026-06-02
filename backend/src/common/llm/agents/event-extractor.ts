import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { EventSchema, type Event, formatEvent } from '../models';

// ============================================================
// EventExtractor — 事件提取器
// 职责：从小说原文中按顺序提取关键剧情事件（Event）。
// 采用循环调用 LLM 的方式，逐个提取直到最后一个事件。
// ============================================================

// ── Prompts ──

const SYSTEM_PROMPT = `You are a highly skilled Literary Analyst AI. Your expertise is in narrative structure, plot deconstruction, and thematic analysis.

**TASK**
Extract the next event from the provided novel, following the sequence of the story and building upon the partially extracted events.

**INPUT**
1. The full text of the novel enclosed within <NOVEL_TEXT_START> and <NOVEL_TEXT_END> tags.
2. A sequence of already-extracted events (in order) enclosed within <EXTRACTED_EVENTS_START> and <EXTRACTED_EVENTS_END> tags. The sequence may be empty.

**OUTPUT**
{format_instructions}

**GUIDELINES**
1. Focus on events that are critical to the plot, character development, or thematic depth.
2. Ensure the event is logically distinct from previous and subsequent events.
3. If the event spans multiple scenes, unify them under a single dramatic goal.
4. Maintain objectivity: describe events based on the text without interpretation or judgment.
5. For the process field, provide a detailed, step-by-step account of the event's progression.
6. Every detail in your event description must be directly supported by the input novel. Do not add, assume, or invent any information.
7. The language of outputs in values should be same as the input text.`;

const HUMAN_PROMPT = `<NOVEL_TEXT_START>
{novel_text}
<NOVEL_TEXT_END>

<EXTRACTED_EVENTS_START>
{extracted_events}
<EXTRACTED_EVENTS_END>`;

// ── Agent ──

export class EventExtractor {
  constructor(private model: ChatOpenAI) {}

  /**
   * Extract all events from a novel. Continuously calls extractNextEvent until is_last is true.
   */
  async extractEvents(novelText: string): Promise<Event[]> {
    const events: Event[] = [];

    while (events.length === 0 || !events[events.length - 1].is_last) {
      const event = await this.extractNextEvent(novelText, events);
      events.push(event);
    }

    return events;
  }

  async extractNextEvent(novelText: string, extractedEvents: Event[]): Promise<Event> {
    const formatInstructions =
      'Return a JSON object with keys: index (number), is_last (boolean), description (string), process_chain (array of strings).';

    const extractedEventsStr = extractedEvents.map((e) => formatEvent(e)).join('\n\n');

    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM_PROMPT.replace('{format_instructions}', formatInstructions)),
      new HumanMessage(
        HUMAN_PROMPT.replace('{novel_text}', novelText).replace(
          '{extracted_events}',
          extractedEventsStr,
        ),
      ),
    ];

    const modelWithStructure = this.model.withStructuredOutput(EventSchema, {
      name: 'extract_next_event',
      method: 'functionCalling',
    });

    const event = await modelWithStructure.invoke(messages);

    if (event.index !== extractedEvents.length) {
      throw new Error(
        `Extracted event index ${event.index} does not match the expected index ${extractedEvents.length}`,
      );
    }

    return event;
  }
}
