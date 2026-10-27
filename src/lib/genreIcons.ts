import { simplify } from './openLibrary'

// A little pixel icon for each genre, drawn on the book's cover label. '#' is a pixel in the cover's accent color.
// The names match the genres filled in from Open Library (src/lib/openLibrary.ts); anything else gets the open book.

export const GENRE_ICONS: Record<string, string[]> = {
  'Children’s': ['.......', '.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  'Young Adult': ['...#...', '...#...', '#.###.#', '.#####.', '#.###.#', '...#...', '...#...'],
  Fantasy: ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'],
  'Science Fiction': ['...#...', '..###..', '..#.#..', '..###..', '.#####.', '.#.#.#.', '...#...'],
  Mystery: ['.###...', '#...#..', '#...#..', '#...#..', '.###...', '....##.', '.....##'],
  Thriller: ['....##.', '...##..', '..##...', '.######', '....##.', '...##..', '..##...'],
  Horror: ['.#####.', '#######', '##.#.##', '#######', '#######', '#######', '#.#.#.#'],
  Romance: ['#######', '##...##', '#.#.#.#', '#.###.#', '#..#..#', '#.....#', '#######'],
  'Historical Fiction': ['#######', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#####.', '#######'],
  Poetry: ['......#', '.....##', '....##.', '...##..', '..##...', '.##....', '#......'],
  'Graphic Novel': ['#######', '#.....#', '#.#.#.#', '#.....#', '#######', '.##....', '#......'],
  Memoir: ['..###..', '..###..', '..###..', '.......', '.#####.', '#######', '#######'],
  Biography: ['..###..', '.#####.', '..###..', '.......', '.#####.', '#######', '#######'],
  Cooking: ['.#.#.#.', '.#.#.#.', '.......', '#######', '#.....#', '#.....#', '.#####.'],
  Wine: ['#######', '#.....#', '.#...#.', '..###..', '...#...', '...#...', '..###..'],
  Education: ['...#...', '..#....', '.##.##.', '#######', '#######', '#######', '.##.##.'],
  'Self-Help': ['#..#..#', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '#..#..#'],
  Nature: ['.....##', '...####', '..#####', '.#####.', '.####..', '.#.#...', '#......'],
  Technology: ['#######', '#.....#', '#.#.#.#', '#.....#', '#######', '...#...', '.#####.'],
  Science: ['..###..', '..#.#..', '..#.#..', '.#...#.', '#.###.#', '#######', '.#####.'],
  Psychology: ['..###..', '.#####.', '#######', '###.###', '#######', '.#####.', '...#...'],
  Philosophy: ['..###..', '.#...#.', '#.....#', '.#...#.', '..###..', '..###..', '...#...'],
  Business: ['..###..', '..#.#..', '#######', '#.....#', '#######', '#.....#', '#######'],
  Politics: ['#......', '######.', '#######', '######.', '#......', '#......', '#......'],
  History: ['#######', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#.#.#.', '#######'],
  Art: ['.#####.', '#.#.#.#', '#######', '##...##', '#######', '.####..', '...##..'],
  Travel: ['...#...', '...#...', '.#####.', '#######', '...#...', '..###..', '.#...#.'],
  Classic: ['.......', '#.#.#.#', '#######', '#######', '#.....#', '#######', '.......'],
  Fiction: ['.......', '##...##', '###.###', '###.###', '###.###', '##.#.##', '.#...#.'],
  Nonfiction: ['#######', '#.....#', '#.###.#', '#.....#', '#.###.#', '#.....#', '#######'],
}

/** For a book with no genre, or one that isn't listed: an open book. */
export const DEFAULT_ICON = 'Fiction'

// Other ways people write a genre, simplified (see `simple`). A Map, so a genre like "constructor" can't find
// something inherited from Object.
const ALIASES = new Map<string, string>([
  ['kid', 'Children’s'], ['children', 'Children’s'], ['childrens', 'Children’s'], ['picture book', 'Children’s'],
  ['ya', 'Young Adult'], ['sci fi', 'Science Fiction'], ['scifi', 'Science Fiction'], ['sf', 'Science Fiction'],
  ['cookbook', 'Cooking'], ['food', 'Cooking'], ['recipe', 'Cooking'],
  ['autobiography', 'Memoir'], ['non fiction', 'Nonfiction'], ['novel', 'Fiction'], ['self help', 'Self-Help'],
  ['tech', 'Technology'], ['computer', 'Technology'], ['ai', 'Technology'], ['poem', 'Poetry'], ['comic', 'Graphic Novel'], ['manga', 'Graphic Novel'],
])

// Lowercase letters and digits without accents or apostrophes, each word made singular, so "Children's",
// "Mysteries" and "Graphic Novels" compare as "childrens", "mystery" and "graphic novel".
const singular = (word: string) => (/ies$/.test(word) ? `${word.slice(0, -3)}y` : /[^s]s$/.test(word) ? word.slice(0, -1) : word)
const simple = (text: string) => simplify(text.replace(/['’]/g, '')).split(' ').map(singular).join(' ')

// Longest first, so "Historical Fiction" is found before "Fiction" and "Science Fiction" before "Science".
const NAMES = Object.keys(GENRE_ICONS)
  .sort((a, b) => b.length - a.length)
  .map((name) => [simple(name), name] as const)
const ALIAS_LIST = [...ALIASES].sort((a, b) => b[0].length - a[0].length)

/**
 * Which icon a genre gets: an exact name or common alias, else a listed genre or alias inside it
 * ("Contemporary Fiction" → Fiction, "Kids Books" → Children's). Anything else gets the open book.
 */
export function iconFor(genre: string | undefined): string {
  const g = simple(genre ?? '')
  if (!g) return DEFAULT_ICON
  const inside = (phrase: string) => ` ${g} `.includes(` ${phrase} `)
  return (
    NAMES.find(([name]) => name === g)?.[1] ??
    ALIASES.get(g) ??
    NAMES.find(([name]) => inside(name))?.[1] ??
    ALIAS_LIST.find(([alias]) => inside(alias))?.[1] ??
    DEFAULT_ICON
  )
}
