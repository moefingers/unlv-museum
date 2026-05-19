"use client";

import styles from "./ServerAppOriginal.module.css";

interface ServerAppOriginalProps {
  title: string;
  tech: string;
  description: string;
  note: string;
}

export function ServerAppOriginal({
  title,
  tech,
  description,
  note,
}: ServerAppOriginalProps) {
  return (
    <div className={styles.shell}>
      <div className={`card ${styles.serverAppCard}`}>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className={`text-sm ${styles.tech}`}>{tech}</p>
        <p className={`text-sm ${styles.description}`}>{description}</p>
        <div className={`text-sm ${styles.note}`}>{note}</div>
      </div>
    </div>
  );
}
