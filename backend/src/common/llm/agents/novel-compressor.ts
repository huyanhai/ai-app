import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';

// ============================================================
// NovelCompressor — 小说压缩器
// 职责：将长篇小说分段压缩，再合并为连贯的精简版本。
// 当小说超出 LLM 上下文窗口时使用，保留核心情节和关键对话。
// ============================================================

// ── Prompts ──

const SYSTEM_COMPRESS = `You are an expert text compression assistant specialized in literary content. Your goal is to condense novels or story excerpts while preserving core narrative elements, key details, character development, and plot coherence.

**TASK**
Compress the provided input text to reduce its length significantly, eliminating redundancies, overly descriptive passages, and minor details—but without losing essential story arcs, dialogue, or emotional impact.

**INPUT**
A segment of a novel (possibly truncated due to context length constraints). It is enclosed within <NOVEL_CHUNK_START> and <NOVEL_CHUNK_END> tags.

**OUTPUT**
A compressed version of the input text, retaining the core narrative, critical events, and character interactions.

**GUIDELINES**
1. Fidelity to the Plot: Preserve all major plot points, twists, revelations, and the sequence of key events.
2. Character Consistency: Maintain character actions, decisions, and development.
3. Streamline Description: Reduce lengthy descriptions to their most essential elements.
4. Condense Internal Monologue: Paraphrase extended internal thoughts, focusing on key realizations or decisions.
5. Simplify Language: Use more direct and concise language.
6. Cohesion and Flow: Ensure the compressed text is smooth, readable, and maintains logical narrative flow.
7. Discard any non-narrative text.
8. Produce a seamless paragraph without markers or section breaks.
9. The language of output should be consistent with the original text.`;

const HUMAN_COMPRESS = `<NOVEL_CHUNK_START>
{novel_chunk}
<NOVEL_CHUNK_END>`;

const SYSTEM_AGGREGATE = `You are a professional text processing assistant specializing in the aggregation and refinement of segmented text chunks.

**TASK**
Aggregate the provided text chunks into a coherent and continuous short story. Carefully identify and resolve overlaps where the end of one chunk and the beginning of the next chunk contain semantically similar content but with different expressions. Remove redundant repetitions while preserving the original meaning, style, and flow.

**INPUT**
A sequence of text chunks (ordered from first to last), where each chunk may have an overlapping segment with the next chunk. Each chunk is enclosed within <CHUNK_N_START> and <CHUNK_N_END> tags.

**OUTPUT**
A single, consolidated text of the short story without unnatural repetitions or disruptions.

**GUIDELINES**
1. Analyze the input chunks sequentially. For each adjacent pair, compare the end and beginning to detect overlapping content.
2. Merge overlapping segments by retaining the most natural version.
3. Preserve all non-overlapping text exactly as it appears.
4. Ensure the merged text is fluent and coherent.
5. Do not invent new content or alter the original narrative beyond handling the overlaps.
6. The language of output should be consistent with the original text.`;

const HUMAN_AGGREGATE = `{chunks}`;

// ── Agent ──

export interface CompressedChunk {
  index: number;
  content: string;
}

export class NovelCompressor {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(
    private model: ChatOpenAI,
    options?: { chunkSize?: number; chunkOverlap?: number },
  ) {
    this.chunkSize = options?.chunkSize ?? 65536;
    this.chunkOverlap = options?.chunkOverlap ?? 8192;
  }

  /**
   * Simple text splitter that splits text into chunks of approximately chunkSize characters.
   * Note: For production use, consider using a more sophisticated text splitter.
   */
  split(novelText: string): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < novelText.length) {
      const end = Math.min(start + this.chunkSize, novelText.length);
      chunks.push(novelText.slice(start, end));
      start = end - this.chunkOverlap;
    }
    return chunks;
  }

  async compressChunk(index: number, novelChunk: string): Promise<CompressedChunk> {
    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM_COMPRESS),
      new HumanMessage(HUMAN_COMPRESS.replace('{novel_chunk}', novelChunk)),
    ];

    const response = await this.model.invoke(messages);
    return { index, content: response.content as string };
  }

  async compress(
    indexChunkPairs: Array<{ index: number; content: string }>,
    maxConcurrency: number = 5,
  ): Promise<CompressedChunk[]> {
    const results: CompressedChunk[] = [];

    // Process with limited concurrency
    for (let i = 0; i < indexChunkPairs.length; i += maxConcurrency) {
      const batch = indexChunkPairs.slice(i, i + maxConcurrency);
      const batchResults = await Promise.all(
        batch.map((pair) => this.compressChunk(pair.index, pair.content)),
      );
      results.push(...batchResults);
    }

    // Sort by index and return
    results.sort((a, b) => a.index - b.index);
    return results;
  }

  async aggregate(compressedChunks: CompressedChunk[]): Promise<string> {
    // Sort by index
    const sorted = [...compressedChunks].sort((a, b) => a.index - b.index);

    const chunksStr = sorted
      .map((chunk) => `<CHUNK_${chunk.index}_START>\n${chunk.content}\n<CHUNK_${chunk.index}_END>`)
      .join('\n');

    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM_AGGREGATE),
      new HumanMessage(HUMAN_AGGREGATE.replace('{chunks}', chunksStr)),
    ];

    const response = await this.model.invoke(messages);
    return response.content as string;
  }
}
