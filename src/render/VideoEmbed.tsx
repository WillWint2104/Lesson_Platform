/**
 * @file VideoEmbed.tsx — framed YouTube stage for a lesson video.
 *
 * The studio video sits in a bold-framed near-black 16:9 panel (CLAUDE.md §d).
 * Privacy-friendly nocookie embed, lazy-loaded, no API keys or tracking extras.
 * `src` null is a first-class "not recorded yet" state → coming-soon panel
 * (honest state, NOT the error chip). An unparseable src should be impossible at
 * runtime (the validator rejects it) but renders a role="alert" chip if it slips
 * through — defence in depth.
 */
import { parseYouTubeId } from "@/shared/youtube";

export function VideoEmbed({ src, title }: { src: string | null; title: string }) {
  if (src === null) {
    return (
      <div className="video-stage">
        <div className="video-stage__overlay">
          <span className="video-stage__badge">Video</span>
          <p className="video-stage__note">Video coming soon.</p>
        </div>
      </div>
    );
  }

  const id = parseYouTubeId(src);
  if (id === null) {
    // Unreachable for validated content; defensive only.
    return (
      <div className="qr-error" role="alert">
        Unplayable video source: <code>{src}</code>
      </div>
    );
  }

  return (
    <div className="video-stage">
      <iframe
        className="video-stage__iframe"
        src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
