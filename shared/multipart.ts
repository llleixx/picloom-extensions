import { PluginError, type FileInput } from "@picloom/plugin-sdk";

/** One file plus text fields, streamed without retaining the file contents. */
export async function withMultipart<T>(
  file: FileInput,
  name: string,
  filename: string,
  fields: Record<string, string>,
  signal: AbortSignal,
  send: (body: ReadableStream<Uint8Array>, headers: Headers) => Promise<T>,
): Promise<T> {
  signal.throwIfAborted();
  const size = file.metadata.byteSize;
  if (size === null || !Number.isSafeInteger(size) || size < 0)
    throw new PluginError("INVALID_INPUT", "Upload requires a known file size");
  const boundary = `picloom-${crypto.randomUUID()}`;
  const quote = (value: string) =>
    value.replace(/[\r\n"]/g, (c) =>
      c === '"' ? "%22" : c === "\r" ? "%0D" : "%0A",
    );
  const mime = file.metadata.mimeType ?? "application/octet-stream";
  if (/[\r\n]/.test(mime))
    throw new PluginError("INVALID_INPUT", "Invalid upload content type");
  const encoder = new TextEncoder();
  const head = encoder.encode(
    Object.entries(fields)
      .map(
        ([key, value]) =>
          `--${boundary}\r\nContent-Disposition: form-data; name="${quote(key)}"\r\n\r\n${value}\r\n`,
      )
      .join("") +
      `--${boundary}\r\nContent-Disposition: form-data; name="${quote(name)}"; filename="${quote(filename)}"\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const tail = encoder.encode(`\r\n--${boundary}--\r\n`);
  const reader = (await file.openRead()).getReader();
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  let started = false,
    complete = false,
    length = 0;
  let failure: unknown;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        signal.throwIfAborted();
        if (!started) {
          started = true;
          controller.enqueue(head);
          return;
        }
        const { value, done } = await reader.read();
        signal.throwIfAborted();
        if (done) {
          if (length !== size)
            throw new PluginError(
              "INVALID_DATA",
              "Upload size differs from the declared size",
            );
          controller.enqueue(tail);
          controller.close();
          complete = true;
        } else {
          length += value.byteLength;
          if (length > size)
            throw new PluginError(
              "INVALID_DATA",
              "Upload size differs from the declared size",
            );
          controller.enqueue(value);
        }
      } catch (error) {
        failure = error;
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  try {
    signal.throwIfAborted();
    const result = await send(
      body,
      new Headers({
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": String(head.byteLength + size + tail.byteLength),
      }),
    );
    signal.throwIfAborted();
    if (failure) throw failure;
    if (!complete)
      throw new PluginError(
        "INVALID_DATA",
        "Server accepted an incomplete upload",
      );
    return result;
  } catch (error) {
    throw failure ?? error;
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
