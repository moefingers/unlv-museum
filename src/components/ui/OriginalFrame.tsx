"use client";

export function OriginalFrame({ src }: { src: string }) {
  return (
    <iframe
      src={src}
      className="h-[80vh] w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-popups"
      title="Original project"
    />
  );
}

export function ExternalFrame({ src }: { src: string }) {
  return (
    <iframe
      src={src}
      className="h-[80vh] w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      title="Original project (external)"
    />
  );
}

export function SourceCodeView({
  files,
}: {
  files: { name: string; content: string }[];
}) {
  return (
    <div className="space-y-6 p-6">
      {files.map((file) => (
        <div key={file.name}>
          <h3 className="mb-2 font-mono text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {file.name}
          </h3>
          <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
            <code>{file.content}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}
