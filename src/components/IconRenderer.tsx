import React from 'react';
import * as Icons from 'lucide-react';

interface IconRendererProps {
  name: string;
  className?: string;
  size?: number;
}

export function IconRenderer({ name, className = '', size = 20 }: IconRendererProps) {
  // Safe registry mapping
  const IconComponent = (Icons as any)[name] || Icons.CircleHelp;
  return <IconComponent className={className} size={size} />;
}

// Available icons to select for custom categories
export const AVAILABLE_ICONS = [
  { name: 'ShoppingBag', label: 'Продукти / Покупки' },
  { name: 'Home', label: 'Дім / Комуналка' },
  { name: 'Car', label: 'Транспорт / Авто' },
  { name: 'HeartPulse', label: 'Здоров\'я' },
  { name: 'GlassWater', label: 'Кафе / Розваги' },
  { name: 'Shirt', label: 'Одяг / Взуття' },
  { name: 'Wifi', label: 'Інтернет / Зв\'язок' },
  { name: 'Briefcase', label: 'Робота / Бізнес' },
  { name: 'TrendingUp', label: 'Інвестиції / Доходи' },
  { name: 'CircleHelp', label: 'Інше' },
  { name: 'Sparkles', label: 'Краса / Спорт' },
  { name: 'Gift', label: 'Подарунки' },
  { name: 'BookOpen', label: 'Освіта / Книги' },
  { name: 'Dog', label: 'Домашні улюбленці' },
  { name: 'Baby', label: 'Діти' },
  { name: 'Plane', label: 'Подорожі' },
  { name: 'Utensils', label: 'Ресторани / Їжа' },
  { name: 'Gamepad2', label: 'Ігри / Хобі' },
];

export const AVAILABLE_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#6b7280', // Gray
];
