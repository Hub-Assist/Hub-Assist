export interface NewsletterPreferences {
  workspaceUpdates: boolean;
  community: boolean;
  promotions: boolean;
  productUpdates: boolean;
}

export interface NewsletterSubscriber {
  token: string;
  email: string;
  preferences: NewsletterPreferences;
  subscribedAt: string;
}

export interface NewsletterPreferencesResponse {
  preferences: NewsletterPreferences;
  email: string;
}
