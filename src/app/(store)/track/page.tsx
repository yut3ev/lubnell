import type { Metadata } from 'next';
import { TrackClient } from '@/components/store/track-client';

// MOBILE-TRACK-2026-10 — self-service order tracking (order number + phone).
export const metadata: Metadata = {
  title: 'تتبعي طلبكِ | LUBNÉL',
  description: 'تابعي حالة طلبكِ من لوبنيل — قيد التجهيز، في الطريق، تم التسليم — برقم الطلب ورقم الموبايل.',
  robots: { index: false },
};

export default function TrackPage() {
  return <TrackClient />;
}
