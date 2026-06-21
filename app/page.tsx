"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const AUTH_KEY = "pcnb-admin-auth";

type NoticeType = "URGENT" | "PLACEMENT_DRIVE" | "EVENT" | "GENERAL_INFO";

type User = {
  id: string;
  username: string;
  role: string;
};

type Notice = {
  id: string;
  title: string;
  content: string;
  type: NoticeType;
  senderName: string | null;
  attachments: string[];
  createdAt: string;
  author: {
    username: string;
  };
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [noticeType, setNoticeType] = useState<NoticeType>("GENERAL_INFO");
  const [senderName, setSenderName] = useState("");
  const [attachments, setAttachments] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as { token: string; user: User };
      setToken(parsed.token);
      setUser(parsed.user);
      api.defaults.headers.common.Authorization = `Bearer ${parsed.token}`;
    } catch {
      localStorage.removeItem(AUTH_KEY);
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    const fetchNotices = async () => {
      try {
        setIsLoading(true);
        const response = await api.get<Notice[]>('/api/notices');
        setNotices(response.data);
      } catch {
        setError("Unable to load notices right now.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotices();
  }, [token]);

  const isLoggedIn = useMemo(() => Boolean(token && user), [token, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await api.post('/api/auth/user/login', { email, password });
      const { token: newToken, user: newUser } = response.data;

      if (newUser.role !== 'ADMIN') {
        setError('This account does not have admin access.');
        return;
      }

      const authData = { token: newToken, user: newUser };
      localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
      api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
      setToken(newToken);
      setUser(newUser);
      setSuccess('Admin signed in successfully.');
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : 'Login failed. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token || !user) {
      setError('Please sign in first.');
      return;
    }

    if (!title.trim() || !content.trim()) {
      setError('Title and content are required.');
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        type: noticeType,
        senderName: senderName.trim() || undefined,
        attachments: attachments
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      };

      await api.post('/api/notices/create', payload);
      setSuccess('Notification published successfully.');
      setTitle('');
      setContent('');
      setSenderName('');
      setAttachments('');
      setNoticeType('GENERAL_INFO');
      const response = await api.get<Notice[]>('/api/notices');
      setNotices(response.data);
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : 'Unable to publish notice.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setToken(null);
    setUser(null);
    setNotices([]);
    setError(null);
    setSuccess('Signed out successfully.');
    delete api.defaults.headers.common.Authorization;
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Admin Panel</p>
            <h1 className="mt-1 text-3xl font-semibold">Training & Placement Notices</h1>
          </div>
          {isLoggedIn && (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Logout
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {!isLoggedIn ? (
          <section className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-2xl font-semibold">Admin sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Use an admin account to publish notices.</p>
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-0 focus:border-blue-500"
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-0 focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Welcome back</p>
                  <h2 className="text-2xl font-semibold">{user?.username}</h2>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                  {user?.role}
                </span>
              </div>

              <form onSubmit={handlePublish} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                    placeholder="Placement drive update"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Content</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                    placeholder="Write the notice details here..."
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Notice type</label>
                    <select
                      value={noticeType}
                      onChange={(e) => setNoticeType(e.target.value as NoticeType)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                    >
                      <option value="URGENT">Urgent</option>
                      <option value="PLACEMENT_DRIVE">Placement Drive</option>
                      <option value="EVENT">Event</option>
                      <option value="GENERAL_INFO">General Info</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Sender name</label>
                    <input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                      placeholder="TPO Cell"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Attachments (comma separated URLs)</label>
                  <input
                    value={attachments}
                    onChange={(e) => setAttachments(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                    placeholder="https://example.com/file.pdf, https://example.com/image.png"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
                >
                  {isLoading ? 'Publishing...' : 'Publish notification'}
                </button>
              </form>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Latest notices</h3>
                <span className="text-sm text-slate-500">{notices.length} total</span>
              </div>
              <div className="mt-4 space-y-3">
                {isLoading && notices.length === 0 ? (
                  <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Loading notices...</div>
                ) : notices.length === 0 ? (
                  <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No notices yet.</div>
                ) : (
                  notices.map((notice) => (
                    <article key={notice.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-semibold">{notice.title}</h4>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {notice.type}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{notice.content}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <span>By {notice.author?.username || 'Unknown'}</span>
                        <span>{new Date(notice.createdAt).toLocaleString()}</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}