'use client';

// Data hook for craft/HomePage.tsx (S15 T3 slice 1). Same data sources as
// classic/HomePage.tsx (useRestaurantInfo, workingHoursService,
// BRANDING_HERO/RESTAURANT_NAME) — kept as a dedicated hook (CLAUDE.md §5.1
// "page logic lives in a custom hook") so HomePage.tsx stays a thin
// orchestrator despite the distinct craft layout needing more markup.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { workingHoursService } from '@/services/workingHoursService';
import { dayNameToNumber, type WorkingHoursDto } from '@/types/workingHours';
import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';
import { BRANDING_HERO, RESTAURANT_NAME } from '@/lib/config';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const formatTime = (time: string): string => {
  if (!time || !time.includes(':')) return time || '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return time;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

export interface WorkingHoursGroup {
  days: string;
  hours: string;
}

export function useCraftHomeData() {
  const { t, i18n } = useTranslation();
  const { info } = useRestaurantInfo();
  const [isClient, setIsClient] = useState(false);
  const [workingHours, setWorkingHours] = useState<WorkingHoursDto[]>([]);
  const [isLoadingHours, setIsLoadingHours] = useState(true);

  useEffect(() => {
    setIsClient(true);
    // No `body.is-homepage` here (unlike classic/HomePage.tsx): that global
    // hook exists for the classic overlay header (transparent over the hero,
    // globals.css recolors `.nav-link` for contrast). Craft's own chrome
    // (slice 2) uses an opaque sticky header on every route, so the overlay
    // recoloring would actively break nav contrast on the craft home page.
  }, []);

  useEffect(() => {
    const fetchWorkingHours = async () => {
      try {
        const hours = await workingHoursService.getAll();
        const sorted = [...hours].sort((a, b) => dayNameToNumber(a.dayOfWeek) - dayNameToNumber(b.dayOfWeek));
        setWorkingHours(sorted);
      } catch (error) {
        console.error('Failed to fetch working hours:', error);
        // Keep empty array, caller falls back to hardcoded display values.
      } finally {
        setIsLoadingHours(false);
      }
    };

    void fetchWorkingHours();
  }, []);

  useEffect(() => {
    if (isClient) {
      document.title = t('home_page_title', { name: info?.name ?? RESTAURANT_NAME, city: info?.city ?? '' });
    }
  }, [isClient, t, i18n.language, info]);

  const getDayName = (dayOfWeek: string | number): string => {
    const dayNum = typeof dayOfWeek === 'number' ? dayOfWeek : dayNameToNumber(dayOfWeek);
    return t(DAY_NAMES[dayNum]);
  };

  const formatDayRange = (days: number[]): string => {
    if (days.length === 0) return '';
    if (days.length === 1) return getDayName(days[0]);

    const isConsecutive = days.every((day, i) => i === 0 || day === days[i - 1] + 1);
    if (isConsecutive) return `${getDayName(days[0])} - ${getDayName(days[days.length - 1])}`;

    return days.map((d) => getDayName(d)).join(', ');
  };

  const groupedHours: WorkingHoursGroup[] = (() => {
    if (workingHours.length === 0) return [];

    const groups: WorkingHoursGroup[] = [];
    let currentGroup: number[] = [];
    let currentHours = '';

    workingHours.forEach((wh, index) => {
      const dayNum = dayNameToNumber(wh.dayOfWeek);
      const hours = wh.isClosed ? t('closed', 'Closed') : `${formatTime(wh.openTime)} - ${formatTime(wh.closeTime)}`;

      if (currentHours === hours) {
        currentGroup.push(dayNum);
      } else {
        if (currentGroup.length > 0) {
          groups.push({ days: formatDayRange(currentGroup), hours: currentHours });
        }
        currentGroup = [dayNum];
        currentHours = hours;
      }

      if (index === workingHours.length - 1 && currentGroup.length > 0) {
        groups.push({ days: formatDayRange(currentGroup), hours: currentHours });
      }
    });

    return groups;
  })();

  // Maps embed built from the RestaurantInfo API address (issue #125) — no
  // tenant coordinates are hardcoded; the iframe renders only once the API
  // address is available (mirrors classic/HomePage.tsx).
  const mapAddressQuery = info?.addressLine1
    ? [info.addressLine1, info.postalCode, info.city, info.country].filter(Boolean).join(', ')
    : null;
  const googleMapsEmbedUrl = mapAddressQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(mapAddressQuery)}&output=embed`
    : null;

  // Restaurant identity comes exclusively from the RestaurantInfo API
  // (issue #125): no tenant-1 literals — sections stay blank until it loads.
  const restaurantName = info?.name ?? RESTAURANT_NAME;
  const addressStreet = info?.addressLine1 ?? '';
  const addressCityCountry = info ? `${info.postalCode} ${info.city}, ${info.country}` : '';
  const primaryPhone = info?.phoneNumbers?.find((p) => p.isActive) ?? info?.phoneNumbers?.[0] ?? null;
  const phoneDisplay = primaryPhone?.number ?? '';
  const phoneTel = phoneDisplay.replace(/\s/g, '');

  return {
    t,
    info,
    isClient,
    isLoadingHours,
    groupedHours,
    backgroundImageUrl: BRANDING_HERO,
    googleMapsEmbedUrl,
    restaurantName,
    addressStreet,
    addressCityCountry,
    phoneDisplay,
    phoneTel,
  };
}
