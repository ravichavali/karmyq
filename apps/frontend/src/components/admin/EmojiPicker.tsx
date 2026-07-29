import { useState, useRef, useEffect } from 'react'

interface EmojiEntry {
  emoji: string
  keywords: string[]
}

const EMOJIS: EmojiEntry[] = [
  // People & hands
  { emoji: '🤝', keywords: ['handshake', 'help', 'deal', 'agree', 'mutual', 'aid'] },
  { emoji: '👋', keywords: ['wave', 'hello', 'greet', 'welcome'] },
  { emoji: '🙏', keywords: ['please', 'thank', 'pray', 'grateful', 'request'] },
  { emoji: '💪', keywords: ['strong', 'muscle', 'power', 'effort', 'workout'] },
  { emoji: '👐', keywords: ['open', 'hands', 'give', 'receive', 'offer'] },
  { emoji: '🫂', keywords: ['hug', 'support', 'comfort', 'embrace', 'community'] },
  { emoji: '🙋', keywords: ['person', 'raise', 'volunteer', 'ask', 'answer'] },
  { emoji: '👷', keywords: ['worker', 'construction', 'hard hat', 'build'] },
  { emoji: '🧑‍🤝‍🧑', keywords: ['people', 'together', 'friends', 'community', 'pair'] },
  { emoji: '👨‍👩‍👧‍👦', keywords: ['family', 'children', 'parents', 'childcare'] },
  { emoji: '🧒', keywords: ['child', 'kid', 'childcare', 'babysit'] },
  { emoji: '👴', keywords: ['elderly', 'senior', 'elder', 'old'] },
  // Transport
  { emoji: '🚗', keywords: ['car', 'ride', 'drive', 'vehicle', 'transport'] },
  { emoji: '🚌', keywords: ['bus', 'transit', 'public', 'transport'] },
  { emoji: '🚴', keywords: ['bike', 'bicycle', 'cycling', 'ride'] },
  { emoji: '🛵', keywords: ['scooter', 'moped', 'ride'] },
  { emoji: '🚶', keywords: ['walk', 'pedestrian', 'foot'] },
  { emoji: '✈️', keywords: ['plane', 'flight', 'airport', 'travel'] },
  { emoji: '🚐', keywords: ['van', 'minivan', 'shuttle', 'transport'] },
  // Food & meals
  { emoji: '🍽️', keywords: ['meal', 'food', 'dinner', 'eat', 'plate'] },
  { emoji: '🥘', keywords: ['food', 'meal', 'cook', 'soup', 'stew'] },
  { emoji: '🧁', keywords: ['bake', 'cupcake', 'cake', 'dessert', 'sweet'] },
  { emoji: '🥗', keywords: ['salad', 'healthy', 'food', 'vegetable'] },
  { emoji: '🍱', keywords: ['bento', 'box', 'meal', 'food', 'lunch'] },
  { emoji: '☕', keywords: ['coffee', 'drink', 'hot', 'morning', 'cafe'] },
  { emoji: '🛒', keywords: ['shopping', 'groceries', 'cart', 'market', 'errand'] },
  // Home & tools
  { emoji: '🔧', keywords: ['wrench', 'repair', 'fix', 'tool', 'service'] },
  { emoji: '🔨', keywords: ['hammer', 'build', 'construct', 'fix', 'tool'] },
  { emoji: '🪛', keywords: ['screwdriver', 'repair', 'fix', 'tool'] },
  { emoji: '🧰', keywords: ['toolbox', 'repair', 'fix', 'tools', 'service'] },
  { emoji: '🏠', keywords: ['home', 'house', 'moving', 'housing'] },
  { emoji: '🏗️', keywords: ['construction', 'build', 'crane', 'work'] },
  { emoji: '🌿', keywords: ['plant', 'garden', 'nature', 'green', 'grow'] },
  { emoji: '🌱', keywords: ['sprout', 'plant', 'garden', 'grow', 'seedling'] },
  { emoji: '🧹', keywords: ['broom', 'clean', 'sweep', 'chores'] },
  { emoji: '🧺', keywords: ['laundry', 'basket', 'wash', 'chores'] },
  { emoji: '🪴', keywords: ['plant', 'garden', 'pot', 'indoor'] },
  // Education & skills
  { emoji: '📚', keywords: ['books', 'study', 'learn', 'education', 'tutor'] },
  { emoji: '✏️', keywords: ['pencil', 'write', 'draw', 'tutor', 'school'] },
  { emoji: '🎓', keywords: ['graduate', 'education', 'degree', 'school', 'tutor'] },
  { emoji: '💻', keywords: ['computer', 'tech', 'coding', 'laptop', 'digital'] },
  { emoji: '🎨', keywords: ['art', 'paint', 'creative', 'design', 'draw'] },
  { emoji: '🎸', keywords: ['guitar', 'music', 'instrument', 'lesson', 'play'] },
  { emoji: '🎹', keywords: ['piano', 'music', 'keyboard', 'lesson'] },
  { emoji: '🗣️', keywords: ['speak', 'language', 'talk', 'translate', 'tutor'] },
  // Animals & pets
  { emoji: '🐕', keywords: ['dog', 'pet', 'walk', 'animal', 'puppy'] },
  { emoji: '🐈', keywords: ['cat', 'pet', 'animal', 'kitten'] },
  { emoji: '🐾', keywords: ['paw', 'pet', 'animal', 'walk', 'dog', 'cat'] },
  { emoji: '🦮', keywords: ['guide dog', 'dog', 'walk', 'pet'] },
  // Health & wellness
  { emoji: '💊', keywords: ['medicine', 'pill', 'health', 'pharmacy'] },
  { emoji: '🏥', keywords: ['hospital', 'health', 'medical', 'care'] },
  { emoji: '🧘', keywords: ['yoga', 'meditate', 'wellness', 'relax', 'health'] },
  { emoji: '🩺', keywords: ['doctor', 'health', 'stethoscope', 'medical'] },
  // Events & activities
  { emoji: '📅', keywords: ['calendar', 'event', 'date', 'schedule', 'plan'] },
  { emoji: '🎉', keywords: ['party', 'celebrate', 'event', 'fun', 'festivity'] },
  { emoji: '🎪', keywords: ['event', 'circus', 'fair', 'festival'] },
  { emoji: '⚽', keywords: ['soccer', 'sport', 'football', 'game', 'play'] },
  { emoji: '🏀', keywords: ['basketball', 'sport', 'game', 'play'] },
  { emoji: '🎭', keywords: ['theater', 'arts', 'performance', 'show', 'event'] },
  // Moving & logistics
  { emoji: '📦', keywords: ['box', 'move', 'package', 'borrow', 'ship'] },
  { emoji: '🪣', keywords: ['bucket', 'carry', 'move', 'clean'] },
  { emoji: '📬', keywords: ['mail', 'letter', 'errand', 'post', 'deliver'] },
  { emoji: '🗂️', keywords: ['folder', 'organize', 'admin', 'file', 'paperwork'] },
  // Symbolic
  { emoji: '⭐', keywords: ['star', 'favorite', 'rate', 'special', 'featured'] },
  { emoji: '✨', keywords: ['sparkle', 'magic', 'special', 'new', 'general'] },
  { emoji: '💡', keywords: ['idea', 'light', 'bulb', 'tip', 'knowledge'] },
  { emoji: '❤️', keywords: ['heart', 'love', 'care', 'support', 'health'] },
  { emoji: '🔑', keywords: ['key', 'access', 'lock', 'housing', 'open'] },
  { emoji: '🌍', keywords: ['earth', 'world', 'global', 'community', 'environment'] },
  { emoji: '☀️', keywords: ['sun', 'day', 'outdoor', 'garden', 'energy'] },
  { emoji: '🌧️', keywords: ['rain', 'weather', 'water', 'outdoor'] },
  { emoji: '♻️', keywords: ['recycle', 'environment', 'reuse', 'green', 'eco'] },
  { emoji: '💬', keywords: ['chat', 'talk', 'message', 'language', 'communication'] },
  { emoji: '📍', keywords: ['pin', 'location', 'map', 'place', 'address'] },
  { emoji: '⏰', keywords: ['clock', 'time', 'alarm', 'schedule', 'urgent'] },
  { emoji: '🆘', keywords: ['help', 'emergency', 'sos', 'urgent', 'need'] },
  { emoji: '🤲', keywords: ['give', 'receive', 'donate', 'offer', 'hands'] },
  { emoji: '🫶', keywords: ['love', 'heart', 'hands', 'care', 'support', 'community'] },
]

