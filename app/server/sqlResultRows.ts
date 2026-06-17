export function sqlResultRows(result: unknown): Array<Record<string, unknown>> {
  const maybeRows = (result as { rows?: Array<Record<string, unknown>> })?.rows;
  if (Array.isArray(maybeRows)) return maybeRows;

  const nestedData = (result as { result?: { data?: Array<Record<string, unknown>> } })?.result?.data;
  if (Array.isArray(nestedData)) return nestedData;

  const payload = result as {
    data_array?: unknown[][];
    schema?: { columns?: Array<{ name?: string }> };
    manifest?: { schema?: { columns?: Array<{ name?: string }> } };
    result?: {
      data_array?: unknown[][];
    };
  };
  const data = payload.data_array ?? payload.result?.data_array;
  const columns = payload.schema?.columns ?? payload.manifest?.schema?.columns ?? [];
  if (!Array.isArray(data) || columns.length === 0) return [];
  return data.map((row) => {
    const out: Record<string, unknown> = {};
    columns.forEach((col, idx) => {
      if (col.name) out[col.name] = row[idx];
    });
    return out;
  });
}
