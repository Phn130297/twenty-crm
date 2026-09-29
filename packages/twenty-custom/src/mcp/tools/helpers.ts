export type CallResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

export function ok(data: unknown): CallResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function err(message: string): CallResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}
