"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import Image from "next/image";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const AUTH_KEY = "pcnb-admin-auth";

type NoticeType = "URGENT" | "PLACEMENT_DRIVE" | "EVENT" | "GENERAL_INFO";

type User = {
  id: string;
  username: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  createdAt: string;
};

type Notice = {
  id: string;
  title: string;
  content: string;
  type: NoticeType;
  senderName: string | null;
  attachments: string[];
  createdAt: string;
  author: { username: string };
};

type NoticeViewUser = {
  id: string;
  username: string;
  email: string;
  viewedAt?: string;
};

type NoticeViewStats = {
  noticeId: string;
  totalUsers: number;
  stats: {
    seen: { count: number; users: NoticeViewUser[] };
    deliveredNotSeen: { count: number; users: NoticeViewUser[] };
    notLoggedIn: { count: number; users: NoticeViewUser[] };
  };
};

type AdminStats = {
  totalNotices: number;
  totalUsers: number;
  totalViews: number;
};

type Tab = "publish" | "notices" | "users";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

const NOTICE_TYPE_COLORS: Record<NoticeType, { bg: string; text: string; label: string }> = {
  URGENT: { bg: "bg-red-100", text: "text-red-700", label: "Urgent" },
  PLACEMENT_DRIVE: { bg: "bg-blue-100", text: "text-blue-700", label: "Placement Drive" },
  EVENT: { bg: "bg-green-100", text: "text-green-700", label: "Event" },
  GENERAL_INFO: { bg: "bg-amber-100", text: "text-amber-700", label: "General Info" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// WhatsApp-style tick components
function SeenTick() {
  return (
    <svg width="18" height="11" viewBox="0 0 18 11" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 6L5 10L11 1" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 6L11 10L17 1" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function DeliveredTick() {
  return (
    <svg width="18" height="11" viewBox="0 0 18 11" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 6L5 10L11 1" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 6L11 10L17 1" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SentTick() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 5L4 8L9 2" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function Home() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingNoticeId, setDeletingNoticeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("notices");

  // Login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Publish form
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [noticeType, setNoticeType] = useState<NoticeType>("GENERAL_INFO");
  const [senderName, setSenderName] = useState("");
  const [attachments, setAttachments] = useState("");

  // View stats modal
  const [selectedNoticeStats, setSelectedNoticeStats] = useState<NoticeViewStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsNoticeTitle, setStatsNoticeTitle] = useState("");

  const isLoggedIn = useMemo(() => Boolean(authToken && authUser), [authToken, authUser]);

  // Restore session
  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { token: string; user: User };
      setAuthToken(parsed.token);
      setAuthUser(parsed.user);
      api.defaults.headers.common.Authorization = `Bearer ${parsed.token}`;
    } catch {
      localStorage.removeItem(AUTH_KEY);
    }
  }, []);

  // Fetch data when logged in
  useEffect(() => {
    if (!authToken) return;
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [noticesRes, usersRes, statsRes] = await Promise.all([
          api.get<Notice[]>("/api/notices"),
          api.get<{ users: User[] }>("/api/auth/user/all-users"),
          api.get<AdminStats>("/api/notices/admin/stats"),
        ]);
        setNotices(noticesRes.data);
        setAllUsers(usersRes.data.users);
        setAdminStats(statsRes.data);
      } catch {
        setError("Unable to load dashboard data.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, [authToken]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    try {
      const response = await api.post("/api/auth/user/login", { email, password });
      const { token: newToken, user: newUser } = response.data;
      if (newUser.role !== "ADMIN") {
        setError("This account does not have admin access.");
        return;
      }
      const authData = { token: newToken, user: newUser };
      localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
      api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
      setAuthToken(newToken);
      setAuthUser(newUser);
      setSuccess("Welcome back, Admin!");
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.message
        ? err.response.data.message
        : "Login failed. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      return;
    }
    setIsLoading(true);
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        type: noticeType,
        senderName: senderName.trim() || undefined,
        attachments: attachments.split(",").map((i) => i.trim()).filter(Boolean),
      };
      await api.post("/api/notices/create", payload);
      setSuccess("Notice published and notifications sent!");
      setTitle("");
      setContent("");
      setSenderName("");
      setAttachments("");
      setNoticeType("GENERAL_INFO");
      const response = await api.get<Notice[]>("/api/notices");
      setNotices(response.data);
      if (adminStats) {
        setAdminStats((prev) => prev ? { ...prev, totalNotices: prev.totalNotices + 1 } : prev);
      }
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : "Unable to publish notice.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setAuthToken(null);
    setAuthUser(null);
    setNotices([]);
    setAllUsers([]);
    setAdminStats(null);
    setError(null);
    delete api.defaults.headers.common.Authorization;
  };

  const handleViewStats = async (notice: Notice) => {
    setStatsLoading(true);
    setStatsNoticeTitle(notice.title);
    setSelectedNoticeStats(null);
    try {
      const response = await api.get<NoticeViewStats>(`/api/notices/${notice.id}/stats`);
      setSelectedNoticeStats(response.data);
    } catch {
      setError("Failed to load notice view stats.");
    } finally {
      setStatsLoading(false);
    }
  };

  const handleDeleteNotice = async (notice: Notice) => {
    if (!window.confirm(`Delete "${notice.title}"? This cannot be undone.`)) {
      return;
    }

    setError(null);
    setSuccess(null);
    setDeletingNoticeId(notice.id);
    try {
      await api.delete(`/api/notices/${notice.id}`);
      setNotices((currentNotices) => currentNotices.filter((item) => item.id !== notice.id));
      setAdminStats((currentStats) => currentStats
        ? { ...currentStats, totalNotices: Math.max(0, currentStats.totalNotices - 1) }
        : currentStats);
      setSuccess("Notice deleted.");
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : "Unable to delete notice.";
      setError(message);
    } finally {
      setDeletingNoticeId(null);
    }
  };

  const handleUpdateRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "ADMIN" ? "STUDENT" : "ADMIN";
    if (!confirm(`Change this user's role to ${newRole}?`)) return;
    try {
      await api.patch("/api/auth/user/update-role", { userId, role: newRole });
      setAllUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setSuccess(`Role updated to ${newRole}.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Failed to update role.");
      setTimeout(() => setError(null), 3000);
    }
  };

  // ─── Login Screen ─────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex justify-center items-center bg-white rounded-4xl transition-all duration-300 hover:scale-105 shadow-lg shadow-emerald-600 hover:shadow-emerald-400">
              <Image
                src="/pcnb_withgg.png"
                alt="PCNB Logo"
                width={280}
                height={280}
                className="transition-all duration-300 hover:rotate-2"
              />
            </div>
            {/* <h1 className="text-3xl font-bold text-white">PCNB Admin</h1>
            <p className="text-blue-300 text-sm mt-1">Placement Cell Notice Board</p> */}
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-1">Sign in to Admin Panel</h2>
            <p className="text-slate-400 text-sm mb-6">Use your admin credentials to access the dashboard.</p>

            {error && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-white/10 text-white placeholder-slate-500 px-4 py-3 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
                  placeholder="admin@ggits.net"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-white/10 text-white placeholder-slate-500 px-4 py-3 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 transition-all shadow-lg shadow-blue-600/30"
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>
          {/* <p className="text-center text-slate-500 text-xs mt-6">
            © 2026 GGITS · Developed by Shubhashish Chakraborty
          </p> */}
        </div>
      </main>
    );
  }

  // ─── Admin Dashboard ───────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-32">
            <div className="flex items-center gap-3">
              <div className="flex justify-center items-center bg-white rounded-4xl transition-all duration-300 hover:scale-105 shadow-lg shadow-emerald-600 hover:shadow-emerald-400">
              <Image
                src="/pcnb_icon.png"
                alt="PCNB Logo"
                width={100}
                height={100}
                className="transition-all duration-300 hover:rotate-2"
              />
            </div>
              <div>
                <p className="font-bold text-slate-900 text-sm leading-tight">PCNB Admin Panel</p>
                <p className="text-xs text-slate-500 leading-tight">Gyan Ganga Placement Cell</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-sm text-slate-600">
                Welcome, <strong>{authUser?.username}</strong>
              </span>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 bg-red-400 transition-all duration-300 cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Alerts */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* Stats Cards */}
        {/* {adminStats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Notices</p>
              <p className="text-3xl font-bold text-slate-900">{adminStats.totalNotices}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Registered Users</p>
              <p className="text-3xl font-bold text-slate-900">{adminStats.totalUsers}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Notice Views</p>
              <p className="text-3xl font-bold text-blue-600">{adminStats.totalViews}</p>
            </div>
          </div>
        )} */}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
          {(["notices", "publish", "users"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                activeTab === tab
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab === "notices" ? "📋 Notices" : tab === "publish" ? "📣 Publish" : "👥 Users"}
            </button>
          ))}
        </div>

        {/* ─── Tab: Notices ─────────────────────────────────────────────────── */}
        {activeTab === "notices" && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">All Notices</h2>
              <span className="text-sm text-slate-500">{notices.length} total</span>
            </div>

            {isLoading && notices.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">Loading notices...</div>
            ) : notices.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">No notices published yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notices.map((notice) => {
                  const typeInfo = NOTICE_TYPE_COLORS[notice.type];
                  return (
                    <div key={notice.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeInfo.bg} ${typeInfo.text}`}>
                              {typeInfo.label}
                            </span>
                            {notice.senderName && (
                              <span className="text-xs text-slate-500">via {notice.senderName}</span>
                            )}
                          </div>
                          <h3 className="font-semibold text-slate-900 truncate">{notice.title}</h3>
                          <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{notice.content}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                            <span>By {notice.author?.username}</span>
                            <span>•</span>
                            <span>{formatDate(notice.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <button
                            onClick={() => handleViewStats(notice)}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:border-blue-300 hover:text-blue-600 transition-all"
                          >
                            <SeenTick />
                            <span>Seen By</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNotice(notice)}
                            disabled={deletingNoticeId === notice.id}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-all hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingNoticeId === notice.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ─── Tab: Publish ─────────────────────────────────────────────────── */}
        {activeTab === "publish" && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Publish New Notice</h2>
            <p className="text-sm text-slate-500 mb-6">All registered students will receive a push notification instantly.</p>

            <form onSubmit={handlePublish} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  placeholder="e.g. TCS Placement Drive 2026"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
                  placeholder="Write the notice details here..."
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Notice Type</label>
                  <select
                    value={noticeType}
                    onChange={(e) => setNoticeType(e.target.value as NoticeType)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="URGENT">🚨 Urgent</option>
                    <option value="PLACEMENT_DRIVE">💼 Placement Drive</option>
                    <option value="EVENT">🎉 Event</option>
                    <option value="GENERAL_INFO">📢 General Info</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Sender Name (optional)</label>
                  <input
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition-all"
                    placeholder="e.g. TPO Cell"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Attachments (comma-separated URLs)</label>
                <input
                  value={attachments}
                  onChange={(e) => setAttachments(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition-all"
                  placeholder="https://example.com/file.pdf"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 transition-all shadow-sm"
              >
                {isLoading ? "Publishing..." : "📣 Publish Notice & Notify Students"}
              </button>
            </form>
          </section>
        )}

        {/* ─── Tab: Users ───────────────────────────────────────────────────── */}
        {activeTab === "users" && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">All Users</h2>
              <span className="text-sm text-slate-500">{allUsers.length} registered</span>
            </div>

            {isLoading && allUsers.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">Loading users...</div>
            ) : allUsers.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">No users registered yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Verified</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Joined</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-slate-900">{u.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-slate-600">{u.email}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          {u.isEmailVerified ? (
                            <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                              Verified
                            </span>
                          ) : (
                            <span className="text-amber-600 text-xs font-medium">Pending</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-slate-500 text-xs">{formatDate(u.createdAt)}</td>
                        <td className="px-6 py-3">
                          {u.id !== authUser?.id && (
                            <button
                              onClick={() => handleUpdateRole(u.id, u.role)}
                              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                                u.role === 'ADMIN'
                                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                                  : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                              }`}
                            >
                              {u.role === 'ADMIN' ? 'Demote to Student' : 'Make Admin'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {/* ─── Notice View Stats Modal ──────────────────────────────────────── */}
      {(selectedNoticeStats || statsLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => { setSelectedNoticeStats(null); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900">Notice Delivery Stats</h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{statsNoticeTitle}</p>
              </div>
              <button
                onClick={() => setSelectedNoticeStats(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                ×
              </button>
            </div>

            {statsLoading ? (
              <div className="flex-1 flex items-center justify-center p-12 text-slate-500">
                Loading stats...
              </div>
            ) : selectedNoticeStats ? (
              <div className="overflow-y-auto flex-1">
                {/* Summary row */}
                <div className="grid grid-cols-3 gap-4 p-6 bg-slate-50 border-b border-slate-100">
                  <div className="text-center">
                    <div className="flex justify-center mb-1"><SeenTick /></div>
                    <p className="text-2xl font-bold text-blue-600">{selectedNoticeStats.stats.seen.count}</p>
                    <p className="text-xs text-slate-500">Seen</p>
                  </div>
                  <div className="text-center">
                    <div className="flex justify-center mb-1"><DeliveredTick /></div>
                    <p className="text-2xl font-bold text-slate-500">{selectedNoticeStats.stats.deliveredNotSeen.count}</p>
                    <p className="text-xs text-slate-500">Delivered, Not Seen</p>
                  </div>
                  <div className="text-center">
                    <div className="flex justify-center mb-1"><SentTick /></div>
                    <p className="text-2xl font-bold text-slate-400">{selectedNoticeStats.stats.notLoggedIn.count}</p>
                    <p className="text-xs text-slate-500">Not Logged In</p>
                  </div>
                </div>

                {/* Seen users */}
                {selectedNoticeStats.stats.seen.count > 0 && (
                  <div className="px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <SeenTick />
                      <h4 className="font-semibold text-slate-800 text-sm">Seen ({selectedNoticeStats.stats.seen.count})</h4>
                    </div>
                    <div className="space-y-2">
                      {selectedNoticeStats.stats.seen.users.map((u) => (
                        <div key={u.id} className="flex items-center justify-between py-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">{u.username}</p>
                              <p className="text-xs text-slate-500">{u.email}</p>
                            </div>
                          </div>
                          {u.viewedAt && (
                            <span className="text-xs text-slate-400">{formatDate(u.viewedAt)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Delivered not seen */}
                {selectedNoticeStats.stats.deliveredNotSeen.count > 0 && (
                  <div className="px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <DeliveredTick />
                      <h4 className="font-semibold text-slate-600 text-sm">Delivered, Not Seen ({selectedNoticeStats.stats.deliveredNotSeen.count})</h4>
                    </div>
                    <div className="space-y-2">
                      {selectedNoticeStats.stats.deliveredNotSeen.users.map((u) => (
                        <div key={u.id} className="flex items-center gap-2 py-1.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700">{u.username}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Not logged in */}
                {selectedNoticeStats.stats.notLoggedIn.count > 0 && (
                  <div className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <SentTick />
                      <h4 className="font-semibold text-slate-400 text-sm">Not Logged In ({selectedNoticeStats.stats.notLoggedIn.count})</h4>
                    </div>
                    <div className="space-y-2">
                      {selectedNoticeStats.stats.notLoggedIn.users.map((u) => (
                        <div key={u.id} className="flex items-center gap-2 py-1.5 opacity-60">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-bold">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-500">{u.username}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
