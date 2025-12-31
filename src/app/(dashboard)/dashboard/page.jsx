'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState({});
  const [recentTasks, setRecentTasks] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, tasksRes, eventsRes] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/tasks?limit=5&status=pending'),
          fetch('/api/events?limit=5&upcoming=true'),
        ]);

        const [statsData, tasksData, eventsData] = await Promise.all([
          statsRes.json(),
          tasksRes.json(),
          eventsRes.json(),
        ]);

        setStats(statsData.stats || {});
        setRecentTasks(tasksData.tasks || []);
        setUpcomingEvents(eventsData.events || []);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const statCards = [
    { label: 'Open Projects', value: stats.openProjects || 0, href: '/projects' },
    { label: 'Open Tasks', value: stats.openTasks || 0, href: '/tasks' },
    { label: 'Contacts', value: stats.contacts || 0, href: '/contacts' },
    { label: 'Active Deals', value: stats.activeDeals || 0, href: '/deals' },
    { label: 'Pipeline', value: `$${((stats.dealPipeline || 0) / 1000).toFixed(0)}k`, href: '/deals' },
    { label: 'Hours Logged', value: `${stats.timeTracked || 0}h`, href: '/timesheets' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow"
          >
            <p className="text-xs text-slate-500 mb-1">{card.label}</p>
            <p className="text-2xl font-semibold text-slate-900">
              {loading ? (
                <span className="inline-block w-12 h-7 bg-slate-100 rounded animate-pulse" />
              ) : (
                card.value
              )}
            </p>
          </Link>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-medium text-slate-900">Recent Tasks</h2>
            <Link href="/tasks" className="text-xs text-slate-500 hover:text-slate-700">
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="w-3/4 h-4 bg-slate-100 rounded animate-pulse" />
                  <div className="w-1/2 h-3 bg-slate-50 rounded animate-pulse mt-2" />
                </div>
              ))
            ) : recentTasks.length > 0 ? (
              recentTasks.map((task) => (
                <div key={task.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 w-4 h-4 border-2 border-slate-300 rounded flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 truncate">{task.title}</p>
                      {task.dueDate && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Due: {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                      task.priority === 'urgent' ? 'bg-red-50 text-red-700' :
                      task.priority === 'high' ? 'bg-orange-50 text-orange-700' :
                      'bg-slate-50 text-slate-600'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-slate-500">No pending tasks</p>
                <Link href="/tasks" className="text-sm text-slate-900 hover:underline mt-1 inline-block">
                  Create a task
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-medium text-slate-900">Upcoming Events</h2>
            <Link href="/calendar" className="text-xs text-slate-500 hover:text-slate-700">
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="w-3/4 h-4 bg-slate-100 rounded animate-pulse" />
                  <div className="w-1/2 h-3 bg-slate-50 rounded animate-pulse mt-2" />
                </div>
              ))
            ) : upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => (
                <div key={event.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="text-center min-w-[40px]">
                      <p className="text-xs text-slate-500">
                        {new Date(event.startTime).toLocaleDateString('en-US', { month: 'short' })}
                      </p>
                      <p className="text-lg font-semibold text-slate-900">
                        {new Date(event.startTime).getDate()}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 truncate">{event.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        {event.location && ` - ${event.location}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-slate-500">No upcoming events</p>
                <Link href="/calendar" className="text-sm text-slate-900 hover:underline mt-1 inline-block">
                  Schedule an event
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 bg-slate-900 rounded-lg p-5">
        <h3 className="text-sm font-medium text-white mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/tasks"
            className="px-3 py-1.5 bg-white/10 text-white text-sm rounded-md hover:bg-white/20 transition-colors"
          >
            New Task
          </Link>
          <Link
            href="/projects"
            className="px-3 py-1.5 bg-white/10 text-white text-sm rounded-md hover:bg-white/20 transition-colors"
          >
            New Project
          </Link>
          <Link
            href="/timesheets"
            className="px-3 py-1.5 bg-white/10 text-white text-sm rounded-md hover:bg-white/20 transition-colors"
          >
            Log Time
          </Link>
          <Link
            href="/contacts"
            className="px-3 py-1.5 bg-white/10 text-white text-sm rounded-md hover:bg-white/20 transition-colors"
          >
            Add Contact
          </Link>
        </div>
      </div>
    </div>
  );
}
