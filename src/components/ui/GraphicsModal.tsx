"use client";

import { useEffect, useState } from "react";
import { Settings, ChevronDown, ChevronUp, Loader2, Wand } from "lucide-react";
import {
  useGraphics,
  type GraphicsPreset,
  type GraphicsSettings,
  type VertexGlowMode,
  type ReducedMotionMode,
} from "@/hooks/use-graphics";
import { Collapsible } from "./Collapsible";
import styles from "./GraphicsModal.module.css";

/*
 * Graphics-settings modal — third sibling in the museum's top-right
 * corner cluster, alongside ThemeToggle and HelpModal. Same morph-
 * from-button-to-card pattern HelpModal uses, same backdrop, same
 * internal-scroll guarantee.
 *
 * Content layout:
 *   1. Title + lede
 *   2. Preset dropdown (low / medium / high; "custom" only appears
 *      when the user has touched the Advanced toggles)
 *   3. "Re-detect" button → runs the runtime perf probe and
 *      surfaces the result before applying
 *   4. Advanced collapsible — individual toggles (edgeGlow,
 *      faceShading, vertexGlows, breathingMesh, backgroundHalo,
 *      reducedMotion). Touching any flips preset to "custom"
 *      automatically (handled by useGraphics.setToggle).
 *   5. Footer with Got-it button
 *
 * Why this is its own modal rather than a section inside HelpModal:
 * Help is "how do I use this," graphics is "how does this look."
 * Different mental models, different frequencies of access, and
 * combining them would crowd the help modal with controls that
 * most visitors will never touch.
 */
