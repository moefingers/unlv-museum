"use client";

import styles from "./OriginalFrame.module.css";

export function OriginalFrame({ src }: { src: string }) {
  return (
    <iframe
      src={src}
      className={`${styles.frame} ${styles.frameOriginal}`}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      title="Original project"
    />
  );
}

export function ExternalFrame({ src }: { src: string }) {
  return (
    <iframe
      src={src}
      className={styles.frame}
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
    <div className={styles.sourceList}>
      {files.map((file) => (
        <div key={file.name}>
          <h3 className={styles.sourceFileName}>{file.name}</h3>
          <pre className={styles.sourceCodeBlock}>
            <code>{file.content}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}
