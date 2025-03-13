import React, { useEffect, useMemo, useState } from "react";
import { actions } from "astro:actions";
import type { SessionData, SessionId } from "../../lib/sessionStore";
import SessionCard from "./SessionCard";
import { UrlEntrySchema, type UrlEntry } from "../../lib/urlHistoryStore";

const AdminUI: React.FC = () => {
  const [sessions, setSessions] = useState<[SessionId, SessionData][]>([]);
  const [urlHistory, setUrlHistory] = useState<UrlEntry[]>([]);
  const urls = useMemo(() => urlHistory.map(({ url }) => url), [urlHistory]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSessions = async () => {
    // setLoading(true);
    try {
      const data = await actions.getAllSessions.orThrow();
      setSessions(data.sessions || []);
    } catch (e: any) {
      setError(`Failed to fetch sessions: ${e?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const syncUrlHistory = async () => {
    try {
      const data = await actions.getUrlHistory.orThrow();
      const serverUrlEntries = data.urls || [];
      const serverUrls = serverUrlEntries.map(({ url }) => url);

      const localUrls: UrlEntry[] = UrlEntrySchema.array().parse(
        JSON.parse(localStorage.getItem("urlHistory") || "[]")
      );

      const newUrlsEntries = localUrls.filter(
        ({ url }) => !serverUrls.includes(url)
      );
      if (newUrlsEntries.length > 0) {
        console.log(
          `[Client] Found ${newUrlsEntries.length} new URLs to sync back to server`
        );
      }

      const allUrlEntries = [...serverUrlEntries, ...newUrlsEntries].sort(
        (a, b) => b.timestamp - a.timestamp
      );

      setUrlHistory(allUrlEntries);

      if (newUrlsEntries.length > 0) {
        await actions.addUrlsToHistory.orThrow({ urls: newUrlsEntries });
      }
    } catch (e: any) {
      setError(`Failed to fetch URL history: ${e?.message}`);
    }
  };

  useEffect(() => {
    refreshSessions();
    syncUrlHistory();
    const intervalId = setInterval(refreshSessions, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const onDeleteSession = (id: SessionId) => async () => {
    try {
      await actions.deleteSession.orThrow({ sessionId: id });
      setSessions(sessions.filter(([sessionId]) => sessionId !== id));
    } catch (e: any) {
      setError(`Failed to delete session: ${e?.message}`);
      return;
    }
  };

  const onSubmitUrl = (url: string) => {
    // Add URL to state if its not already present, to top of list
    if (!urlHistory.find((entry) => entry.url === url)) {
      setUrlHistory([{ url, timestamp: Date.now() }, ...urlHistory]);
    }

    // server will add to its own history on submit
    // no action required here
  };

  useEffect(() => {
    // when urlHistory changes, update localStorage, except if empty
    if (urlHistory.length > 0) {
      localStorage.setItem("urlHistory", JSON.stringify(urlHistory));
    }
  }, [urlHistory]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left half - Dashboard content */}
      <div className="w-1/2 p-6">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">System Statistics</h2>
          <p className="mb-2">
            Active Sessions:{" "}
            {sessions.filter(([_, data]) => data.isActive).length}/
            {sessions.length}
          </p>
          {/* <p className="mb-2 italic text-red-300">Server Uptime: 3 days, 4 hours</p>
          <p className="mb-2 italic text-red-300">Last Backup: 2023-05-10 04:30 UTC</p> */}
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        </div>
      </div>

      {/* Right half - Session manager */}
      <div className="w-1/2 bg-gray-200 p-6">
        <div className="session-manager">
          <h2 className="text-2xl font-bold mb-4">Session Manager</h2>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No active sessions found.
                </p>
              ) : (
                sessions.map(([id, data]) => (
                  <SessionCard
                    key={id}
                    id={id}
                    session={data}
                    urlOptions={urls}
                    onDelete={onDeleteSession(id)}
                    onSubmitUrl={onSubmitUrl}
                  />
                ))
              )}
              {/* new session button */}
              <div className="flex justify-center">
                <button
                  type="button"
                  className="bg-blue-400 text-white py-2 px-4 text-sm rounded hover:bg-blue-700"
                  onClick={() => {
                    window.open(`/?sessionId=${crypto.randomUUID()}`, "_blank");
                    setTimeout(refreshSessions, 1000);
                  }}
                >
                  New Session
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUI;
