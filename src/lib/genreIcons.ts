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

// Other ways people write a genre, after lowercasing and dropping punctuation.
const ALIASES: Record<string, string> = {
  kids: 'Children’s', children: 'Children’s', childrens: 'Children’s', 'picture book': 'Children’s',
  ya: 'Young Adult', 'sci fi': 'Science Fiction', scifi: 'Science Fiction', sf: 'Science Fiction',
  cookbook: 'Cooking', cookbooks: 'Cooking', food: 'Cooking', recipes: 'Cooking',
  autobiography: 'Memoir', 'non fiction': 'Nonfiction', novel: 'Fiction', 'self help': 'Self-Help',
  tech: 'Technology', computers: 'Technology', ai: 'Technology', poems: 'Poetry', comics: 'Graphic Novel', manga: 'Graphic Novel',
}

const simplify = (text: string) => text.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
// Longest first, so "Historical Fiction" is found before "Fiction" and "Science Fiction" before "Science".
const BY_LENGTH = Object.keys(GENRE_ICONS).sort((a, b) => b.length - a.length)

/** Which icon a genre gets: an exact name or a common alias, else a listed genre inside it ("Contemporary Fiction" → Fiction). */
export function iconFor(genre: string | undefined): string {
  const g = simplify(genre ?? '')
  if (!g) return DEFAULT_ICON
  const exact = BY_LENGTH.find((name) => simplify(name) === g) ?? ALIASES[g]
  if (exact) return exact
  return BY_LENGTH.find((name) => ` ${g} `.includes(` ${simplify(name)} `)) ?? DEFAULT_ICON
}
