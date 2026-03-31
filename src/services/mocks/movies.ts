import type { Movie } from '@/types/catalog'
import { img } from './constants'

export const mockMovies: Movie[] = [
  {
    id: 'mv-aurora',
    title: 'Aurora Line',
    posterUrl: img.poster('mv-aurora'),
    categoryId: 'mc-scifi',
    type: 'movie',
    description:
      'Uma tripulação em órbita descobre um sinal impossível. O silêncio do espaço deixa de ser conforto.',
    durationMin: 118,
    year: 2024,
    badge: '4K',
  },
  {
    id: 'mv-river',
    title: 'O Rio Verde',
    posterUrl: img.poster('mv-river'),
    categoryId: 'mc-drama',
    type: 'movie',
    description:
      'Dois irmãos regressam à aldeia natal e confrontam segredos guardados por décadas.',
    durationMin: 104,
    year: 2023,
  },
  {
    id: 'mv-nightshift',
    title: 'Turno da Noite',
    posterUrl: img.poster('mv-nightshift'),
    categoryId: 'mc-action',
    type: 'movie',
    description:
      'Um motorista de elétrico vê-se envolvido numa corrida contra o tempo através da cidade.',
    durationMin: 96,
    year: 2025,
    badge: 'Novo',
  },
  {
    id: 'mv-paper',
    title: 'Cidade de Papel',
    posterUrl: img.poster('mv-paper'),
    categoryId: 'mc-popular',
    type: 'movie',
    description:
      'Thriller psicológico sobre uma jornalista que recebe provas anónimas demasiado perfeitas.',
    durationMin: 112,
    year: 2022,
  },
  {
    id: 'mv-echo',
    title: 'Echo Valley',
    posterUrl: img.poster('mv-echo'),
    categoryId: 'mc-drama',
    type: 'movie',
    description:
      'Drama rural com paisagens amplas e uma banda sonora minimalista.',
    durationMin: 121,
    year: 2021,
  },
  {
    id: 'mv-orbit',
    title: 'Órbita Baixa',
    posterUrl: img.poster('mv-orbit'),
    categoryId: 'mc-scifi',
    type: 'movie',
    description:
      'Estação espacial em queda: decisões morais em tempo real.',
    durationMin: 99,
    year: 2024,
  },
  {
    id: 'mv-strike',
    title: 'Último Strike',
    posterUrl: img.poster('mv-strike'),
    categoryId: 'mc-action',
    type: 'movie',
    description:
      'Missão de resgate num território hostil. Sem heróis invencíveis.',
    durationMin: 108,
    year: 2023,
  },
  {
    id: 'mv-lantern',
    title: 'Lanternas',
    posterUrl: img.poster('mv-lantern'),
    categoryId: 'mc-popular',
    type: 'movie',
    description:
      'Uma família reconstrói tradições após um inverno longo demais.',
    durationMin: 94,
    year: 2025,
  },
]
