export const mutationKeys = {
  auth: {
    login: ['auth', 'login'] as const,
    register: ['auth', 'register'] as const,
    forgotPassword: ['auth', 'forgot-password'] as const,
  },
  bookings: {
    create: ['bookings', 'create'] as const,
    confirm: ['bookings', 'confirm'] as const,
    cancel: ['bookings', 'cancel'] as const,
  },
} as const;
