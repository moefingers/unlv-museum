"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { MuseumMark } from "@/components/ui/MuseumMark";
import styles from "./MigrationToast.module.css";

// ─── Migration reassurance toast (transition artifact — built to die) ───────
//
// A visitor who typed the OLD unlv-museum.infinite-syndicate.com address (the
// host the museum used to live on), watched the address bar swap to the new
// host, and landed here can wonder "wrong turn / did I get redirected somewhere
// I didn't mean to go?" This toast's only job is reassurance at that moment.
//
// recanon's off-domain redirect to the museum appends `?from=is`. We read that
// marker once, reassure, then strip it so the canonical URL settles clean. The
// param — NOT document.referrer, which is dropped across the cross-origin 301 —
// is the reliable signal. Deliberately no hardcoded URL in the copy: the param
// is stripped, so the new host already shows in the address bar.
//
// This whole feature is a transition artifact. When old-host referral traffic
// dies (bookmarks/links age out), delete this file, its CSS module, and the
// line that mounts it in (museum)/layout.tsx. Nothing else references it.

const MARKER_PARAM = "from";
const MARKER_VALUE = "is";
const SEEN_KEY = "unlv-museum:migration-notice-seen";

export default function MigrationToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let params: URLSearchParams;
    try {
      params = new URLSearchParams(window.location.search);
    } catch {
      return;
    }
    if (params.get(MARKER_PARAM) !== MARKER_VALUE) return;

    // Strip the marker so the URL never carries a legacy flag and can't leak via
    // a bookmark/share. Done unconditionally (even for a repeat visitor we don't
    // re-greet) so the address bar always settles to the clean new host.
    params.delete(MARKER_PARAM);
    const qs = params.toString();
    const clean =
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    window.history.replaceState(null, "", clean);

    // Show once: a localStorage flag so a returning old-link visitor isn't
    // re-greeted on every landing. Guarded — storage throws in private mode; if
    // it's unavailable we degrade to showing (a repeat beats never reassuring).
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* no storage — fall through and show */
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.root} role="status" aria-live="polite">
      <div className={styles.card}>
        <span className={styles.icon}>
          <MuseumMark size={22} gradientId="migration-toast-mark" />
        </span>
        <div className={styles.body}>
          <p className={styles.title}>We&rsquo;ve moved to a new web address</p>
          <p className={styles.hint}>
            You&rsquo;re in the right place. This is the same site, now at a new
            web address. The old link brought you here automatically. When you
            have a moment, please update your bookmarks.
          </p>
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
