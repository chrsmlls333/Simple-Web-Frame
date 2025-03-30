import React, { useState, useEffect } from 'react';

import { actions } from 'astro:actions';
import type { SessionData, SessionId } from '../../lib/schemas';

import { cn, formatTimestamp, getReadableUUID } from '../../lib/styles';


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
  const [lastActiveAt, setLastActiveAt] = useState(formatTimestamp(session.lastActiveAt));
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    onSubmitUrl(formData.get('iframeUrl') as string); // field is required
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
        setError('Failed to check session status');
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
        'mb-4 rounded-lg border-l-4 border-gray-500 bg-gray-200 p-4 shadow-md transition-colors',
        isActive && 'border-green-500 bg-white',
        success && 'border-green-500 bg-green-100',
        error && 'border-red-500 bg-red-100',
      ])}
    >
      <div className='mb-3 flex items-center justify-between'>
        <div className='flex flex-row items-center gap-2'>
          <div className='flex items-center rounded-lg border border-gray-300 p-1'>
            <h3 className='font-mono text-2xl leading-none font-bold tracking-widest in-target:animate-bounce'>
              {getReadableUUID(id)}
            </h3>
          </div>
          <div className='flex items-center'>
            <span
              className={cn([
                'mr-2 inline-block h-3 w-3 rounded-full',
                isActive ? 'bg-green-500' : 'bg-gray-500',
              ])}
            ></span>
            <span className={cn(['text-sm', isActive ? 'text-green-600' : 'text-gray-600'])}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        <div className='text-right text-sm text-gray-400'>
          {/* <div>Last Active:</div> */}
          <div>{lastActiveAt}</div>
        </div>
      </div>

      {error && <div className='mb-2 text-sm text-red-600'>{error}</div>}

      <form id={`form-update-${id}`} className='space-y-4' onSubmit={onSubmit}>
        <input type='hidden' name='sessionId' value={id} />
        <div className='form-group'>
          <label htmlFor={`iframeUrl-${id}`} className='mb-1 block text-sm font-medium'>
            iframe URL:
          </label>
          <input
            type='url'
            id={`iframeUrl-${id}`}
            name='iframeUrl'
            className='mb-2 w-full rounded border p-2'
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
        <div className='flex space-x-2'>
          <button
            type='submit'
            className='rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700'
          >
            Update
          </button>
          <button
            type='button'
            className='rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700'
            onClick={() => window.open(`/?sessionId=${id}`, '_blank')}
          >
            Open
          </button>
          {!isActive && (
            <button
              type='button'
              disabled={isActive}
              className={cn([
                'rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:border disabled:border-red-600 disabled:bg-red-300',
              ])}
              onClick={onDelete}
            >
              Discard
            </button>
          )}
          {isActive && (
            <button
              type='button'
              className='rounded bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700'
              onClick={() => {
                actions.createTask({ sessionId: id, task: 'refresh' });
              }}
            >
              Request Refresh
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default SessionCard;
