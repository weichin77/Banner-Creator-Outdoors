
export interface BannerConfig {
  title: string;
  discount: string;
  discount2: string;
  theme: string;
  prompt: string;
  backgroundImage: string | null;
  overlayOpacity: number;
  width: number;
  height: number;
  titleX: number;
  titleY: number;
  discountX: number;
  discountY: number;
  discount2X: number;
  discount2Y: number;
}

export interface UserAccount {
  credits: number;
  isPro: boolean;
  email: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
}
