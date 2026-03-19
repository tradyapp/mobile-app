'use client';

import { Toggle } from 'konsta/react';
import { type StrategyUserWebhookConfig, type StrategyWebhookAuthType } from '@/services/StrategiesService';

const AUTH_OPTIONS: Array<{ key: StrategyWebhookAuthType; label: string }> = [
  { key: 'none', label: 'No auth' },
  { key: 'api_key_header', label: 'API key' },
  { key: 'bearer_token', label: 'Bearer' },
  { key: 'basic_auth', label: 'Basic' },
  { key: 'custom_headers', label: 'Headers' },
  { key: 'auth0_client_credentials', label: 'Auth0' },
];

interface StrategyWebhookViewProps {
  config: StrategyUserWebhookConfig;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onChange: (next: StrategyUserWebhookConfig) => void;
  onSave: () => void;
  onRetry: () => void;
}

export default function StrategyWebhookView({
  config,
  isLoading,
  isSaving,
  error,
  onChange,
  onSave,
  onRetry,
}: StrategyWebhookViewProps) {
  const updateAuthType = (authType: StrategyWebhookAuthType) => {
    onChange({ ...config, auth_type: authType });
  };

  return (
    <div className="mx-auto max-w-xl px-4 pb-24">
      {isLoading ? (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-4 text-sm text-zinc-400">Loading webhook config...</div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-100">Webhook enabled</p>
                <p className="text-xs text-zinc-500">Send notifications to your endpoint</p>
              </div>
              <Toggle
                checked={config.enabled}
                onChange={() => onChange({ ...config, enabled: !config.enabled })}
              />
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 space-y-3">
            <div>
              <label className="text-xs text-zinc-400">Endpoint URL</label>
              <input
                type="url"
                value={config.endpoint_url}
                onChange={(event) => onChange({ ...config, endpoint_url: event.target.value })}
                placeholder="https://example.com/webhooks/trady"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <p className="text-xs text-zinc-400">Authentication</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {AUTH_OPTIONS.map((item) => {
                  const active = config.auth_type === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => updateAuthType(item.key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-300'}`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {config.auth_type === 'api_key_header' && (
              <>
                <div>
                  <label className="text-xs text-zinc-400">Header name</label>
                  <input
                    type="text"
                    value={config.api_key_header_name}
                    onChange={(event) => onChange({ ...config, api_key_header_name: event.target.value })}
                    placeholder="x-api-key"
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400">API key</label>
                  <input
                    type="password"
                    value={config.api_key_value}
                    onChange={(event) => onChange({ ...config, api_key_value: event.target.value })}
                    placeholder="********"
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                  />
                </div>
              </>
            )}

            {config.auth_type === 'bearer_token' && (
              <div>
                <label className="text-xs text-zinc-400">Bearer token</label>
                <input
                  type="password"
                  value={config.bearer_token}
                  onChange={(event) => onChange({ ...config, bearer_token: event.target.value })}
                  placeholder="********"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
              </div>
            )}

            {config.auth_type === 'basic_auth' && (
              <>
                <div>
                  <label className="text-xs text-zinc-400">Username</label>
                  <input
                    type="text"
                    value={config.basic_username}
                    onChange={(event) => onChange({ ...config, basic_username: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400">Password</label>
                  <input
                    type="password"
                    value={config.basic_password}
                    onChange={(event) => onChange({ ...config, basic_password: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                  />
                </div>
              </>
            )}

            {config.auth_type === 'custom_headers' && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onChange({
                    ...config,
                    custom_headers: [...config.custom_headers, { key: '', value: '' }],
                  })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                >
                  Add Header
                </button>
                {config.custom_headers.map((header, index) => (
                  <div key={`${header.key}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input
                      type="text"
                      value={header.key}
                      onChange={(event) => {
                        const next = [...config.custom_headers];
                        next[index] = { ...next[index], key: event.target.value };
                        onChange({ ...config, custom_headers: next });
                      }}
                      placeholder="Header"
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
                    />
                    <input
                      type="password"
                      value={header.value}
                      onChange={(event) => {
                        const next = [...config.custom_headers];
                        next[index] = { ...next[index], value: event.target.value };
                        onChange({ ...config, custom_headers: next });
                      }}
                      placeholder="Value"
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = config.custom_headers.filter((_, current) => current !== index);
                        onChange({ ...config, custom_headers: next });
                      }}
                      className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300"
                    >
                      Del
                    </button>
                  </div>
                ))}
              </div>
            )}

            {config.auth_type === 'auth0_client_credentials' && (
              <div className="space-y-2">
                <input
                  type="url"
                  value={config.auth0_token_url}
                  onChange={(event) => onChange({ ...config, auth0_token_url: event.target.value })}
                  placeholder="Auth0 Token URL"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
                />
                <input
                  type="text"
                  value={config.auth0_client_id}
                  onChange={(event) => onChange({ ...config, auth0_client_id: event.target.value })}
                  placeholder="Client ID"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
                />
                <input
                  type="password"
                  value={config.auth0_client_secret}
                  onChange={(event) => onChange({ ...config, auth0_client_secret: event.target.value })}
                  placeholder="Client Secret"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
                />
                <input
                  type="text"
                  value={config.auth0_audience}
                  onChange={(event) => onChange({ ...config, auth0_audience: event.target.value })}
                  placeholder="Audience"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
                />
                <input
                  type="text"
                  value={config.auth0_scope}
                  onChange={(event) => onChange({ ...config, auth0_scope: event.target.value })}
                  placeholder="Scope (optional)"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
                />
              </div>
            )}

            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Webhook'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 space-y-2">
          <div className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</div>
          <button
            type="button"
            onClick={onRetry}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-100"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
