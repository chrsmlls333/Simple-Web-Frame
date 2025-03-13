import React, { useState, useEffect } from "react";
import type { SessionData, SessionId } from "../../lib/sessionStore";
import { actions } from "astro:actions";
import { cn, formatTimestamp, getReadableUUID } from "../../lib/styles";

interface SessionCardProps {
  id: SessionId;
  session: SessionData;
  urlOptions: string[];
  onSubmitUrl: (url: string) => void;
  onDelete: () => void;
}

const SessionCard: React.FC<SessionCardProps> = ({
  id,
  session,
  urlOptions,
  onSubmitUrl,
  onDelete,
}) => {
  const [isActive, setIsActive] = useState(session.isActive);
  const [lastActiveAt, setLastActiveAt] = useState(
    formatTimestamp(session.lastActiveAt)
  );
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    onSubmitUrl(formData.get("iframeUrl") as string); // field is required
    try {
      await actions.updateSessionForm.orThrow(formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 1000);
    } catch (e: any) {
      setError(`Failed to update session: ${e?.message}`);
    }
  };

  // check if the session is active every 15 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data, error } = await actions.checkActive({ sessionId: id });
      if (error) {
        setError("Failed to check session status");
        return;
      }
      setIsActive(data.isActive);
      setLastActiveAt(formatTimestamp(data.lastActiveAt));
    }, 15000);
    return () => clearInterval(interval);
  }, [id]);

  return (
    <div
      id={`session-${id}`}
      className={cn([
        "p-4 rounded-lg shadow-md mb-4 border-l-4 transition-colors bg-gray-200 border-gray-500",
        isActive && " border-green-500 bg-white",
        success && "border-green-500 bg-green-100",
        error && "border-red-500 bg-red-100",
      ])}
    >
      <div className="flex justify-between items-center mb-3">
        <div className="flex flex-row items-center gap-2">
          <div className="flex items-center p-1 rounded-lg border border-gray-300">
            <h3 className="text-2xl font-mono font-bold tracking-widest leading-none in-target:animate-bounce">
              {getReadableUUID(id)}
            </h3>
          </div>
          <div className="flex items-center">
            <span
              className={cn([
                "inline-block w-3 h-3 rounded-full mr-2",
                isActive ? "bg-green-500" : "bg-gray-500",
              ])}
            ></span>
            <span
              className={cn([
                "text-sm",
                isActive ? "text-green-600" : "text-gray-600",
              ])}
            >
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        <div className="text-right text-sm text-gray-400">
          {/* <div>Last Active:</div> */}
          <div>{lastActiveAt}</div>
        </div>
      </div>

      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}

      <form id={`form-update-${id}`} className="space-y-4" onSubmit={onSubmit}>
        <input type="hidden" name="sessionId" value={id} />
        <div className="form-group">
          <label
            htmlFor={`iframeUrl-${id}`}
            className="block mb-1 text-sm font-medium"
          >
            iframe URL:
          </label>
          <input
            type="url"
            id={`iframeUrl-${id}`}
            name="iframeUrl"
            className="w-full p-2 border rounded mb-2"
            defaultValue={session.iframeUrl}
            required
            list={`urlOptions-${id}`}
          />
          <datalist id={`urlOptions-${id}`}>
            {urlOptions.map((url, index) => (
              <option key={index} value={url} />
            ))}
          </datalist>
        </div>
        <div className="flex space-x-2">
          <button
            type="submit"
            className="bg-green-600 text-white py-2 px-4 text-sm rounded hover:bg-green-700"
          >
            Update
          </button>
          <button
            type="button"
            className="bg-blue-600 text-white py-2 px-4 text-sm rounded hover:bg-blue-700"
            onClick={() => window.open(`/?sessionId=${id}`, "_blank")}
          >
            Open
          </button>
          <button
            type="button"
            disabled={isActive}
            className={cn([
              "bg-red-600 text-white py-2 px-4 text-sm rounded hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed",
            ])}
            onClick={onDelete}
          >
            Discard
          </button>
        </div>
      </form>
    </div>
  );
};

export default SessionCard;
