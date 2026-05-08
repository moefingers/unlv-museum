import s from "./Collapsible.module.css";

export function Collapsible({
  open,
  direction = "vertical",
  duration,
  children,
}: {
  open: boolean;
  direction?: "vertical" | "horizontal";
  duration?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${s[direction]} ${open ? s.open : ""}`}
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
