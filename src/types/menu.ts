export interface MenuItemContent {
  name: string;
  description: string;
}

export type DietaryTag = "vegan" | "halal" | "gluten-free" | "vegetarian" | string;

export interface MenuItemImage {
  url: string;
  alt: string;
}

export interface MenuItem {
  id: string;
  content: Partial<Record<string, MenuItemContent>> & {
    en?: MenuItemContent;
  };
  price: number;
  image: string;
  dietaryTags: DietaryTag[];
  categoryKey?: string;
  isSpecial?: boolean;
  images?: MenuItemImage[];
}

export type ApiCategory = { id: string; name: string };
