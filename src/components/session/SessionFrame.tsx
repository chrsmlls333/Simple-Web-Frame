import React, { useEffect, useState, useRef } from "react";
import {
  DEFAULT_IFRAME_URL,
  type Config,
  type SessionId,
} from "../../lib/sessionStore";
import { actions } from "astro:actions";
import { cn, getReadableUUID } from "../../lib/styles";
import { useMouseActivity } from "../useMouseActivity";

interface SessionFrameProps {
  sessionId: SessionId;
  config: Config;
}

// Status options with corresponding text and class name
const connectionStatusOptions = {
  active: {
    text: "Active",
    className: "font-semibold text-green-600",
    pulse: false,
  },
  pulse: {
    text: "Active",
    className: "font-semibold text-green-600",
    pulse: true,
  },
  error: {
    text: "Error",
    className: "font-semibold text-red-600",
    pulse: false,
  },
} as const;

const iframeStatusOptions = ["loading", "loaded", "error"] as const;

const SessionFrame: React.FC<SessionFrameProps> = ({
  sessionId,
  config: initialConfig,
}) => {
  const [config, setConfig] = useState(initialConfig);
  const [connectionStatus, setConnectionStatus] =
    useState<keyof typeof connectionStatusOptions>("active");
  const [iframeStatus, setIframeStatus] =
    useState<(typeof iframeStatusOptions)[number]>("loading");
  const contentFrameRef = useRef<HTMLIFrameElement>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  const { isActive: isMouseMoving } = useMouseActivity();

  const urlIsDefault = config.iframeUrl === DEFAULT_IFRAME_URL;
  const id = getReadableUUID(sessionId);

  useEffect(() => {
    const sendHeartbeat = async () => {
      setConnectionStatus("pulse");

      try {
        const data = await actions.heartbeat.orThrow({ sessionId });
        compareConfigToDOM(data.session);
        setTimeout(() => setConnectionStatus("active"), 1000);
      } catch (e) {
        console.error("Error sending heartbeat:", e);
        setConnectionStatus("error");
      }
    };

    const markInactive = async () => {
      try {
        await actions.markInactive.orThrow({ sessionId });
      } catch (e) {
        console.error("Failed to mark session as inactive:", e);
      }
    };

    const compareConfigToDOM = (newConfig: Config) => {
      if (newConfig.iframeUrl !== config.iframeUrl) {
        setIframeStatus("loading");
        setConfig(newConfig);
        console.log("[Client] Updated iframe URL to:", newConfig.iframeUrl);
      } else {
        console.log("[Client] No changes detected");
      }
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Set up heartbeat interval
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 15000);

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup function
    return () => {
      if (heartbeatIntervalRef.current)
        clearInterval(heartbeatIntervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      markInactive();
    };
  }, [sessionId, config.iframeUrl]);

  return (
    <div className="flex flex-col w-full h-screen relative ">
      
      {urlIsDefault && (
        <div
          id="new-modal"
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-20"
        >
          <div className="bg-white/30 rounded-lg shadow-lg space-y-2 text-center">
            <div className="bg-white/90 px-6 pt-4 pb-4 rounded-lg shadow-lg space-y-2 text-center">
              {/* <h2 className="text-xl font-bold">New Session</h2> */}
              <h3 className=" text-9xl font-bold tracking-widest font-mono">
                {id}
              </h3>
            </div>
            <p className="text-white opacity-70 m-4">
              This session is ready to use. Go to the{" "}
              <a
                href={`/admin#session-${sessionId}`}
                target="_blank"
                className="underline"
              >
                Session Manager
              </a>{" "}
              to configure.
            </p>
          </div>
        </div>
      )}
      <div id="iframe-container" className="flex-grow relative">
        <iframe
          id="content-frame"
          ref={contentFrameRef}
          src={config.iframeUrl}
          allow="clipboard-read;clipboard-write;geolocation;camera;microphone;midi;usb;serial;xr-spatial-tracking;web-share;ambient-light-sensor;window-management"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-presentation allow-downloads allow-popups allow-popups-to-escape-sandbox"
          allowFullScreen={true}
          className={cn([
            "absolute top-0 left-0 w-full h-full border-none transition-opacity",
            iframeStatus === "loading" && "opacity-0",
          ])}
          onLoad={() => setIframeStatus("loaded")}
          onError={() => setIframeStatus("error")}
        ></iframe>
      </div>
      <div
        id="session-info-bar"
        className={cn([
          "p-2 bg-gray-100 border-t border-gray-300 flex justify-between opacity-100 absolute bottom-[1px] w-full z-10 transition-opacity duration-300",
          iframeStatus === "loaded" && !isMouseMoving && "opacity-0",
        ])}
      >
        <p>
          Session ID:{" "}
          <span
            id="session-id"
            className="text-lg tracking-wider font-bold font-mono"
          >
            {id}
          </span>
        </p>
        <p>
          Status:{" "}
          <span
            id="active-status"
            className={`${
              connectionStatusOptions[connectionStatus].className
            } ${
              connectionStatusOptions[connectionStatus].pulse
                ? "animate-pulse"
                : ""
            }`}
          >
            {connectionStatusOptions[connectionStatus].text}
          </span>
        </p>
        <style>{`
        @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
        }
        
        .animate-pulse {
        animation: pulse 1s ease-in-out;
        }
      `}</style>
      </div>
      {!isMouseMoving && (
        // TODO: Cursor hiding doesn't work over iframe, this does not resolve the issue
        <div className="fixed inset-0 opacity-0 z-50 cursor-none"></div>
      )}
    </div>
  );
};

export default SessionFrame;