interface Props {
  value: string
  onChange: (emoji: string) => void
  label?: string
}

export default function EmojiPicker({ value, onChange, label = 'Icon (emoji)' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.trim()
    ? EMOJIS.filter(
        (e) =>
          e.emoji === query ||
          e.keywords.some((k) => k.includes(query.toLowerCase()))
      )
    : EMOJIS

  const select = (emoji: string) => {
    onChange(emoji)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-text-muted mb-2">{label}</label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 border border-border rounded hover:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary bg-surface text-left"
      >
        <span className="text-2xl">{value || '✨'}</span>
        <span className="text-sm text-text-muted">Click to change</span>
        <span className="ml-auto text-text-subtle text-xs">▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search emojis…"
              className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Grid */}
          <div className="p-2 grid grid-cols-8 gap-1 max-h-52 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="col-span-8 text-center py-4 text-xs text-text-subtle">
                No emojis found — try another word
              </div>
            )}
            {filtered.map((entry) => (
              <button
                key={entry.emoji}
                type="button"
                onClick={() => select(entry.emoji)}
                title={entry.keywords[0]}
                className={`text-xl p-1.5 rounded hover:bg-surface-raised transition-colors ${
                  value === entry.emoji ? 'bg-primary-light ring-1 ring-primary' : ''
                }`}
              >
                {entry.emoji}
              </button>
            ))}
          </div>

          {/* Type directly */}
          <div className="p-2 border-t border-border">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Or type any emoji…"
              className="w-full px-3 py-1.5 border border-border rounded text-sm focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      )}
    </div>
  )
}
