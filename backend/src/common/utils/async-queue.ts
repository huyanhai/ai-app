/** A queue that bridges push-based and async-iterator-based consumption. */
export class AsyncQueue<T> {
  private queue: T[] = [];
  private resolvers: ((value: IteratorResult<T>) => void)[] = [];
  private done = false;

  /** Push a value into the queue. No-op after close. */
  push(value: T) {
    if (this.done) return;

    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve({ value, done: false });
    } else {
      this.queue.push(value);
    }
  }

  /** Close the queue, resolving all pending consumers. */
  close() {
    this.done = true;
    for (const resolve of this.resolvers.splice(0)) {
      resolve({ value: undefined, done: true } as IteratorResult<T>);
    }
  }

  /**
   * Consume the queue as an async generator.
   * Yields values until the queue is closed and drained.
   */
  async *generator(): AsyncGenerator<T> {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift()!;
      } else if (this.done) {
        return;
      } else {
        const nextValue = await new Promise<IteratorResult<T>>((resolve) => {
          this.resolvers.push(resolve);
        });
        if (nextValue.done) return;
        yield nextValue.value;
      }
    }
  }
}
