import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Cartesian3, type Viewer } from "cesium";
import {
  fitCameraToAirports,
  type CameraFitAirport,
} from "@/features/map/cesium-config";

interface MapControlsProps {
  viewer: Viewer | null;
  onHome: () => void;
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="h-px bg-slate-600/80" role="separator" />;
}

export function MapControls({ viewer, onHome }: MapControlsProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const zoomBy = useCallback(
    (factor: number) => {
      if (!viewer) return;
      const height = Math.max(viewer.camera.positionCartographic.height, 100);
      const amount = Math.max(height * Math.abs(factor - 1), 100);
      if (factor < 1) {
        viewer.camera.zoomIn(amount);
      } else {
        viewer.camera.zoomOut(amount);
      }
    },
    [viewer],
  );

  const toggleFullscreen = useCallback(() => {
    if (!viewer) return;
    const element = viewer.container.closest(".relative") ?? viewer.container;

    if (!document.fullscreenElement) {
      void element.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  }, [viewer]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHelpOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [helpOpen]);

  const disabled = !viewer;

  return (
    <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
      <div
        className="overflow-hidden rounded-lg border border-slate-600/80 bg-slate-900/90 shadow-lg backdrop-blur-sm"
        role="group"
        aria-label="Map navigation"
      >
        <ControlButton label="Zoom in" onClick={() => zoomBy(0.5)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </ControlButton>
        <Divider />
        <ControlButton label="Zoom out" onClick={() => zoomBy(1.5)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </ControlButton>
        <Divider />
        <ControlButton label="Reset view" onClick={onHome}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 2.5 3 6.5v7h3.5V10H9.5v3.5H13v-7L8 2.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </ControlButton>
        <Divider />
        <ControlButton
          label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          onClick={toggleFullscreen}
        >
          {isFullscreen ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </ControlButton>
        <Divider />
        <ControlButton label="Navigation help" onClick={() => setHelpOpen((open) => !open)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M8 7.25V11M8 5.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
              fill="currentColor"
            />
          </svg>
        </ControlButton>
      </div>

      {helpOpen ? (
        <div
          className="w-56 rounded-lg border border-slate-600/80 bg-slate-900/95 p-3 text-xs text-slate-300 shadow-lg backdrop-blur-sm"
          role="dialog"
          aria-label="Navigation help"
        >
          <p className="mb-2 font-medium text-white">Camera controls</p>
          <ul className="space-y-1.5 leading-relaxed">
            <li>
              <span className="text-slate-400">Drag</span> — pan
            </li>
            <li>
              <span className="text-slate-400">Scroll</span> — zoom
            </li>
            <li>
              <span className="text-slate-400">Right-drag</span> — tilt &amp; rotate (globe)
            </li>
            <li>
              <span className="text-slate-400">Middle-drag</span> — tilt (globe)
            </li>
            <li>
              <span className="text-slate-400">Ctrl + drag</span> — look around
            </li>
          </ul>
        </div>
      ) : null}

      {disabled ? (
        <span className="sr-only">Map controls loading</span>
      ) : null}
    </div>
  );
}

export function flyHomeView(viewer: Viewer, airports: CameraFitAirport[]): void {
  if (airports.length > 0) {
    fitCameraToAirports(viewer, airports, "home");
    return;
  }

  void viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(0, 20, 20_000_000),
    duration: 1,
  });
}