export function GraphicsModal({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { settings, setPreset, setToggle, detect } = useGraphics();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Detect-flow state: "idle" → user hasn't clicked detect yet.
  // "running" → probe in progress. "result" → probe finished and
  // we're showing "Detected X — apply?" UI. Resetting to idle
  // happens on apply OR on the next preset/toggle change OR on
  // modal close.
  type DetectState =
    | { kind: "idle" }
    | { kind: "running" }
    | { kind: "result"; preset: "low" | "medium" | "high" };
  const [detectState, setDetectState] = useState<DetectState>({ kind: "idle" });

  // Wrap onClose so we reset detect-state on every close path
  // (Esc, backdrop, Got-it). Doing the reset in a handler avoids a
  // setState-in-effect (which React 19 lint disallows) and keeps
  // the reset deterministic regardless of which path closes the
  // modal.
  const handleClose = () => {
    setDetectState({ kind: "idle" });
    onClose();
  };

  // ESC closes when open. Bound only while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // handleClose is stable enough for our purposes — it captures
    // onClose which is a stable callback from the parent. Re-binding
    // on every render is harmless; React 19's exhaustive-deps lint
    // is satisfied by listing `open` only because we WANT the
    // listener to mount/unmount as open toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runDetect = async () => {
    setDetectState({ kind: "running" });
    const result = await detect();
    setDetectState({ kind: "result", preset: result });
  };

  const applyDetected = () => {
    if (detectState.kind === "result") {
      setPreset(detectState.preset);
      setDetectState({ kind: "idle" });
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.backdrop}
        data-open={open}
        aria-hidden="true"
        tabIndex={-1}
        onClick={handleClose}
      />

      <div
        className={styles.morph}
        data-open={open}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-labelledby={open ? "graphics-modal-title" : undefined}
        // Stop wheel events from reaching the globe's wheel-zoom
        // handler underneath while the modal is open. Same defense
        // HelpModal applies — see CONTEXT/internal_docs/social-
        // unfurls if anyone ever wonders, no wait, see HelpModal's
        // own onWheel comment.
        onWheel={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.iconButton}
          onClick={open ? handleClose : onOpen}
          aria-label={
            open ? "Close graphics settings" : "Show graphics settings"
          }
        >
          <Settings size={16} />
        </button>

        <div className={styles.content} aria-hidden={!open}>
          <h1 id="graphics-modal-title" className={styles.title}>
            Graphics
          </h1>
          <p className={styles.lede}>
            Tune the visual fidelity of the museum globe. Higher tiers look
            richer but require more rendering work; lower tiers stay smooth on
            modest hardware.
          </p>

          <div className={styles.presetRow}>
            <label htmlFor="graphics-preset" className={styles.fieldLabel}>
              Quality
            </label>
            <select
              id="graphics-preset"
              className={styles.presetSelect}
              value={settings.preset}
              onChange={(e) => setPreset(e.target.value as GraphicsPreset)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              {/*
                "Custom" is only selectable as a passive display when
                the user has already touched the Advanced toggles.
                Picking it from the dropdown doesn't make sense
                (custom isn't a target preset; it's the absence of
                one). When preset === "custom" the option appears so
                the select shows the user's actual state, but it's
                disabled so they can't re-select it.
              */}
              {settings.preset === "custom" && (
                <option value="custom" disabled>
                  Custom
                </option>
              )}
            </select>
          </div>

          {/*
            Detect: runs the runtime perf probe and shows the
            recommended preset before applying. Three UI states:
            idle (button), running (spinner), result (caption +
            apply button).
          */}
          <div className={styles.detectRow}>
            {detectState.kind === "idle" && (
              <button
                type="button"
                className={styles.detectButton}
                onClick={runDetect}
              >
                <Wand size={14} />
                Auto-detect
              </button>
            )}
            {detectState.kind === "running" && (
              <span className={styles.detectStatus}>
                <Loader2 size={14} className={styles.spinner} />
                Measuring…
              </span>
            )}
            {detectState.kind === "result" && (
              <span className={styles.detectStatus}>
                Detected: <strong>{detectState.preset}</strong>
                <button
                  type="button"
                  className={styles.detectApply}
                  onClick={applyDetected}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className={styles.detectDismiss}
                  onClick={() => setDetectState({ kind: "idle" })}
                  aria-label="Dismiss detection result"
                >
                  ×
                </button>
              </span>
            )}
          </div>

          {/* Advanced — individual toggles. Collapsed by default. */}
          <button
            type="button"
            className={styles.advancedToggle}
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
            aria-controls="graphics-advanced"
          >
            {advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Advanced
          </button>

          <Collapsible open={advancedOpen}>
            <div id="graphics-advanced" className={styles.advanced}>
              <BoolField
                label="Edge glow"
                hint="Soft halo around each face stroke. Heavy on fillrate."
                value={settings.edgeGlow}
                onChange={(v) => setToggle("edgeGlow", v)}
              />
              <BoolField
                label="Face shading"
                hint="Front-facing brightness gradient on sphere faces."
                value={settings.faceShading}
                onChange={(v) => setToggle("faceShading", v)}
              />
              <SelectField<VertexGlowMode>
                label="Vertex glows"
                hint='"All" lights every dot; "engaged-only" lights only the active one.'
                value={settings.vertexGlows}
                options={[
                  { value: "all", label: "All" },
                  { value: "engaged-only", label: "Engaged only" },
                  { value: "off", label: "Off" },
                ]}
                onChange={(v) => setToggle("vertexGlows", v)}
              />
              <BoolField
                label="Breathing mesh"
                hint="Background lattice of slow-drifting dots."
                value={settings.breathingMesh}
                onChange={(v) => setToggle("breathingMesh", v)}
              />
              <BoolField
                label="Background halo"
                hint="Radial gradient behind the sphere."
                value={settings.backgroundHalo}
                onChange={(v) => setToggle("backgroundHalo", v)}
              />
              <SelectField<ReducedMotionMode>
                label="Reduced motion"
                hint='"Auto" follows your OS preference.'
                value={settings.reducedMotion}
                options={[
                  { value: "auto", label: "Auto (OS)" },
                  { value: "force-on", label: "Force on" },
                  { value: "force-off", label: "Force off" },
                ]}
                onChange={(v) => setToggle("reducedMotion", v)}
              />
            </div>
          </Collapsible>

          <div className={styles.footerRow}>
            <button
              type="button"
              className={styles.gotIt}
              onClick={handleClose}
              tabIndex={open ? 0 : -1}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function BoolField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={styles.field}>
      <div className={styles.fieldHead}>
        <span className={styles.fieldLabelText}>{label}</span>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className={styles.checkbox}
        />
      </div>
      <p className={styles.fieldHint}>{hint}</p>
    </label>
  );
}

function SelectField<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className={styles.field}>
      <div className={styles.fieldHead}>
        <span className={styles.fieldLabelText}>{label}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className={styles.fieldSelect}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <p className={styles.fieldHint}>{hint}</p>
    </label>
  );
}

// Note: Re-exports for consumer convenience.
export type { GraphicsSettings };
