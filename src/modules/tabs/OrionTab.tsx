/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import { List, ListItem, BlockTitle } from 'konsta/react';
import { useEffect, useMemo, useState } from 'react';
import AppNavbar from '@/components/AppNavbar';
import CogIcon from '@/components/icons/CogIcon';

interface Notification {
  id: number;
  ticker: string;
  stars: number;
  direction: 'up' | 'down';
  timestamp: Date;
}

const generateMockNotifications = (): Notification[] => {
  const tickers = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NVDA', 'AMD', 'NFLX', 'DIS', 'BAC', 'JPM', 'GS', 'WMT', 'TGT', 'COST', 'NKE', 'SBUX', 'MCD', 'KO'];
  const notifications: Notification[] = [];
  const now = new Date();
  
  // Generate 200 notifications over the past 30 days
  for (let i = 0; i < 200; i++) {
    const hoursAgo = Math.floor(Math.random() * 720); // Random time in last 30 days
    const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    
    notifications.push({
      id: i,
      ticker: tickers[Math.floor(Math.random() * tickers.length)],
      stars: Math.floor(Math.random() * 5) + 1,
      direction: Math.random() > 0.5 ? 'up' : 'down',
      timestamp,
    });
  }
  
  // Sort by timestamp descending (newest first)
  return notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

const getDateLabel = (date: Date): string => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (inputDate.getTime() === today.getTime()) return 'Today';
  if (inputDate.getTime() === yesterday.getTime()) return 'Yesterday';
  
  const daysAgo = Math.floor((today.getTime() - inputDate.getTime()) / (24 * 60 * 60 * 1000));
  if (daysAgo < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }
  
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const groupByDate = (notifications: Notification[]) => {
  const groups: { [key: string]: Notification[] } = {};
  
  notifications.forEach((notification) => {
    const label = getDateLabel(notification.timestamp);
    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(notification);
  });
  
  return groups;
};

const StarRating = ({ stars }: { stars: number }) => {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= stars ? 'text-yellow-400' : 'text-gray-600'}>
          ⭐
        </span>
      ))}
    </div>
  );
};

export default function OrionTab() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isClient, setIsClient] = useState(false);
  const groupedNotifications = useMemo(() => groupByDate(notifications), [notifications]);

  useEffect(() => {
    setIsClient(true);
    setNotifications(generateMockNotifications());
  }, []);

  return (
    <>
      <AppNavbar 
        title="Notifications"
        left={<span className="text-2xl w-10 h-10 flex items-center justify-center">
          <CogIcon />
        </span>}
      />
      
      <div className="space-y-2 max-w-xl mx-auto">
      {isClient && Object.entries(groupedNotifications).map(([dateLabel, items]) => (
        <div key={dateLabel}>
        <BlockTitle className="mt-4">{dateLabel}</BlockTitle>
        <List strong inset>
          {items.map((notification) => (
          <ListItem
            key={notification.id}
            title={notification.ticker}
            after={
            <div className="flex items-center gap-2">
              <StarRating stars={notification.stars} />
              <span className={`text-2xl ${notification.direction === 'up' ? 'text-green-500' : 'text-red-500'}`}>
              {notification.direction === 'up' ? '▲' : '▼'}
              </span>
            </div>
            }
            subtitle={notification.timestamp.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
            })}
          />
          ))}
        </List>
        </div>
      ))}
      </div>
    </>
  );
}
