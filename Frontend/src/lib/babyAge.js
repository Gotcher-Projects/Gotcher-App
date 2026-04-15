import { MILESTONES, ACTIVITIES, PRODUCTS } from './babyData';

export function getWeek(birthdate) {
  if (!birthdate) return 0;
  const diff = Date.now() - new Date(birthdate).getTime();
  return Math.max(0, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)));
}

export function formatBabyAge(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const totalDays = Math.floor((now - birth) / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(totalDays / 7);
  if (weeks < 13) {
    const days = totalDays % 7;
    const wPart = `${weeks} week${weeks !== 1 ? 's' : ''}`;
    if (days === 0) return `${wPart} old`;
    return `${wPart} and ${days} day${days !== 1 ? 's' : ''} old`;
  }
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  const anniversary = new Date(birth);
  anniversary.setMonth(anniversary.getMonth() + months);
  if (anniversary > now) {
    months--;
    anniversary.setMonth(anniversary.getMonth() - 1);
  }
  const days = Math.round((now - anniversary) / (1000 * 60 * 60 * 24));
  const mPart = `${months} month${months !== 1 ? 's' : ''}`;
  if (days === 0) return `${mPart} old`;
  return `${mPart} and ${days} day${days !== 1 ? 's' : ''} old`;
}

export function getMilestones(week) {
  const key = Math.floor(week / 4) * 4;
  return MILESTONES[key] || [];
}

export function getActivities(week) {
  const key = Math.floor(week / 8) * 8;
  return ACTIVITIES[key] || [];
}

export function getProducts(week) {
  const key = Math.floor(week / 8) * 8;
  return PRODUCTS[key] || [];
}
