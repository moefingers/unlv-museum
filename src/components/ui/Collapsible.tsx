import s from "./Collapsible.module.css";

export function Collapsible({
  open,
  duration,
  children,
}: {
  open: boolean;
  duration?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${s.vertical} ${open ? s.open : ""}`}
      style={
        duration
          ? ({
              "--collapsible-duration": `${duration}ms`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div
        className={s.inner}
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        {children}
      </div>
    </div>
  );
}
