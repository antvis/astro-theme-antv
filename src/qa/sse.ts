export interface ServerSentEvent {
  data: string;
  event?: string;
  id?: string;
}

const DEFAULT_MAX_BUFFER_LENGTH = 1024 * 1024;
const eventBoundaryPattern = /\r?\n\r?\n/;

const parseEvent = (source: string): ServerSentEvent | null => {
  const data: string[] = [];
  let event: string | undefined;
  let id: string | undefined;

  for (const line of source.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    const separator = line.indexOf(':');
    const field = separator === -1 ? line : line.slice(0, separator);
    const rawValue = separator === -1 ? '' : line.slice(separator + 1);
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;
    if (field === 'data') data.push(value);
    else if (field === 'event') event = value;
    else if (field === 'id' && !value.includes('\0')) id = value;
  }

  if (!data.length) return null;
  return { data: data.join('\n'), ...(event ? { event } : {}), ...(id ? { id } : {}) };
};

/** Incrementally decodes LF or CRLF text/event-stream payloads. */
export class ServerSentEventDecoder {
  readonly #maxBufferLength: number;
  #buffer = '';

  constructor(maxBufferLength = DEFAULT_MAX_BUFFER_LENGTH) {
    if (!Number.isSafeInteger(maxBufferLength) || maxBufferLength <= 0) {
      throw new RangeError('SSE maximum buffer length must be a positive integer.');
    }
    this.#maxBufferLength = maxBufferLength;
  }

  push(chunk: string): ServerSentEvent[] {
    this.#buffer += chunk;
    const events: ServerSentEvent[] = [];
    let boundary = this.#buffer.match(eventBoundaryPattern);

    while (boundary?.index !== undefined) {
      const source = this.#buffer.slice(0, boundary.index);
      this.#buffer = this.#buffer.slice(boundary.index + boundary[0].length);
      const event = parseEvent(source);
      if (event) events.push(event);
      boundary = this.#buffer.match(eventBoundaryPattern);
    }

    if (this.#buffer.length > this.#maxBufferLength) {
      this.#buffer = '';
      throw new RangeError('SSE event exceeded the maximum buffered size.');
    }
    return events;
  }

  finish(chunk = ''): ServerSentEvent[] {
    const events = this.push(chunk);
    const event = parseEvent(this.#buffer);
    this.#buffer = '';
    if (event) events.push(event);
    return events;
  }
}
