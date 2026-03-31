import type { MovieCategory } from '@/types/catalog'

export const mockMovieCategories: MovieCategory[] = [
  { id: 'mc-popular', name: 'Em destaque', order: 0 },
  { id: 'mc-action', name: 'Ação', order: 1 },
  { id: 'mc-drama', name: 'Drama', order: 2 },
  { id: 'mc-scifi', name: 'Ficção científica', order: 3 },
]
